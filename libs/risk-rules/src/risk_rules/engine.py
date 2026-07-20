"""RiskGuard360 — basic RMS for paper trading (live trading always blocked)."""

from __future__ import annotations

from typing import Any

from schemas.paper import PaperOrder, PaperTradingAccount
from schemas.risk import RiskCheckResult, RiskRules
from schemas.strategy import RISK_WARNING, StrategyConfig


def get_default_policies() -> dict[str, Any]:
    return {
        "live_trading_enabled": False,
        "paper_trading_only": True,
        "require_stop_loss": True,
        "require_max_daily_loss": True,
        "require_max_position_size": True,
        "require_paper_test": True,
        "allow_options_selling": False,
        "kill_switch_default": True,
        "risk_warning": RISK_WARNING,
    }


class RiskGuard360:
    def __init__(self):
        self.kill_switch_global = False
        self.policies = get_default_policies()

    def trigger_kill_switch(self, reason: str = "manual") -> dict[str, Any]:
        self.kill_switch_global = True
        return {"active": True, "reason": reason, "live_trading_enabled": False}

    def reset_kill_switch(self) -> dict[str, Any]:
        self.kill_switch_global = False
        return {"active": False}

    def validate_strategy(self, strategy: StrategyConfig) -> RiskCheckResult:
        breaches: list[str] = []
        warnings: list[str] = [RISK_WARNING]
        rr = strategy.risk_rules

        if strategy.live_trading_enabled:
            breaches.append("live_trading_must_be_disabled")
        if not strategy.paper_trading_required:
            breaches.append("paper_trading_required_must_be_true")
        if rr.stop_loss_percent <= 0:
            breaches.append("stop_loss_percent_required")
        if rr.max_daily_loss <= 0:
            breaches.append("max_daily_loss_required")
        if rr.max_position_value <= 0:
            breaches.append("max_position_value_required")
        if not strategy.symbols:
            breaches.append("symbols_required")
        if rr.allow_options_selling:
            breaches.append("options_selling_not_allowed_in_phase1")
            warnings.append("Options selling is disabled in Phase 1.")

        return RiskCheckResult(
            allowed=len(breaches) == 0,
            reason="ok" if not breaches else "strategy_risk_validation_failed",
            breaches=breaches,
            warnings=warnings,
        )

    def check_paper_order(
        self,
        order: PaperOrder,
        account: PaperTradingAccount,
        risk_rules: RiskRules | None = None,
        mark_price: float | None = None,
        trades_today: int = 0,
        daily_realized_loss: float = 0.0,
    ) -> RiskCheckResult:
        breaches: list[str] = []
        warnings: list[str] = [RISK_WARNING]
        rr = risk_rules or RiskRules()

        if self.kill_switch_global or account.kill_switch_active:
            return RiskCheckResult(
                allowed=False,
                reason="kill_switch_active",
                breaches=["kill_switch_active"],
                warnings=warnings,
            )

        price = mark_price or order.limit_price or 0.0
        notional = price * order.quantity
        if price <= 0:
            breaches.append("invalid_price")
        if notional > rr.max_position_value:
            breaches.append("max_position_value_exceeded")
        if order.side.value == "BUY" and notional > account.cash_balance:
            breaches.append("insufficient_cash")
        if trades_today >= rr.max_trades_per_day:
            breaches.append("max_trades_per_day_exceeded")
        if daily_realized_loss >= rr.max_daily_loss:
            breaches.append("max_daily_loss_breached")

        return RiskCheckResult(
            allowed=len(breaches) == 0,
            reason="ok" if not breaches else "order_rejected_by_rms",
            breaches=breaches,
            warnings=warnings,
        )
