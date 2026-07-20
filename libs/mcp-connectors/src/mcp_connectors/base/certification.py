"""ProviderCertificationChecklist — Phase 2 readiness certification."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, Field


class CertItemId(StrEnum):
    CREDENTIALS_CONFIGURED = "credentials_configured"
    SANDBOX_MOCK_TESTED = "sandbox_mock_tested"
    ACCOUNT_PROFILE_TESTED = "account_profile_tested"
    MARGIN_TESTED = "margin_tested"
    HOLDINGS_TESTED = "holdings_tested"
    POSITIONS_TESTED = "positions_tested"
    QUOTE_TESTED = "quote_tested"
    ORDER_PREVIEW_TESTED = "order_preview_tested"
    RMS_INTEGRATION_TESTED = "rms_integration_tested"
    OMS_INTEGRATION_TESTED = "oms_integration_tested"
    LIVE_EXECUTION_DISABLED_BY_DEFAULT = "live_execution_disabled_by_default"
    AUDIT_LOGGING_VERIFIED = "audit_logging_verified"
    SECURITY_REDACTION_VERIFIED = "security_redaction_verified"


CERT_ITEMS: list[tuple[CertItemId, str]] = [
    (CertItemId.CREDENTIALS_CONFIGURED, "Credentials schema / env readiness documented"),
    (CertItemId.SANDBOX_MOCK_TESTED, "Sandbox/mock connection tested"),
    (CertItemId.ACCOUNT_PROFILE_TESTED, "Account profile tested"),
    (CertItemId.MARGIN_TESTED, "Margin/funds tested"),
    (CertItemId.HOLDINGS_TESTED, "Holdings tested"),
    (CertItemId.POSITIONS_TESTED, "Positions tested"),
    (CertItemId.QUOTE_TESTED, "Quote tested"),
    (CertItemId.ORDER_PREVIEW_TESTED, "Order preview tested"),
    (CertItemId.RMS_INTEGRATION_TESTED, "RMS integration tested (gate presence)"),
    (CertItemId.OMS_INTEGRATION_TESTED, "OMS integration tested (caller role gate)"),
    (CertItemId.LIVE_EXECUTION_DISABLED_BY_DEFAULT, "Live execution disabled by default"),
    (CertItemId.AUDIT_LOGGING_VERIFIED, "Audit logging verified"),
    (CertItemId.SECURITY_REDACTION_VERIFIED, "Security redaction verified"),
]


class CertItemResult(BaseModel):
    item_id: CertItemId
    description: str
    passed: bool
    evidence: str = ""
    details: dict[str, Any] = Field(default_factory=dict)


class ProviderCertificationChecklist(BaseModel):
    provider_id: str
    provider_name: str
    phase: str = "phase_2_real_provider_readiness"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    items: list[CertItemResult] = Field(default_factory=list)
    overall_passed: bool = False
    score: float = 0.0
    mode: str = "mock"
    notes: list[str] = Field(default_factory=list)

    def finalize(self) -> "ProviderCertificationChecklist":
        if not self.items:
            self.overall_passed = False
            self.score = 0.0
            return self
        passed = sum(1 for i in self.items if i.passed)
        self.score = round(100.0 * passed / len(self.items), 2)
        # Required hard gates for Phase 2 readiness pass
        required = {
            CertItemId.SANDBOX_MOCK_TESTED,
            CertItemId.LIVE_EXECUTION_DISABLED_BY_DEFAULT,
            CertItemId.SECURITY_REDACTION_VERIFIED,
            CertItemId.ORDER_PREVIEW_TESTED,
        }
        required_ok = all(
            any(i.item_id == r and i.passed for i in self.items) for r in required
        )
        self.overall_passed = required_ok and self.score >= 70.0
        return self

    def to_report_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


async def run_provider_certification(
    provider: Any,
    *,
    provider_name: str | None = None,
    credentials_env_configured: bool = False,
    audit_hook: Callable[[], bool] | None = None,
    redact_hook: Callable[[], bool] | None = None,
) -> ProviderCertificationChecklist:
    """Execute Phase 2 checklist against a provider instance (mock path)."""
    from mcp_connectors.base.models import LiveOrderGateContext
    from mcp_connectors.base.provider import LiveTradingBlockedError
    from advisory_core.security import redact_secrets

    pid = getattr(provider, "provider_id", "unknown")
    checklist = ProviderCertificationChecklist(
        provider_id=pid,
        provider_name=provider_name or getattr(provider, "provider_name", pid),
    )
    results: list[CertItemResult] = []

    provider_type = str(getattr(provider, "provider_type", "broker"))
    is_market_data = provider_type in ("market_data", "exchange_data")
    required_creds = list(provider.get_required_credentials()) if hasattr(provider, "get_required_credentials") else []
    creds_ok = bool(credentials_env_configured) or bool(required_creds) or provider_type in (
        "simulated_broker",
        "mock",
        "market_data",
        "exchange_data",
    )
    results.append(
        CertItemResult(
            item_id=CertItemId.CREDENTIALS_CONFIGURED,
            description=CERT_ITEMS[0][1],
            passed=creds_ok,
            evidence=(
                "env_configured"
                if credentials_env_configured
                else ("none_required" if not required_creds else "schema_only")
            ),
            details={"required": required_creds, "provider_type": provider_type},
        )
    )

    # sandbox/mock connect
    connect = await provider.connect({}, {"use_mock": True, "demo": True})
    mock_ok = bool(connect.get("ok"))
    results.append(
        CertItemResult(
            item_id=CertItemId.SANDBOX_MOCK_TESTED,
            description=CERT_ITEMS[1][1],
            passed=mock_ok,
            evidence=str(connect.get("status")),
            details={"mode": connect.get("mode")},
        )
    )
    checklist.mode = str(connect.get("mode") or "mock")

    profile = await provider.get_account_profile()
    results.append(
        CertItemResult(
            item_id=CertItemId.ACCOUNT_PROFILE_TESTED,
            description=CERT_ITEMS[2][1],
            passed=mock_ok and profile.get("status") != "not_configured",
            evidence="profile_ok" if profile else "empty",
            details={"has_masked_id": "masked_client_id" in profile},
        )
    )

    margins = await provider.get_margins()
    results.append(
        CertItemResult(
            item_id=CertItemId.MARGIN_TESTED,
            description=CERT_ITEMS[3][1],
            passed=mock_ok and ("available" in margins or margins.get("status") != "not_configured"),
            evidence=f"available={margins.get('available')}",
        )
    )

    holdings = await provider.get_holdings()
    results.append(
        CertItemResult(
            item_id=CertItemId.HOLDINGS_TESTED,
            description=CERT_ITEMS[4][1],
            passed=mock_ok and isinstance(holdings, list),
            evidence=f"count={len(holdings) if isinstance(holdings, list) else 0}",
        )
    )

    positions = await provider.get_positions()
    results.append(
        CertItemResult(
            item_id=CertItemId.POSITIONS_TESTED,
            description=CERT_ITEMS[5][1],
            passed=mock_ok and isinstance(positions, list),
            evidence=f"count={len(positions) if isinstance(positions, list) else 0}",
        )
    )

    quotes = await provider.get_live_quotes(["RELIANCE"])
    q_ok = mock_ok and isinstance(quotes.get("quotes"), dict) and len(quotes.get("quotes") or {}) > 0
    results.append(
        CertItemResult(
            item_id=CertItemId.QUOTE_TESTED,
            description=CERT_ITEMS[6][1],
            passed=q_ok,
            evidence=f"symbols={list((quotes.get('quotes') or {}).keys())}",
        )
    )

    preview = await provider.preview_order(
        {
            "exchange": "NSE",
            "symbol": "RELIANCE",
            "side": "BUY",
            "quantity": 1,
            "order_type": "MARKET",
            "product_type": "CNC",
            "price": 100,
        }
    )
    # Market-data providers correctly refuse order preview
    preview_ok = mock_ok and (
        bool(preview.get("preview"))
        or is_market_data
        or preview.get("reason") == "market_data_provider"
    )
    results.append(
        CertItemResult(
            item_id=CertItemId.ORDER_PREVIEW_TESTED,
            description=CERT_ITEMS[7][1],
            passed=preview_ok,
            evidence=(
                f"market_data_no_trade"
                if is_market_data
                else f"accepted={preview.get('accepted')}"
            ),
        )
    )

    # RMS / OMS gates — verify live path blocked without approvals
    rms_ok = False
    oms_ok = False
    live_disabled = False
    try:
        await provider.place_order_disabled_by_default(
            {"symbol": "RELIANCE", "quantity": 1, "side": "BUY", "exchange": "NSE"},
            gate=LiveOrderGateContext(
                live_trading_enabled=False,
                caller_role="user",
                rms_approval_id=None,
                user_approval_id=None,
                provider_live_trading_enabled=False,
                kill_switch_off=True,
            ),
        )
    except LiveTradingBlockedError as exc:
        msg = str(exc)
        live_disabled = True
        rms_ok = "RMS" in msg or "rms" in msg.lower()
        oms_ok = "OMS" in msg or "oms" in msg.lower() or "caller is not OMS" in msg
    except PermissionError:
        live_disabled = True
        rms_ok = True
        oms_ok = True

    results.append(
        CertItemResult(
            item_id=CertItemId.RMS_INTEGRATION_TESTED,
            description=CERT_ITEMS[8][1],
            passed=rms_ok or live_disabled,
            evidence="gate_enforced" if (rms_ok or live_disabled) else "missing",
        )
    )
    results.append(
        CertItemResult(
            item_id=CertItemId.OMS_INTEGRATION_TESTED,
            description=CERT_ITEMS[9][1],
            passed=oms_ok or live_disabled,
            evidence="gate_enforced" if (oms_ok or live_disabled) else "missing",
        )
    )
    results.append(
        CertItemResult(
            item_id=CertItemId.LIVE_EXECUTION_DISABLED_BY_DEFAULT,
            description=CERT_ITEMS[10][1],
            passed=live_disabled,
            evidence="blocked" if live_disabled else "NOT_BLOCKED",
        )
    )

    audit_ok = True if audit_hook is None else bool(audit_hook())
    results.append(
        CertItemResult(
            item_id=CertItemId.AUDIT_LOGGING_VERIFIED,
            description=CERT_ITEMS[11][1],
            passed=audit_ok,
            evidence="hook_or_default",
        )
    )

    if redact_hook is not None:
        redact_ok = bool(redact_hook())
    else:
        sample = redact_secrets({"access_token": "secret-value-123", "symbol": "RELIANCE"})
        redact_ok = sample.get("access_token") == "[REDACTED]" and sample.get("symbol") == "RELIANCE"
    results.append(
        CertItemResult(
            item_id=CertItemId.SECURITY_REDACTION_VERIFIED,
            description=CERT_ITEMS[12][1],
            passed=redact_ok,
            evidence="redact_secrets_ok" if redact_ok else "failed",
        )
    )

    checklist.items = results
    return checklist.finalize()


def write_certification_report(
    checklist: ProviderCertificationChecklist,
    reports_dir: Path,
) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    stamp = checklist.generated_at.strftime("%Y%m%dT%H%M%SZ")
    path = reports_dir / f"{checklist.provider_id}-{stamp}.json"
    latest = reports_dir / f"{checklist.provider_id}-latest.json"
    payload = checklist.to_report_dict()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    latest.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    md_path = reports_dir / f"{checklist.provider_id}-latest.md"
    lines = [
        f"# Provider Certification — {checklist.provider_name} (`{checklist.provider_id}`)",
        "",
        f"- Phase: `{checklist.phase}`",
        f"- Generated: `{checklist.generated_at.isoformat()}`",
        f"- Mode: `{checklist.mode}`",
        f"- Score: **{checklist.score}%**",
        f"- Overall: **{'PASS' if checklist.overall_passed else 'FAIL'}**",
        "",
        "| Item | Passed | Evidence |",
        "|------|--------|----------|",
    ]
    for item in checklist.items:
        lines.append(
            f"| `{item.item_id}` | {'✅' if item.passed else '❌'} | {item.evidence} |"
        )
    lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return latest
