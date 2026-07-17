"""DhanLaxmi orchestration — never places trades without approval."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from advisory_core.security import mask_account, redact_secrets
from intent_core import IntentClassifier, IntentType
from language_core import LanguageDetector, LanguageCode
from localized_response_templates import build_response, get_disclaimer
from safety_guardrails import SafetyGuardrailEngine
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
    def __init__(self, store: InMemoryDhanLaxmiStore | None = None):
        self.store = store or get_store()
        self.lang = LanguageDetector()
        self.intents = IntentClassifier()
        self.parser = TradingCommandParser()
        self.guardrails = SafetyGuardrailEngine()
        self.llm = LLMRouter()

    def collect_context(self, hint: dict[str, Any] | None = None) -> dict[str, Any]:
        h = hint or {}
        account = h.get("account_id") or h.get("broker_account")
        return redact_secrets(
            {
                "broker_status": h.get("broker_status") or "disconnected",
                "data_stale": bool(h.get("data_stale") or False),
                "risk_profile_completed": bool(h.get("risk_profile_completed", True)),
                "has_permission": bool(h.get("has_permission", True)),
                "kill_switch": bool(h.get("kill_switch") or False),
                "portfolio": h.get("portfolio") or {"holdings_count": 0},
                "margin": h.get("margin") or {"available": 0},
                "market_status": h.get("market_status") or "open",
                "indices": h.get("indices") or [],
                "market_summary_line": h.get("market_summary_line") or "",
                "account_id_masked": mask_account(str(account)) if account else None,
                "external_algo": bool(h.get("external_algo") or False),
            }
        )

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
            draft = self.create_strategy_draft(tenant_id, user_id, conversation_id, parsed, lang)
            cards.append({"type": "strategy_draft", "data": draft})
            text = built["text"]
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
                order_preview=self._order_preview(parsed, ctx),
                risk_summary={
                    "max_loss": parsed.risk_limit,
                    "stop_loss": parsed.stop_loss,
                    "target": parsed.target,
                    "warnings": [f.user_message_en for f in guard.findings],
                },
                kind="order",
            )
            cards.append({"type": "approval", "data": approval})
            text = built["text"]
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
    ) -> dict[str, Any]:
        stype = parsed.strategy_type or "vwap_breakout"
        draft = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "strategy_type": stype,
            "title": STRATEGY_FAMILIES.get(stype, stype),
            "symbol": parsed.symbol or "RELIANCE",
            "exchange": parsed.exchange or "NSE",
            "timeframe": parsed.timeframe or "5m",
            "entry_rules": [
                {"indicator": "vwap", "condition": "price_above", "volume_confirmation": True}
            ],
            "exit_rules": [
                {"type": "stop_loss_atr", "multiplier": 1.5},
                {"type": "target_rr", "ratio": 2.0},
            ],
            "risk_rules": [
                {"type": "stop_loss", "required": True},
                {"type": "daily_max_loss", "value": parsed.risk_limit or 2000},
                {"type": "anti_lookahead", "value": True},
            ],
            "paper_only": True,
            "live_enabled": False,
            "language": language,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.store.save_draft(draft)
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "strategy_draft_created",
                "resource": draft["id"],
            }
        )
        return draft

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

        row["rms_status"] = "approved"
        row["oms_status"] = "created_preview_only"
        row["approval_status"] = "rms_approved_oms_queued"
        # DhanLaxmi never calls broker directly — OMS/execution router owns that
        self.store.save_approval(row)
        self.store.audit(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": "oms_preview_created",
                "resource": approval_id,
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
