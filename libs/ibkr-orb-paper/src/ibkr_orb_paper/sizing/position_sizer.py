from __future__ import annotations

import math
from dataclasses import dataclass

from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import PortfolioSnapshot


@dataclass
class SizeResult:
    quantity: int
    risk_amount: float
    risk_quantity: int
    capital_quantity: int
    effective_risk_pct: float
    rejection: str | None = None


class PositionSizer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def effective_risk_pct(self, drawdown_pct: float) -> float:
        base = self.settings.risk_per_trade_pct
        if drawdown_pct >= self.settings.drawdown_pause_pct:
            return 0.0
        if drawdown_pct >= self.settings.drawdown_reduce_risk_pct:
            return base * 0.5
        return base

    def size(
        self,
        *,
        entry_price: float,
        stop_distance: float,
        portfolio: PortfolioSnapshot,
        min_tick: float,
    ) -> SizeResult:
        if entry_price <= 0 or stop_distance <= 0:
            return SizeResult(0, 0.0, 0, 0, 0.0, "invalid entry/stop")

        sizing_equity = (
            portfolio.monthly_sizing_equity
            if self.settings.position_size_update == "monthly"
            else portfolio.equity
        )
        if sizing_equity <= 0:
            sizing_equity = self.settings.starting_equity

        eff = self.effective_risk_pct(portfolio.drawdown_pct)
        if eff <= 0:
            return SizeResult(0, 0.0, 0, 0, eff, "risk paused by drawdown")

        # include estimated costs in per-share risk
        cost = self.settings.estimated_commission_per_share + self.settings.estimated_slippage_per_share
        per_share_risk = stop_distance + cost
        if per_share_risk <= 0:
            return SizeResult(0, 0.0, 0, 0, eff, "non-positive per-share risk")

        risk_amount = sizing_equity * eff
        risk_quantity = math.floor(risk_amount / per_share_risk)
        capital_quantity = math.floor(
            sizing_equity * self.settings.max_capital_deployment_pct / entry_price
        )
        quantity = min(risk_quantity, capital_quantity)
        if quantity <= 0:
            return SizeResult(0, risk_amount, risk_quantity, capital_quantity, eff, "zero quantity")

        # never round quantity upward (already floor)
        return SizeResult(quantity, risk_amount, risk_quantity, capital_quantity, eff, None)
