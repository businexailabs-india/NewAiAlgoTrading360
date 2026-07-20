from __future__ import annotations

import os

from risk_rules import RiskGuard360
from schemas.strategy import RISK_WARNING, StrategyConfig, StrategyStatus, StrategyValidationResult


def validate_strategy(strategy: StrategyConfig, risk: RiskGuard360 | None = None) -> StrategyValidationResult:
    guard = risk or RiskGuard360()
    allow_live = os.getenv("ALLOW_STRATEGY_LIVE", "false").lower() in ("1", "true", "yes", "on")
    keep_live = (
        allow_live
        and strategy.paper_qualified
        and strategy.admin_approved_for_live
        and strategy.live_trading_enabled
    )
    if not keep_live:
        strategy.live_trading_enabled = False
    strategy.paper_trading_required = True

    check = guard.validate_strategy(strategy)
    errors = list(check.breaches)
    warnings = list(check.warnings)

    if strategy.risk_rules.stop_loss_percent <= 0:
        errors.append("stop_loss_required")
    if not strategy.paper_trading_required:
        errors.append("paper_test_requirement_missing")

    ok = len(errors) == 0
    if ok and strategy.status == StrategyStatus.DRAFT:
        strategy.status = StrategyStatus.VALIDATED

    return StrategyValidationResult(
        ok=ok,
        strategy_id=strategy.strategy_id,
        errors=errors,
        warnings=warnings or [RISK_WARNING],
        live_trading_enabled=bool(strategy.live_trading_enabled),
        paper_trading_required=True,
        risk_warning=RISK_WARNING,
    )
