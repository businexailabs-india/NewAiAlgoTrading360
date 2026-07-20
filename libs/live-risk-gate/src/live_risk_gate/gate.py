"""Lightweight live-order RMS gate (Phase 4)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class LiveRiskControls(BaseModel):
    kill_switch: bool = False
    max_quantity: int = 100
    max_notional: float = 500000.0
    allow_product_types: list[str] = Field(default_factory=lambda: ["CNC", "INTRADAY", "MIS", "MARGIN"])
    max_daily_loss: float = 25000.0
    daily_realized_pnl: float = 0.0
    market_open: bool = True


class LiveRiskDecision(BaseModel):
    allowed: bool
    rms_approval_id: str | None = None
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    checked_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def evaluate_live_order(
    order: dict[str, Any],
    *,
    account: dict[str, Any] | None = None,
    controls: LiveRiskControls | dict[str, Any] | None = None,
) -> LiveRiskDecision:
    """Return RMS decision. Never places orders."""
    ctrl = (
        controls
        if isinstance(controls, LiveRiskControls)
        else LiveRiskControls.model_validate(controls or {})
    )
    reasons: list[str] = []
    warnings: list[str] = []
    qty = int(order.get("quantity") or 0)
    price = float(order.get("price") or order.get("estimated_price") or 0)
    notional = qty * price if price > 0 else float(order.get("estimated_notional") or 0)
    product = str(order.get("product_type") or order.get("productType") or "CNC").upper()
    if product == "MIS":
        product = "INTRADAY"

    if ctrl.kill_switch:
        reasons.append("kill_switch_active")
    if qty <= 0:
        reasons.append("invalid_quantity")
    if qty > ctrl.max_quantity:
        reasons.append(f"quantity_exceeds_max:{ctrl.max_quantity}")
    if notional > ctrl.max_notional:
        reasons.append(f"notional_exceeds_max:{ctrl.max_notional}")
    if product not in {p.upper() for p in ctrl.allow_product_types}:
        reasons.append(f"product_type_not_allowed:{product}")
    if not ctrl.market_open:
        reasons.append("market_closed")
        warnings.append("Market hours gate rejected order")
    if ctrl.daily_realized_pnl <= -abs(ctrl.max_daily_loss):
        reasons.append("max_daily_loss_breached")

    available = float((account or {}).get("available_margin") or (account or {}).get("available") or 0)
    if available and notional and notional > available:
        reasons.append("insufficient_margin")

    if reasons:
        return LiveRiskDecision(allowed=False, reasons=reasons, warnings=warnings)

    return LiveRiskDecision(
        allowed=True,
        rms_approval_id=str(uuid4()),
        reasons=[],
        warnings=warnings or ["RMS approved for gated OMS handoff only"],
    )
