"""Safety guardrails for DhanLaxmi — never auto-execute live trades."""

from __future__ import annotations

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class GuardrailCode(str, Enum):
    PROFIT_PROMISE = "profit_promise"
    DIRECT_LIVE_EXECUTION = "direct_live_execution"
    MISSING_APPROVAL = "missing_approval"
    UNLIMITED_RISK = "unlimited_risk"
    STALE_DATA = "stale_data"
    BROKER_DISCONNECTED = "broker_disconnected"
    MISSING_PERMISSION = "missing_permission"
    KILL_SWITCH = "kill_switch"
    RMS_REJECT = "rms_reject"
    MISSING_RISK_PROFILE = "missing_risk_profile"
    EXTERNAL_WITHOUT_PAPER = "external_without_paper"
    PAPER_REQUIRED = "paper_required"


PROFIT_RE = re.compile(
    r"(guaranteed?\s+profit|guaranteed?\s+return|sure\s+profit|loss\s+nahi|"
    r"100%\s+profit|risk[- ]?free\s+profit|double\s+money)",
    re.I,
)
AVERAGING_RE = re.compile(r"(double\s+quantity|loss\s+cover|averag(e|ing)\s+down)", re.I)


class GuardrailFinding(BaseModel):
    code: GuardrailCode
    message: str
    severity: str = "block"  # block | warn
    user_message_en: str


class GuardrailResult(BaseModel):
    allowed: bool = True
    findings: list[GuardrailFinding] = Field(default_factory=list)
    force_paper: bool = True
    require_approval: bool = True
    require_confirmation: bool = False

    @property
    def blocked(self) -> bool:
        return not self.allowed


class SafetyGuardrailEngine:
    def evaluate(
        self,
        *,
        text: str,
        intent: str,
        context: dict[str, Any] | None = None,
        wants_live: bool = False,
        has_user_approval: bool = False,
        paper_qualified: bool = False,
        rms_approved: bool = False,
    ) -> GuardrailResult:
        ctx = context or {}
        findings: list[GuardrailFinding] = []
        force_paper = True
        require_approval = True
        require_confirmation = False

        if PROFIT_RE.search(text or ""):
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.PROFIT_PROMISE,
                    message="Rejected guaranteed-profit language",
                    severity="block",
                    user_message_en=(
                        "No trading strategy can guarantee profit. "
                        "I can help you evaluate risk-controlled strategies for paper testing."
                    ),
                )
            )

        if AVERAGING_RE.search(text or ""):
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.UNLIMITED_RISK,
                    message="Averaging-down / double-size increases risk",
                    severity="block",
                    user_message_en=(
                        "This may increase risk. I cannot proceed without checking your "
                        "risk policy and max loss limit."
                    ),
                )
            )

        if ctx.get("kill_switch"):
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.KILL_SWITCH,
                    message="Kill switch active",
                    severity="block",
                    user_message_en="Kill switch is active. Live trading is blocked.",
                )
            )

        if ctx.get("data_stale") and intent in (
            "strategy_creation",
            "paper_trade_request",
            "live_trade_request",
        ):
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.STALE_DATA,
                    message="Stale market data",
                    severity="block",
                    user_message_en="Market data is stale. New trade ideas are paused until data refreshes.",
                )
            )

        if ctx.get("broker_status") == "disconnected" and wants_live:
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.BROKER_DISCONNECTED,
                    message="Broker disconnected",
                    severity="block",
                    user_message_en="Broker is disconnected. Only paper trading is available.",
                )
            )

        if not ctx.get("risk_profile_completed", True):
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.MISSING_RISK_PROFILE,
                    message="Risk profile incomplete",
                    severity="block",
                    user_message_en="Please complete your risk profile before trading advisories.",
                )
            )

        if not ctx.get("has_permission", True):
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.MISSING_PERMISSION,
                    message="Missing trading permission",
                    severity="block",
                    user_message_en="You do not have permission for this action.",
                )
            )

        if intent in ("live_trade_request",) or wants_live:
            require_approval = True
            if not paper_qualified:
                findings.append(
                    GuardrailFinding(
                        code=GuardrailCode.PAPER_REQUIRED,
                        message="Paper qualification required",
                        severity="block",
                        user_message_en=(
                            "I can prepare a live deployment request, but first the strategy must "
                            "pass paper testing, risk checks, and your explicit approval."
                        ),
                    )
                )
            if not has_user_approval:
                findings.append(
                    GuardrailFinding(
                        code=GuardrailCode.MISSING_APPROVAL,
                        message="Explicit user approval required",
                        severity="block",
                        user_message_en="I have prepared an order preview. Please review and approve.",
                    )
                )
            if has_user_approval and not rms_approved:
                findings.append(
                    GuardrailFinding(
                        code=GuardrailCode.RMS_REJECT,
                        message="RMS approval required before OMS",
                        severity="block",
                        user_message_en="Risk management has not approved this order yet.",
                    )
                )
            # Never allow direct execution path
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.DIRECT_LIVE_EXECUTION,
                    message="Direct live execution disabled",
                    severity="warn",
                    user_message_en="DhanLaxmi never places live orders without approval, RMS, and OMS.",
                )
            )

        if intent in ("stop_bot", "kill_switch"):
            require_confirmation = True
            require_approval = True

        if ctx.get("external_algo") and not paper_qualified and wants_live:
            findings.append(
                GuardrailFinding(
                    code=GuardrailCode.EXTERNAL_WITHOUT_PAPER,
                    message="External algo needs paper test",
                    severity="block",
                    user_message_en="External strategies cannot go live without paper testing.",
                )
            )

        blocking = [f for f in findings if f.severity == "block"]
        # Profit promise alone blocks advisory content generation of that type
        # Missing approval is expected for order preview — still "not allowed to execute"
        allowed = not any(
            f.code
            in (
                GuardrailCode.PROFIT_PROMISE,
                GuardrailCode.KILL_SWITCH,
                GuardrailCode.STALE_DATA,
                GuardrailCode.BROKER_DISCONNECTED,
                GuardrailCode.MISSING_PERMISSION,
                GuardrailCode.MISSING_RISK_PROFILE,
                GuardrailCode.UNLIMITED_RISK,
                GuardrailCode.EXTERNAL_WITHOUT_PAPER,
            )
            for f in blocking
        )
        # Live execution never allowed through this engine
        if wants_live and not (has_user_approval and rms_approved and paper_qualified):
            allowed = False if intent == "live_trade_request" else allowed

        return GuardrailResult(
            allowed=allowed if not wants_live else False,  # never auto-allow live
            findings=findings,
            force_paper=force_paper,
            require_approval=require_approval,
            require_confirmation=require_confirmation,
        )
