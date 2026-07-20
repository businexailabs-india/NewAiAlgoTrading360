"""DhanLaxmi orchestration — never places trades without approval."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from advisory_core.security import mask_account, redact_secrets
from intent_core import IntentClassifier, IntentType
from language_core import LanguageDetector, LanguageCode
from localized_response_templates import build_response, get_disclaimer
from prompt_to_strategy import PromptToStrategyConverter
from safety_guardrails import SafetyGuardrailEngine
from schemas.strategy import StrategyConfig
from strategy_engine import StrategyEngine
from trade_command_parser import TradingCommandParser

from app.llm import LLMRouter
from app.store import InMemoryDhanLaxmiStore, get_store
from app.telemetry import (
    blocked_live_trades,
    commands_total,
    guardrail_triggers,
    intent_latency,
    llm_latency,
    timed,
    trade_approvals_approved,
    trade_approvals_rejected,
    trade_approvals_requested,
)

logger = logging.getLogger("dhanlaxmi")


STRATEGY_FAMILIES = {
    "ma_crossover": "Moving Average Crossover",
    "vwap_breakout": "VWAP Breakout",
    "rsi_mean_reversion": "RSI Mean Reversion",
    "opening_range_breakout": "Opening Range Breakout",
    "supertrend": "Supertrend",
    "bollinger_mean_reversion": "Bollinger Mean Reversion",
    "options_straddle_monitor": "Options Straddle Monitor",
    "options_strangle_monitor": "Options Strangle Monitor",
    "portfolio_rebalance": "Portfolio Rebalance",
}


class DhanLaxmiService:
    def __init__(
        self,
        store: InMemoryDhanLaxmiStore | None = None,
        engine: StrategyEngine | None = None,
    ):
        self.store = store or get_store()
        self.lang = LanguageDetector()
        self.intents = IntentClassifier()
        self.parser = TradingCommandParser()
        self.guardrails = SafetyGuardrailEngine()
        self.llm = LLMRouter()
        self.prompt_converter = PromptToStrategyConverter()
        self.engine = engine or StrategyEngine()

    def collect_context(self, hint: dict[str, Any] | None = None) -> dict[str, Any]:
        h = hint or {}
        account = h.get("account_id") or h.get("broker_account")
        dhan_status = h.get("dhan_status") or h.get("provider_status") or {}
        # Prefer MCP gateway provider context when present (YAML-resolved)
        mcp_ctx = h.get("mcp_provider_context") or h.get("provider_context") or {}
        broker = h.get("broker") or mcp_ctx.get("preferred_broker")
        if not broker:
            broker = "dhan" if dhan_status else "paper"
        # Never accept raw secrets from hints
        return redact_secrets(
            {
                "broker_status": h.get("broker_status")
                or dhan_status.get("health_status")
                or mcp_ctx.get("broker_status")
                or "disconnected",
                "broker": broker,
                "data_stale": bool(h.get("data_stale") or False),
                "risk_profile_completed": bool(h.get("risk_profile_completed", True)),
                "has_permission": bool(h.get("has_permission", True)),
                "kill_switch": bool(h.get("kill_switch") or False),
                "portfolio": h.get("portfolio")
                or {
                    "holdings_count": dhan_status.get("holdings_count", 0),
                    "open_positions_count": dhan_status.get("open_positions_count", 0),
                    "open_orders_count": dhan_status.get("open_orders_count", 0),
                },
                "margin": h.get("margin")
                or {"available": dhan_status.get("available_margin") or 0},
                "market_status": h.get("market_status") or "open",
                "indices": h.get("indices") or [],
                "market_summary_line": h.get("market_summary_line") or "",
                "account_id_masked": mask_account(str(account))
                if account
                else dhan_status.get("masked_client_id"),
                "dhan_status": {
                    k: v
                    for k, v in (dhan_status or {}).items()
                    if k
                    not in (
                        "access_token",
                        "api_key",
                        "password",
                        "totp_secret",
                        "client_secret",
                    )
                },
                "provider_status": {
                    k: v
                    for k, v in (dhan_status or {}).items()
                    if k
                    not in (
                        "access_token",
                        "api_key",
                        "password",
                        "totp_secret",
                        "client_secret",
                    )
                },
                "mcp_provider_context": {
                    k: v
                    for k, v in mcp_ctx.items()
                    if k
                    not in (
                        "access_token",
                        "api_key",
                        "password",
                        "totp_secret",
                        "client_secret",
                    )
                },
                "live_trading_enabled": False,
                "external_algo": bool(h.get("external_algo") or False),
            }
        )

    async def fetch_provider_status(
        self, provider_id: str | None = None, hint: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Resolve provider status via MCP registry (mock-safe). Never returns secrets."""
        from mcp_connectors import fetch_provider_account_context, resolve_preferred_provider

        h = hint or {}
        pid = provider_id or resolve_preferred_provider(
            {"broker": h.get("broker") or "dhan"},
            connected_provider_ids=list((h.get("mcp_provider_context") or {}).get("connected_provider_ids") or []),
        )
        cfg = {"use_mock": True, "demo": True} if pid == "dhan" else {}
        account = await fetch_provider_account_context(pid, config=cfg)
        status = account.get("provider_status") or {
            "provider_id": pid,
            "connected": account.get("status") == "connected",
            "health_status": (account.get("health") or {}).get("status"),
            "available_margin": (account.get("margins") or {}).get("available"),
            "holdings_count": len(account.get("holdings") or []),
            "open_positions_count": len(account.get("positions") or []),
            "live_trading_enabled": False,
            "secrets_included": False,
        }
        return redact_secrets(status)

    async def chat(
        self,
        tenant_id: str,
        user_id: str,
        message: str,
        *,
        conversation_id: str | None = None,
        language_hint: str | None = None,
        mode: str = "web",
        context: dict[str, Any] | None = None,
        voice: bool = False,
    ) -> dict[str, Any]:
        commands_total.labels(mode=mode).inc()
        ctx = self.collect_context(context)
        with timed(intent_latency):
            detection = self.lang.detect(message, language_hint)
            intent = self.intents.classify(message)
            parsed = self.parser.parse(message, detection.language.value)

        lang = detection.language.value
        if detection.language == LanguageCode.UNKNOWN:
            lang = language_hint or "en"

        convo = None
        if conversation_id:
            convo = self.store.get_conversation(conversation_id, tenant_id, user_id)
        if not convo:
            convo = self.store.create_conversation(tenant_id, user_id, lang, mode)
            conversation_id = convo["id"]

        wants_live = parsed.paper_or_live == "live" or intent.intent == IntentType.LIVE_TRADE_REQUEST
        guard = self.guardrails.evaluate(
            text=message,
            intent=intent.intent.value,
            context=ctx,
            wants_live=wants_live,
            has_user_approval=False,
            paper_qualified=False,
            rms_approved=False,
        )
        for f in guard.findings:
            if f.severity == "block":
                guardrail_triggers.labels(code=f.code.value).inc()

        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "command_received",
                "language": lang,
                "intent": intent.intent.value,
                "voice": voice,
            }
        )

        # Hard blocks for profit promise / averaging
        block_codes = {f.code.value for f in guard.findings if f.severity == "block"}
        if "profit_promise" in block_codes or "unlimited_risk" in block_codes:
            finding = next(f for f in guard.findings if f.code.value in block_codes)
            text = finding.user_message_en
            if lang in ("hi", "hinglish", "or"):
                # Prefer localized disclaimer append
                text = f"{finding.user_message_en} {get_disclaimer(lang)}"
            return self._finalize_turn(
                tenant_id,
                user_id,
                conversation_id,
                message,
                lang,
                intent.intent.value,
                intent.confidence,
                text,
                parsed.model_dump(),
                guard.model_dump(),
                cards=[],
            )

        response_payload = await self._route_intent(
            tenant_id,
            user_id,
            conversation_id,
            message,
            lang,
            intent,
            parsed,
            ctx,
            guard,
            wants_live,
        )
        return response_payload

    async def _route_intent(
        self,
        tenant_id: str,
        user_id: str,
        conversation_id: str,
        message: str,
        lang: str,
        intent,
        parsed,
        ctx: dict[str, Any],
        guard,
        wants_live: bool,
    ) -> dict[str, Any]:
        cards: list[dict[str, Any]] = []
        approval = None
        draft = None

        if intent.intent == IntentType.STRATEGY_CREATION:
            built = build_response(
                "strategy_draft_intro",
                lang,
                symbol=parsed.symbol or "the selected symbol",
                next_step="Review the strategy draft, then run a paper test.",
            )
            draft = self.create_strategy_draft(
                tenant_id, user_id, conversation_id, parsed, lang, prompt=message
            )
            cards.append({"type": "strategy_draft", "data": draft})
            text = built["text"]
            self.store.audit(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": "ai_decision_audited",
                    "details": {
                        "intent": "strategy_creation",
                        "strategy_type": draft.get("strategy_type"),
                        "never_executes": True,
                    },
                }
            )
        elif self._is_dhan_status_query(message) or (
            intent.intent in (IntentType.RISK_QUERY, IntentType.PORTFOLIO_QUERY)
            and (ctx.get("broker") == "dhan" or ctx.get("dhan_status"))
        ):
            # Enrich from YAML registry when gateway did not supply status
            if not ctx.get("dhan_status") and not ctx.get("provider_status"):
                status = await self.fetch_provider_status("dhan", ctx)
                ctx["dhan_status"] = status
                ctx["provider_status"] = status
                if status.get("masked_client_id"):
                    ctx["account_id_masked"] = status.get("masked_client_id")
                if status.get("available_margin") is not None:
                    ctx["margin"] = {"available": status.get("available_margin")}
            text = self._dhan_status_reply(ctx, lang)
            cards.append(
                {
                    "type": "dhan_provider_status",
                    "data": {
                        "broker": ctx.get("broker") or "dhan",
                        "broker_status": ctx.get("broker_status"),
                        "masked_client_id": ctx.get("account_id_masked"),
                        "margin": ctx.get("margin"),
                        "portfolio": ctx.get("portfolio"),
                        "live_trading_enabled": False,
                        "dhan_status": ctx.get("dhan_status") or {},
                        "provider_status": ctx.get("provider_status") or ctx.get("dhan_status") or {},
                    },
                }
            )
            self.store.audit(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": "provider_status_queried",
                    "details": {"provider_id": "dhan", "secrets_included": False},
                }
            )
        elif intent.intent == IntentType.RISK_QUERY or intent.intent == IntentType.PORTFOLIO_QUERY:
            built = build_response(
                "portfolio_risk",
                lang,
                action_summary=self._portfolio_summary(ctx),
                next_step="Complete risk profile if incomplete before live ideas.",
            )
            text = built["text"]
            cards.append({"type": "risk_summary", "data": ctx.get("portfolio")})
        elif intent.intent == IntentType.MARKET_QUERY:
            market_line = self._market_summary_line(ctx)
            built = build_response(
                "market_summary",
                lang,
                action_summary=market_line,
                next_step="Ask for a paper-only strategy idea if you want next steps.",
            )
            text = built["text"]
            cards.append(
                {
                    "type": "market_snapshot",
                    "data": {
                        "market_status": ctx.get("market_status"),
                        "indices": ctx.get("indices") or [],
                        "broker_status": ctx.get("broker_status"),
                    },
                }
            )
        elif intent.intent in (IntentType.STOP_BOT, IntentType.KILL_SWITCH):
            built = build_response(
                "kill_switch_confirm",
                lang,
                next_step="Confirm on the approval screen to stop bots.",
                approval_status="pending_confirmation",
            )
            approval = self.create_trade_approval(
                tenant_id,
                user_id,
                conversation_id,
                lang,
                order_preview={"action": "kill_switch", "scope": "all_bots"},
                risk_summary={"severity": "high", "note": "Stops all automated trading"},
                kind="kill_switch",
            )
            cards.append({"type": "approval", "data": approval})
            text = built["text"]
        elif intent.intent == IntentType.PAPER_TRADE_REQUEST:
            built = build_response(
                "paper_first",
                lang,
                action_summary="Paper test request acknowledged.",
                next_step="Select or create a strategy draft to paper test.",
            )
            text = built["text"]
            cards.append({"type": "paper_test", "data": {"status": "ready_to_request"}})
        elif wants_live or intent.intent == IntentType.LIVE_TRADE_REQUEST or parsed.order_side:
            blocked_live_trades.inc()
            preview = self._order_preview(parsed, ctx)
            preview["executed"] = False
            preview["live_trading_enabled"] = False
            preview["requires_approval"] = True
            preview["risk_warning"] = (
                "Trading involves risk of loss. This is an order preview only — "
                "DhanLaxmi never auto-executes. Live trading is disabled."
            )
            built = build_response(
                "order_preview",
                lang,
                next_step="Approve, reject, or modify on the approval screen.",
                approval_status="pending",
            )
            approval = self.create_trade_approval(
                tenant_id,
                user_id,
                conversation_id,
                lang,
                order_preview=preview,
                risk_summary={
                    "max_loss": parsed.risk_limit,
                    "stop_loss": parsed.stop_loss,
                    "target": parsed.target,
                    "warnings": [f.user_message_en for f in guard.findings]
                    + [preview["risk_warning"]],
                    "live_trading_enabled": False,
                    "executed": False,
                },
                kind="order",
            )
            cards.append({"type": "order_preview", "data": preview})
            cards.append({"type": "approval", "data": approval})
            text = f"{built['text']} Risk warning: live trading is disabled. Approval required."
            self.store.audit(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": "ai_decision_audited",
                    "details": {
                        "intent": "direct_buy_blocked",
                        "executed": False,
                        "order_preview_only": True,
                    },
                }
            )
        else:
            with timed(llm_latency):
                llm_text, meta = await self.llm.generate_response(
                    message, {"language": lang, "intent": intent.intent.value, **ctx}
                )
            greeting = build_response("greeting", lang)
            text = f"{llm_text} {get_disclaimer(lang)}"
            if intent.intent == IntentType.UNKNOWN_INTENT:
                text = f"{greeting['text']} {get_disclaimer(lang)}"

        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "response_generated",
                "intent": intent.intent.value,
                "language": lang,
            }
        )
        return self._finalize_turn(
            tenant_id,
            user_id,
            conversation_id,
            message,
            lang,
            intent.intent.value,
            intent.confidence,
            text,
            parsed.model_dump(),
            guard.model_dump(),
            cards=cards,
            approval_id=approval["id"] if approval else None,
            draft_id=draft["id"] if draft else None,
        )

    def _finalize_turn(
        self,
        tenant_id: str,
        user_id: str,
        conversation_id: str,
        raw_text: str,
        language: str,
        intent: str,
        confidence: float,
        response_text: str,
        parsed: dict[str, Any],
        guard: dict[str, Any],
        cards: list[dict[str, Any]],
        approval_id: str | None = None,
        draft_id: str | None = None,
    ) -> dict[str, Any]:
        self.store.add_message(
            conversation_id,
            {
                "sender": "user",
                "input_type": "text",
                "language": language,
                "raw_text": raw_text,
                "intent": intent,
                "confidence_score": confidence,
            },
        )
        self.store.add_message(
            conversation_id,
            {
                "sender": "dhanlaxmi",
                "input_type": "chat",
                "language": language,
                "response_text": response_text,
                "intent": intent,
                "confidence_score": confidence,
            },
        )
        return {
            "conversation_id": conversation_id,
            "language": language,
            "intent": intent,
            "confidence": confidence,
            "response_text": response_text,
            "disclaimer": get_disclaimer(language),
            "parsed_command": parsed,
            "guardrails": guard,
            "cards": cards,
            "approval_id": approval_id,
            "strategy_draft_id": draft_id,
            "never_auto_executes": True,
            "paper_first": True,
        }

    def create_strategy_draft(
        self,
        tenant_id: str,
        user_id: str,
        conversation_id: str,
        parsed,
        language: str,
        prompt: str | None = None,
    ) -> dict[str, Any]:
        text = prompt or f"{parsed.symbol or 'RELIANCE'} {parsed.strategy_type or 'vwap'} algo"
        draft = self.prompt_converter.to_draft(
            text,
            language=language,
            symbol=parsed.symbol,
            strategy_type=parsed.strategy_type or None,
            timeframe=parsed.timeframe or "5m",
            created_by=user_id,
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        if parsed.risk_limit:
            for rr in draft.get("risk_rules") or []:
                if rr.get("type") == "daily_max_loss":
                    rr["value"] = parsed.risk_limit
        draft["exchange"] = parsed.exchange or draft.get("exchange") or "NSE"
        label = STRATEGY_FAMILIES.get(draft["strategy_type"])
        if label and draft.get("symbol"):
            draft["title"] = f"{label} — {draft['symbol']}"
        draft["created_at"] = datetime.now(timezone.utc).isoformat()
        draft["never_executes"] = True
        draft["live_enabled"] = False
        draft["live_trading_enabled"] = False
        self.store.save_draft(draft)
        # Persist Phase-1 StrategyConfig in engine for paper tests
        cfg_data = draft.get("strategy_config") or {}
        try:
            strategy = StrategyConfig.model_validate(cfg_data)
            strategy.live_trading_enabled = False
            strategy.paper_trading_required = True
            self.engine.save_strategy(strategy)
            draft["strategy_id"] = strategy.strategy_id
            self.store.save_draft(draft)
        except Exception:
            pass
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "strategy_draft_created",
                "resource": draft["id"],
                "details": {
                    "strategy_type": draft.get("strategy_type"),
                    "symbol": draft.get("symbol"),
                    "json_validated": True,
                    "never_executes": True,
                },
            }
        )
        return draft

    def run_paper_test(
        self,
        tenant_id: str,
        user_id: str,
        strategy_draft_id: str,
        *,
        bars: int = 120,
        regime: str = "trending",
    ) -> dict[str, Any]:
        draft = self.store.strategy_drafts.get(strategy_draft_id)
        if not draft or draft.get("tenant_id") != tenant_id:
            raise KeyError("Strategy draft not found")
        cfg_data = draft.get("strategy_config")
        if not cfg_data:
            strategy = self.prompt_converter.to_strategy_config(
                draft.get("prompt") or draft.get("symbol") or "RELIANCE",
                symbol=draft.get("symbol"),
                strategy_type=draft.get("strategy_type"),
                timeframe=draft.get("timeframe") or "5m",
                created_by=user_id,
            )
            cfg_data = strategy.model_dump(mode="json")
            draft["strategy_config"] = cfg_data
        strategy = StrategyConfig.model_validate(cfg_data)
        strategy.live_trading_enabled = False
        strategy.paper_trading_required = True
        self.engine.save_strategy(strategy)
        report = self.engine.paper_test(strategy.strategy_id, bars=bars, regime=regime)
        perf = report.performance
        result = {
            "strategy_draft_id": strategy_draft_id,
            "strategy_id": strategy.strategy_id,
            "status": "completed",
            "paper_only": True,
            "live_trading_enabled": False,
            "metrics": {
                "pnl": float(perf.total_pnl),
                "max_drawdown": float(perf.max_drawdown),
                "trade_count": int(perf.number_of_trades),
                "win_rate": float(perf.win_rate),
                "orders_placed": int(report.orders_placed),
                "qualified_for_live": False,
            },
            "report": report.model_dump(mode="json"),
            "explanation": "Paper test completed via StrategyEngine. Live trading remains disabled.",
            "disclaimer": "Paper results are simulated and not a guarantee of future performance.",
            "risk_warning": strategy.risk_warning,
        }
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "paper_test_completed",
                "resource": strategy_draft_id,
                "details": {
                    "strategy_id": strategy.strategy_id,
                    "trade_count": result["metrics"]["trade_count"],
                    "qualified_for_live": False,
                },
            }
        )
        return result

    def create_trade_approval(
        self,
        tenant_id: str,
        user_id: str,
        conversation_id: str,
        language: str,
        order_preview: dict[str, Any],
        risk_summary: dict[str, Any],
        kind: str = "order",
    ) -> dict[str, Any]:
        trade_approvals_requested.inc()
        approval = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "strategy_id": order_preview.get("strategy_id"),
            "kind": kind,
            "order_preview_json": redact_secrets(order_preview),
            "risk_summary_json": risk_summary,
            "margin_estimate_json": {
                "estimated_margin": order_preview.get("estimated_margin", 0),
                "currency": "INR",
            },
            "approval_status": "pending",
            "approval_language": language,
            "approval_text": build_response("order_preview", language)["text"],
            "approved_at": None,
            "rejected_at": None,
            "rms_status": "not_submitted",
            "oms_status": "not_submitted",
            "requires_otp_or_biometric": kind in ("order", "live", "kill_switch"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.store.save_approval(approval)
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "trade_approval_requested",
                "resource": approval["id"],
            }
        )
        return approval

    def approve(
        self,
        tenant_id: str,
        user_id: str,
        approval_id: str,
        *,
        otp_or_biometric_ok: bool = False,
        explicit_confirmation: bool = False,
        rms_approved: bool = False,
        live_env_enabled: bool = False,
    ) -> dict[str, Any]:
        row = self.store.get_approval(approval_id, tenant_id, user_id)
        if not row:
            return {"status": "not_found"}
        if not explicit_confirmation:
            return {**row, "status": "blocked", "block_reasons": ["explicit_confirmation_required"]}
        if row.get("requires_otp_or_biometric") and not otp_or_biometric_ok:
            return {**row, "status": "blocked", "block_reasons": ["otp_or_biometric_required"]}

        # User approval recorded — still must pass RMS before OMS
        row["approval_status"] = "user_approved"
        row["approved_at"] = datetime.now(timezone.utc).isoformat()
        trade_approvals_approved.inc()
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "approval_accepted",
                "resource": approval_id,
            }
        )

        if not rms_approved:
            row["rms_status"] = "rejected"
            row["oms_status"] = "blocked"
            self.store.save_approval(row)
            self.store.audit(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": "rms_rejected",
                    "resource": approval_id,
                }
            )
            return {
                **row,
                "status": "blocked",
                "block_reasons": ["rms_rejection_blocks_oms"],
                "message": "User approved, but RMS rejected — OMS was not called.",
            }

        if row.get("kind") in ("order", "live") and not live_env_enabled:
            row["oms_status"] = "blocked"
            self.store.save_approval(row)
            return {
                **row,
                "status": "blocked",
                "block_reasons": ["live_trading_disabled"],
            }

        from live_risk_gate import LiveRiskControls, evaluate_live_order

        order = dict(row.get("order_preview_json") or {})
        decision = evaluate_live_order(order, controls=LiveRiskControls())
        if not decision.allowed:
            row["rms_status"] = "rejected"
            row["oms_status"] = "blocked"
            self.store.save_approval(row)
            return {
                **row,
                "status": "blocked",
                "block_reasons": ["rms_rejection_blocks_oms"] + decision.reasons,
            }

        row["rms_status"] = "approved"
        row["rms_approval_id"] = decision.rms_approval_id
        row["oms_status"] = "queued_for_oms"
        row["approval_status"] = "rms_approved_oms_queued"
        # DhanLaxmi never calls broker directly — OMS owns execution
        connection_id = order.get("connection_id") or row.get("connection_id")
        oms_url = os.getenv("OMS_EXECUTION_URL", "").rstrip("/")
        if connection_id and oms_url and live_env_enabled:
            try:
                import httpx
                from advisory_core.security import ServiceAuth
                from uuid import uuid4 as _uuid4

                hmac_auth = ServiceAuth(os.getenv("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me"))
                headers = hmac_auth.sign(tenant_id, user_id, "oms_service", str(_uuid4()))
                with httpx.Client(timeout=30.0) as client:
                    oms_resp = client.post(
                        f"{oms_url}/oms/execute",
                        headers=headers,
                        json={
                            "connection_id": connection_id,
                            "order": order,
                            "user_approval_id": approval_id,
                            "rms_approval_id": decision.rms_approval_id,
                            "run_rms": False,
                        },
                    )
                if oms_resp.status_code < 400:
                    row["oms_status"] = "submitted"
                    row["oms_result"] = redact_secrets(oms_resp.json().get("data") or {})
                else:
                    row["oms_status"] = "oms_error"
                    row["oms_error"] = oms_resp.text[:200]
            except Exception as exc:  # noqa: BLE001
                row["oms_status"] = "oms_unreachable"
                row["oms_error"] = str(exc)[:200]
        self.store.save_approval(row)
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "oms_queued",
                "resource": approval_id,
                "details": {"oms_status": row["oms_status"]},
            }
        )
        return {**row, "status": "approved_pending_execution_router"}

    def reject(self, tenant_id: str, user_id: str, approval_id: str) -> dict[str, Any]:
        row = self.store.get_approval(approval_id, tenant_id, user_id)
        if not row:
            return {"status": "not_found"}
        row["approval_status"] = "rejected"
        row["rejected_at"] = datetime.now(timezone.utc).isoformat()
        trade_approvals_rejected.inc()
        self.store.save_approval(row)
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "approval_rejected",
                "resource": approval_id,
            }
        )
        return row

    def _order_preview(self, parsed, ctx: dict[str, Any]) -> dict[str, Any]:
        return {
            "symbol": parsed.symbol or "UNKNOWN",
            "exchange": parsed.exchange or "NSE",
            "side": parsed.order_side or "BUY",
            "quantity": parsed.quantity or 0,
            "order_type": "LIMIT",
            "product_type": parsed.product_type or "MIS",
            "estimated_price": None,
            "estimated_margin": 0,
            "stop_loss": parsed.stop_loss,
            "target": parsed.target,
            "max_loss": parsed.risk_limit,
            "broker_account": ctx.get("account_id_masked"),
            "mode": "paper" if parsed.paper_or_live != "live" else "live_requires_gates",
            "risk_warning": get_disclaimer(parsed.language or "en"),
        }

    def _portfolio_summary(self, ctx: dict[str, Any]) -> str:
        p = ctx.get("portfolio") or {}
        return (
            f"Holdings: {p.get('holdings_count', 0)}. "
            f"Broker: {ctx.get('broker_status')}. "
            f"Margin available context loaded (redacted)."
        )

    def _is_dhan_status_query(self, message: str) -> bool:
        text = (message or "").lower()
        needles = (
            "dhan account",
            "dhan status",
            "mera dhan",
            "dhan account status",
            "dhanhq",
            "dhan broker",
        )
        return any(n in text for n in needles)

    def _dhan_status_reply(self, ctx: dict[str, Any], lang: str) -> str:
        dhan = ctx.get("dhan_status") or {}
        status = ctx.get("broker_status") or dhan.get("health_status") or "unknown"
        masked = ctx.get("account_id_masked") or dhan.get("masked_client_id") or "****"
        margin = (ctx.get("margin") or {}).get("available")
        if margin is None:
            margin = dhan.get("available_margin")
        holdings = (ctx.get("portfolio") or {}).get("holdings_count", dhan.get("holdings_count", 0))
        positions = (ctx.get("portfolio") or {}).get(
            "open_positions_count", dhan.get("open_positions_count", 0)
        )
        # Hinglish-friendly default; keep secrets out
        if str(lang).startswith("hi") or "dhan" in str(ctx.get("broker") or "").lower():
            return (
                f"Aapka Dhan account status: {status}. "
                f"Masked client id: {masked}. "
                f"Available margin (approx): {margin}. "
                f"Holdings: {holdings}, open positions: {positions}. "
                f"Live trading abhi disabled hai — sirf preview/paper allowed."
            )
        return (
            f"Your Dhan account status is {status}. "
            f"Masked client id: {masked}. "
            f"Available margin (approx): {margin}. "
            f"Holdings: {holdings}, open positions: {positions}. "
            f"Live trading remains disabled by default."
        )

    def _market_summary_line(self, ctx: dict[str, Any]) -> str:
        preset = (ctx.get("market_summary_line") or "").strip()
        if preset:
            return preset
        indices = ctx.get("indices") or []
        parts: list[str] = []
        for row in indices[:6]:
            if not isinstance(row, dict):
                continue
            name = row.get("name") or row.get("symbol") or "Index"
            value = row.get("value")
            change = row.get("change")
            pct = row.get("changePercent")
            if value is None:
                continue
            try:
                value_s = f"{float(value):,.2f}"
            except (TypeError, ValueError):
                value_s = str(value)
            move = ""
            try:
                if pct is not None:
                    move = f" ({float(pct):+.2f}%)"
                elif change is not None:
                    move = f" ({float(change):+.2f})"
            except (TypeError, ValueError):
                move = ""
            parts.append(f"{name}: {value_s}{move}")
        status = ctx.get("market_status") or "unknown"
        broker = ctx.get("broker_status") or "unknown"
        head = f"Market status: {status}. Broker: {broker}."
        if not parts:
            return f"{head} Live index levels were unavailable — open Market Overview for quotes."
        return f"{head} Indices — {'; '.join(parts)}."
