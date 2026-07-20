"""AIAdvisoryService — login advisory orchestration (never places trades)."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from advisory_core.contracts import (
    AdvisoryStatus,
    LoginAdvisoryResponse,
    AdvisoryRecommendationDTO,
    RiskProfile,
)
from advisory_core.events import EventEnvelope, KafkaTopics
from advisory_core.kafka_io import publish_event
from advisory_core.security import redact_secrets as _redact
from advisory_core.telemetry import (
    recommendations_generated_count,
    strategies_converted_count,
    timed_generation,
    live_approval_requested_count,
)
from advisory_to_strategy import AdvisoryToStrategyConverter
from llm_providers import LLMRouter, MockLLMProvider
from market_regime_detector import MarketAdvisoryEngine
from mcp_connectors import (
    fetch_provider_account_context,
    get_connector,
    resolve_preferred_provider,
)
from recommendation_ranking import RecommendationRankingEngine
from risk_explainability import RiskExplainer
from strategy_normalizer import StrategyNormalizer

from app.prompts import ADVISORY_SYSTEM_PROMPT, ADVISORY_USER_TEMPLATE, PROMPT_VERSION
from app.recommendation_engine import StrategyRecommendationEngine
from app.store import InMemoryAdvisoryStore, get_store

logger = logging.getLogger("ai-advisory-service")


class AIAdvisoryService:
    def __init__(
        self,
        store: InMemoryAdvisoryStore | None = None,
        kafka_bootstrap: str | None = "memory://",
        llm: LLMRouter | None = None,
    ):
        self.store = store or get_store()
        self.kafka_bootstrap = kafka_bootstrap
        self.market_engine = MarketAdvisoryEngine()
        self.reco_engine = StrategyRecommendationEngine()
        self.normalizer = StrategyNormalizer()
        self.risk_explainer = RiskExplainer()
        self.ranking = RecommendationRankingEngine()
        self.converter = AdvisoryToStrategyConverter(self.normalizer)
        self.llm = llm or LLMRouter()
        self._pending: list[asyncio.Task[Any]] = []

    async def wait_pending(self) -> None:
        """Await background login-advisory tasks (tests / drain)."""
        if not self._pending:
            return
        pending = list(self._pending)
        self._pending.clear()
        await asyncio.gather(*pending, return_exceptions=True)

    async def handle_login_event(self, event: EventEnvelope) -> dict[str, Any]:
        if self.store.seen_event(event.idempotency_key):
            latest = self.store.latest_session(event.tenant_id, event.user_id)
            if latest:
                return self.to_login_response(latest)
            return {"status": "duplicate"}
        # Async path: prepare session, publish, generate in background
        session = await self._ensure_preparing_session(event.tenant_id, event.user_id, event.payload)
        await publish_event(
            KafkaTopics.ADVISORY_GENERATION_REQUESTED,
            EventEnvelope.create(
                KafkaTopics.ADVISORY_GENERATION_REQUESTED,
                event.tenant_id,
                event.user_id,
                {"advisory_id": session["id"]},
                idempotency_key=f"genreq:{session['id']}",
                correlation_id=event.correlation_id,
            ),
            self.kafka_bootstrap,
        )
        task = asyncio.create_task(
            self.generate_login_advisory(event.user_id, event.tenant_id, event.payload)
        )
        self._pending.append(task)
        self.store.audit(
            {
                "tenant_id": event.tenant_id,
                "user_id": event.user_id,
                "action": "advisory_generation_queued",
                "resource": f"advisory_session:{session['id']}",
                "details": {"async": True},
            }
        )
        return self.to_login_response(session)

    async def generate_login_advisory(
        self,
        user_id: str,
        tenant_id: str,
        context_hint: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with timed_generation():
            try:
                return await self._generate(user_id, tenant_id, context_hint or {})
            except Exception as exc:
                session = await self._ensure_preparing_session(tenant_id, user_id, context_hint or {})
                session["status"] = AdvisoryStatus.FAILED.value
                session["summary"] = "Advisory generation failed. You can refresh later."
                self.store.upsert_session(session)
                self.store.audit(
                    {
                        "tenant_id": tenant_id,
                        "user_id": user_id,
                        "action": "advisory_failed",
                        "resource": "advisory_session",
                        "details": {"error": str(exc)[:200]},
                    }
                )
                await publish_event(
                    KafkaTopics.ADVISORY_FAILED,
                    EventEnvelope.create(
                        KafkaTopics.ADVISORY_FAILED,
                        tenant_id,
                        user_id,
                        {"advisory_id": session["id"], "error": str(exc)[:200]},
                        idempotency_key=f"fail:{session['id']}",
                    ),
                    self.kafka_bootstrap,
                )
                raise

    async def _generate(self, user_id: str, tenant_id: str, hint: dict[str, Any]) -> dict[str, Any]:
        user_ctx = await self.collect_user_context(user_id, tenant_id, hint)
        market_ctx = await self.collect_market_context(user_ctx)
        broker_ctx = await self.collect_broker_context(user_ctx)
        regime_pack = self.detect_market_regime(market_ctx, broker_ctx, user_ctx)
        options = self.generate_advisory_options(regime_pack, user_ctx, broker_ctx)
        llm_meta = await self._enrich_with_llm_json(options, regime_pack, user_ctx, broker_ctx)
        scored = self.score_recommendations(options, regime_pack)
        session = self.persist_advisory(tenant_id, user_id, user_ctx, market_ctx, broker_ctx, regime_pack, scored)
        if llm_meta:
            session["snapshot"]["data_sources_json"] = {
                **(session.get("snapshot", {}).get("data_sources_json") or {}),
                "llm": llm_meta,
            }
            self.store.upsert_session(session)
            self.store.audit(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": "ai_json_validated",
                    "resource": f"advisory_session:{session['id']}",
                    "details": llm_meta,
                }
            )
        await self.publish_advisory_generated_event(session)
        return self.to_login_response(session)

    async def _enrich_with_llm_json(
        self,
        options: list[dict[str, Any]],
        regime_pack: dict[str, Any],
        user_ctx: dict[str, Any],
        broker_ctx: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Validate MockLLM advisory JSON (default provider). Deterministic options remain source of truth."""
        try:
            available = float(
                (broker_ctx.get("margins") or {}).get("available")
                or (user_ctx.get("margin") or {}).get("available")
                or 0
            )
            regime = regime_pack.get("regime")
            regime_dict = regime.model_dump() if hasattr(regime, "model_dump") else (regime or {})
            prompt = ADVISORY_USER_TEMPLATE.format(
                risk_profile=(user_ctx.get("risk_profile") or {}).get("level") or "unknown",
                broker_status=broker_ctx.get("status") or "unknown",
                margin=available,
                holdings_count=len(broker_ctx.get("holdings") or []),
                market=user_ctx.get("market") or "NSE",
                strategy_performance=user_ctx.get("active_strategies") or [],
                market_status=user_ctx.get("market_status") or "unknown",
                volatility=regime_dict.get("volatility") or "moderate",
                trend=regime_dict.get("trend") or "unknown",
                volume_anomaly=regime_dict.get("volume_anomaly") or False,
                sectors=(regime_pack.get("indicators") or {}).get("sectors")
                if isinstance(regime_pack.get("indicators"), dict)
                else [],
                data_stale=bool(regime_pack.get("force_no_trade")),
            )
            data, meta = await self.llm.generate_advisory_json(
                f"{ADVISORY_SYSTEM_PROMPT}\n\n{prompt}",
                {
                    "mode": "advisory",
                    "available_margin": available,
                    "force_no_trade": bool(regime_pack.get("force_no_trade")),
                    "data_stale": bool(regime_pack.get("force_no_trade")),
                    "guardrails": regime_pack.get("guardrails") or [],
                },
            )
            # Merge any extra LLM titles as audit-only; keep ranked deterministic options
            _ = data.get("recommendations") or []
            return {**meta, "json_validated": True, "recommendation_count_hint": len(_)}
        except Exception as exc:
            logger.warning("LLM advisory JSON skipped: %s", exc)
            # Fallback still validates mock schema locally for audit
            mock = MockLLMProvider()
            data = await mock.generate_advisory_json("", {"force_no_trade": regime_pack.get("force_no_trade")})
            return {"provider": "mock", "json_validated": True, "fallback": True, "count": len(data.get("recommendations") or [])}

    async def collect_user_context(
        self, user_id: str, tenant_id: str, hint: dict[str, Any]
    ) -> dict[str, Any]:
        risk = hint.get("risk_profile") or {}
        profile = RiskProfile(
            level=risk.get("level") or hint.get("risk_level") or "unknown",
            completed=bool(risk.get("completed") or hint.get("risk_profile_completed")),
            max_daily_loss_pct=risk.get("max_daily_loss_pct"),
            max_position_pct=risk.get("max_position_pct"),
            options_allowed=bool(risk.get("options_allowed")),
        )
        portfolio = hint.get("portfolio") or {"holdings_count": 0, "holdings": [], "total_current": 0}
        margin = hint.get("margin") or {"available": float(hint.get("available_margin") or 0)}
        return _redact(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "risk_profile": profile.model_dump(),
                "portfolio": portfolio,
                "margin": margin,
                "active_strategies": hint.get("active_strategies") or [],
                "strategy_performance": hint.get("strategy_performance") or "none",
                "account_id": hint.get("account_id"),
                "market": hint.get("market") or "NSE",
                "broker_status": hint.get("broker_status") or "disconnected",
                "broker": hint.get("broker") or "paper",
                "market_status": hint.get("market_status") or "open",
                "data_stale": bool(hint.get("data_stale") or False),
                "bars": hint.get("bars"),
                "breadth": hint.get("breadth"),
                "sectors": hint.get("sectors") or [],
            }
        )

    async def collect_market_context(self, user_ctx: dict[str, Any]) -> dict[str, Any]:
        # Prefer gateway-provided bars; else paper/mock historical
        bars = user_ctx.get("bars")
        if not bars:
            paper = get_connector("paper")
            await paper.connect()
            bars = await paper.get_historical_data("RELIANCE", "5m", date.today(), date.today())
        status = user_ctx.get("market_status") or "open"
        stale = bool(user_ctx.get("data_stale") or False)
        return {
            "bars": bars,
            "market_status": status,
            "data_stale": stale,
            "breadth": user_ctx.get("breadth"),
            "sectors": user_ctx.get("sectors") or [],
            "as_of": datetime.now(timezone.utc).isoformat(),
        }

    async def collect_broker_context(self, user_ctx: dict[str, Any]) -> dict[str, Any]:
        """Fetch broker context via YAML registry — provider IDs are not hardcoded."""
        broker_status = str(user_ctx.get("broker_status") or "disconnected").lower()
        # Optional MCP advisory context from gateway / mcp-connector-service
        mcp_hint = user_ctx.get("mcp_provider_context") or user_ctx.get("provider_context") or {}
        connected_ids = list(mcp_hint.get("connected_provider_ids") or [])
        if mcp_hint.get("preferred_broker"):
            connected_ids = [mcp_hint["preferred_broker"], *connected_ids]
        broker_name = resolve_preferred_provider(
            {
                "broker": user_ctx.get("broker") or mcp_hint.get("preferred_broker"),
                "provider_id": user_ctx.get("provider_id"),
            },
            connected_provider_ids=connected_ids,
        )
        if broker_status != "connected":
            # Disconnected: use mock_trading for safe empty books
            ctx = await fetch_provider_account_context(
                "mock_trading",
                config={"connected": False},
            )
            hint_margin = user_ctx.get("margin") or {}
            if hint_margin:
                ctx["margins"] = {**(ctx.get("margins") or {}), **hint_margin}
            ctx["status"] = "disconnected"
            ctx["broker"] = broker_name if broker_name != "mock_trading" else (user_ctx.get("broker") or "paper")
            ctx["health"] = {**(ctx.get("health") or {}), "ok": False, "status": "disconnected"}
            return _redact(ctx)

        cfg: dict[str, Any] = {}
        if broker_name == "dhan":
            cfg = {"use_mock": True, "demo": True}
        elif broker_name == "mock_trading":
            cfg = {"connected": True}
        ctx = await fetch_provider_account_context(broker_name, config=cfg)
        # Prefer explicit user/gateway broker status when provided
        effective = broker_status if broker_status in {"connected", "disconnected"} else ctx.get("status")
        ctx["status"] = effective
        ctx["broker"] = broker_name
        ctx["health"] = {
            **(ctx.get("health") or {}),
            "ok": effective == "connected",
            "status": effective,
        }
        ctx["live_order_execution"] = False
        # Merge MCP advisory mode if present
        if mcp_hint:
            ctx["mcp_advisory"] = {
                "advisory_mode": mcp_hint.get("advisory_mode"),
                "live_trading_enabled": False,
                "available_brokers": mcp_hint.get("available_brokers") or [],
            }
        return _redact(ctx)

    def detect_market_regime(
        self, market_ctx: dict[str, Any], broker_ctx: dict[str, Any], user_ctx: dict[str, Any]
    ) -> dict[str, Any]:
        risk = user_ctx.get("risk_profile") or {}
        available = float((broker_ctx.get("margins") or {}).get("available") or (user_ctx.get("margin") or {}).get("available") or 0)
        return self.market_engine.evaluate(
            bars=market_ctx.get("bars") or [],
            market_status=market_ctx.get("market_status") or "unknown",
            broker_status=broker_ctx.get("status") or "disconnected",
            data_stale=bool(market_ctx.get("data_stale")),
            risk_profile_completed=bool(risk.get("completed")),
            available_margin=available,
            extras={"breadth": market_ctx.get("breadth"), "sectors": market_ctx.get("sectors")},
        )

    def generate_advisory_options(
        self, regime_pack: dict[str, Any], user_ctx: dict[str, Any], broker_ctx: dict[str, Any]
    ) -> list[dict[str, Any]]:
        available = float((broker_ctx.get("margins") or {}).get("available") or 0)
        regime = regime_pack["regime"]
        regime_dict = regime.model_dump() if hasattr(regime, "model_dump") else regime
        return self.reco_engine.generate_options(
            option_types=regime_pack["option_types"],
            regime=regime_dict,
            available_margin=available,
            paper_only=regime_pack["paper_only"],
            guardrails=regime_pack["guardrails"],
        )

    def score_recommendations(
        self, options: list[dict[str, Any]], regime_pack: dict[str, Any]
    ) -> list[dict[str, Any]]:
        # Adjust confidence by data quality / regime, then rank to 3–5 algos
        vol = regime_pack["regime"].volatility if hasattr(regime_pack["regime"], "volatility") else "moderate"
        scored = []
        for o in options:
            conf = float(o["confidence_score"])
            if vol in ("high", "extreme"):
                conf *= 0.9
            if regime_pack.get("force_no_trade") and o.get("recommendation_type") != "no_trade":
                conf *= 0.5
            o = {**o, "confidence_score": round(min(conf, 0.95), 2)}
            scored.append(o)
        ranked = self.ranking.rank(
            scored,
            force_no_trade=bool(regime_pack.get("force_no_trade")),
            min_options=3,
            max_options=5,
        )
        recommendations_generated_count.inc(len(ranked))
        return ranked

    def persist_advisory(
        self,
        tenant_id: str,
        user_id: str,
        user_ctx: dict[str, Any],
        market_ctx: dict[str, Any],
        broker_ctx: dict[str, Any],
        regime_pack: dict[str, Any],
        recommendations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        today = date.today()
        existing = self.store.get_daily_session(tenant_id, user_id, today)
        sid = existing["id"] if existing else str(uuid4())
        regime = regime_pack["regime"]
        regime_json = regime.model_dump() if hasattr(regime, "model_dump") else regime
        summary = self._summary(regime_json, regime_pack["guardrails"], broker_ctx)
        now = datetime.now(timezone.utc)
        session = {
            "id": sid,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "account_id": user_ctx.get("account_id"),
            "advisory_date": today.isoformat(),
            "market": user_ctx.get("market") or "NSE",
            "broker": broker_ctx.get("broker") or "unknown",
            "status": AdvisoryStatus.READY.value,
            "summary": summary,
            "model_version": "deterministic+llm-optional",
            "prompt_version": PROMPT_VERSION,
            "generated_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=24)).isoformat(),
            "created_at": now.isoformat(),
            "market_status": market_ctx.get("market_status"),
            "broker_status": broker_ctx.get("status"),
            "risk_profile": (user_ctx.get("risk_profile") or {}).get("level") or "unknown",
            "snapshot": {
                "portfolio_snapshot_json": user_ctx.get("portfolio"),
                "margin_snapshot_json": broker_ctx.get("margins") or user_ctx.get("margin"),
                "risk_profile_json": user_ctx.get("risk_profile"),
                "market_snapshot_json": {
                    "status": market_ctx.get("market_status"),
                    "stale": market_ctx.get("data_stale"),
                    "as_of": market_ctx.get("as_of"),
                },
                "active_strategy_snapshot_json": {"items": user_ctx.get("active_strategies")},
                "broker_health_json": broker_ctx.get("health"),
                "market_regime_json": regime_json,
                "data_sources_json": {"prompt": PROMPT_VERSION, "system": "compliance-aware"},
            },
            "warnings": regime_pack["guardrails"],
        }
        self.store.upsert_session(session)
        # replace recommendations for session
        for r in list(self.store.recommendations.values()):
            if r.get("advisory_session_id") == sid:
                del self.store.recommendations[r["id"]]
        for rec in recommendations:
            self.store.add_recommendation({**rec, "advisory_session_id": sid})
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "advisory_generated",
                "resource": f"advisory_session:{sid}",
                "details": {"count": len(recommendations), "status": "ready"},
            }
        )
        return session

    async def publish_advisory_generated_event(self, session: dict[str, Any]) -> None:
        await publish_event(
            KafkaTopics.ADVISORY_GENERATED,
            EventEnvelope.create(
                KafkaTopics.ADVISORY_GENERATED,
                session["tenant_id"],
                session["user_id"],
                {"advisory_id": session["id"], "status": session["status"]},
                idempotency_key=f"generated:{session['id']}:{session.get('generated_at')}",
            ),
            self.kafka_bootstrap,
        )

    def to_login_response(self, session: dict[str, Any]) -> dict[str, Any]:
        recs = self.store.list_recommendations(session["id"])
        dto = []
        for r in recs:
            dto.append(
                AdvisoryRecommendationDTO(
                    id=r["id"],
                    title=r["title"],
                    type=r.get("type") or r.get("recommendation_type") or "intraday",
                    symbols=r.get("symbols") or [],
                    confidence_score=float(r.get("confidence_score") or 0),
                    risk_score=float(r.get("risk_score") or 0),
                    required_capital=float(r.get("required_capital") or 0),
                    timeframe=r.get("timeframe") or "5m",
                    rationale=r.get("rationale") or r.get("summary") or "",
                    warnings=r.get("warnings") or [],
                    actions=r.get("actions") or [],
                    direction=r.get("direction"),
                    expected_holding_period=r.get("expected_holding_period"),
                    max_loss_estimate=r.get("max_loss_estimate"),
                    stop_loss_required=bool(r.get("stop_loss_required", True)),
                    target_required=bool(r.get("target_required", True)),
                    explanation=r.get("explanation"),
                    paper_only=True,
                ).model_dump()
            )
        status_raw = session.get("status") or AdvisoryStatus.PREPARING.value
        try:
            status = AdvisoryStatus(status_raw)
        except ValueError:
            status = AdvisoryStatus.PREPARING
        resp = LoginAdvisoryResponse(
            advisory_id=session["id"],
            status=status,
            generated_at=datetime.fromisoformat(session["generated_at"]) if session.get("generated_at") else None,
            market_status=session.get("market_status") or "unknown",
            broker_status=session.get("broker_status") or "unknown",
            risk_profile=session.get("risk_profile") or "unknown",
            summary=session.get("summary") or "",
            recommendations=dto,  # type: ignore[arg-type]
            warnings=session.get("warnings") or [],
        )
        return resp.model_dump(mode="json")

    async def convert_to_algo(
        self, tenant_id: str, user_id: str, advisory_id: str, recommendation_id: str
    ) -> dict[str, Any]:
        session = self.store.get_session(advisory_id)
        if not session or session["tenant_id"] != tenant_id or session["user_id"] != user_id:
            raise PermissionError("Advisory not found for tenant/user")
        rec = self.store.recommendations.get(recommendation_id)
        if not rec or rec["advisory_session_id"] != advisory_id:
            raise KeyError("Recommendation not found")
        strategy = self.converter.convert(rec, created_by=user_id)
        payload = self.converter.to_option_payload(
            rec,
            strategy,
            tenant_id=tenant_id,
            user_id=user_id,
            recommendation_id=recommendation_id,
        )
        option = self.store.add_strategy_option(payload)
        strategies_converted_count.inc()
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "strategy_converted",
                "resource": f"strategy_option:{option['id']}",
                "details": {
                    "recommendation_id": recommendation_id,
                    "paper_test_required": True,
                    "strategy_id": strategy.strategy_id,
                    "strategy_type": strategy.strategy_type,
                },
            }
        )
        await publish_event(
            KafkaTopics.STRATEGY_GENERATED_FROM_ADVISORY,
            EventEnvelope.create(
                KafkaTopics.STRATEGY_GENERATED_FROM_ADVISORY,
                tenant_id,
                user_id,
                {
                    "strategy_option_id": option["id"],
                    "advisory_id": advisory_id,
                    "strategy_id": strategy.strategy_id,
                },
                idempotency_key=f"conv:{option['id']}",
            ),
            self.kafka_bootstrap,
        )
        return option

    def request_live_approval(
        self,
        tenant_id: str,
        user_id: str,
        strategy_option_id: str,
        *,
        risk_disclosure_accepted: bool,
        explicit_confirmation: bool,
        ip_address: str | None = None,
        paper_qualified: bool = False,
        kill_switch: bool = False,
        live_env_enabled: bool = False,
        admin_approved: bool = False,
    ) -> dict[str, Any]:
        option = self.store.get_strategy_option(strategy_option_id)
        if not option or option["tenant_id"] != tenant_id or option["user_id"] != user_id:
            raise PermissionError("Strategy option not found")
        blocks: list[str] = []
        if not risk_disclosure_accepted:
            blocks.append("Risk disclosure not accepted")
        if not explicit_confirmation:
            blocks.append("Explicit live confirmation required")
        if not option.get("paper_test_required") is False and not paper_qualified:
            # paper_test_required defaults True; require qualification
            blocks.append("Paper qualification required before live")
        if option.get("source_license_status") in ("license_unknown", "not_verified"):
            blocks.append("External/unknown license cannot deploy live")
        if option.get("source_type") == "third_party_strategy_candidate" and option.get("source_license_status") != "license_validated":
            blocks.append("Third-party strategy not license-validated for live")
        risk_rules = option.get("risk_rules_json") or []
        if isinstance(risk_rules, dict):
            # Phase 1 RiskRules dump — options selling off by default
            if risk_rules.get("allow_options_selling"):
                blocks.append("Unlimited-loss options strategy blocked for live by default")
        elif any(
            isinstance(r, dict) and r.get("type") == "unbounded_options_risk" for r in risk_rules
        ):
            blocks.append("Unlimited-loss options strategy blocked for live by default")
        if kill_switch:
            blocks.append("Kill switch active")
        if not live_env_enabled:
            blocks.append("LIVE_TRADING_ENABLED is false")
        if not admin_approved:
            blocks.append("Admin/RMS live approval missing")
        if not option.get("saved"):
            blocks.append("Strategy must be saved before live request")

        status = "blocked" if blocks else "queued_for_oms"
        req = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "strategy_option_id": strategy_option_id,
            "status": status,
            "block_reasons": blocks,
            "explicit_confirmation": explicit_confirmation,
            "oms_handoff": None if blocks else {
                "queued_at": datetime.now(timezone.utc).isoformat(),
                "note": "Handoff to OMS — advisory never places broker orders",
            },
        }
        self.store.live_requests[req["id"]] = req
        approval = {
            "strategy_option_id": strategy_option_id,
            "user_id": user_id,
            "approval_type": "live_request",
            "ip_address": ip_address,
            "risk_disclosure_accepted": risk_disclosure_accepted,
            "approval_text": "User requested live deployment after paper qualification",
        }
        self.store.approvals.append(approval)
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "live_approval_requested",
                "resource": f"strategy_option:{strategy_option_id}",
                "details": {"status": status, "block_reasons": blocks, "oms_queued": not blocks},
                "ip_address": ip_address,
            }
        )
        live_approval_requested_count.inc()
        return req

    async def _ensure_preparing_session(
        self, tenant_id: str, user_id: str, hint: dict[str, Any]
    ) -> dict[str, Any]:
        today = date.today()
        existing = self.store.get_daily_session(tenant_id, user_id, today)
        if existing and existing.get("status") == AdvisoryStatus.READY.value:
            return existing
        sid = existing["id"] if existing else str(uuid4())
        session = {
            "id": sid,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "advisory_date": today.isoformat(),
            "status": AdvisoryStatus.PREPARING.value,
            "summary": "AI advisory is being prepared",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "market": hint.get("market") or "NSE",
            "broker": hint.get("broker") or "unknown",
            "warnings": [],
        }
        return self.store.upsert_session(session)

    def _summary(self, regime: dict[str, Any], guardrails: list[str], broker_ctx: dict[str, Any]) -> str:
        vol = regime.get("volatility") or "moderate"
        trend = regime.get("trend") or "unknown"
        base = (
            f"Market is {vol} volatility with {trend} bias. "
            "Prefer controlled strategies with strict stop-loss. "
            "This is not a profit guarantee."
        )
        if guardrails:
            base += " Notes: " + "; ".join(guardrails[:3])
        if broker_ctx.get("status") != "connected":
            base += " Broker disconnected — paper-only."
        return base

    def build_llm_prompt(self, user_ctx: dict[str, Any], market_ctx: dict[str, Any], regime_pack: dict[str, Any]) -> dict[str, str]:
        regime = regime_pack["regime"]
        regime_dict = regime.model_dump() if hasattr(regime, "model_dump") else regime
        user = ADVISORY_USER_TEMPLATE.format(
            risk_profile=(user_ctx.get("risk_profile") or {}).get("level"),
            broker_status=user_ctx.get("broker_status") or "unknown",
            margin=(user_ctx.get("margin") or {}).get("available"),
            holdings_count=(user_ctx.get("portfolio") or {}).get("holdings_count") or 0,
            market=user_ctx.get("market"),
            strategy_performance=user_ctx.get("strategy_performance"),
            market_status=market_ctx.get("market_status"),
            volatility=regime_dict.get("volatility"),
            trend=regime_dict.get("trend"),
            volume_anomaly=(regime_dict.get("signals") or {}).get("volume_anomaly"),
            sectors=market_ctx.get("sectors"),
            data_stale=market_ctx.get("data_stale"),
        )
        return {"system": ADVISORY_SYSTEM_PROMPT, "user": user}
