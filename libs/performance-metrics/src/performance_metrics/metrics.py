from __future__ import annotations

from typing import Sequence

import numpy as np

from schemas.reports import PerformanceReport
from schemas.strategy import RISK_WARNING, SuitabilityScore


def compute_performance(
    strategy_id: str,
    trade_pnls: Sequence[float],
    starting_balance: float = 1_000_000.0,
    risk_breaches: list[str] | None = None,
) -> PerformanceReport:
    pnls = list(trade_pnls)
    n = len(pnls)
    total = float(sum(pnls)) if n else 0.0
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    equity = [starting_balance]
    for p in pnls:
        equity.append(equity[-1] + p)
    peak = equity[0]
    max_dd = 0.0
    for e in equity:
        peak = max(peak, e)
        max_dd = max(max_dd, (peak - e) / peak if peak else 0.0)

    avg_win = float(np.mean(wins)) if wins else 0.0
    avg_loss = float(np.mean(losses)) if losses else 0.0
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    pf = (gross_profit / gross_loss) if gross_loss > 0 else (float("inf") if gross_profit > 0 else 0.0)

    suitability = compute_suitability(
        user_risk_fit=70,
        market_condition_fit=65,
        capital_fit=80,
        paper_test_result=max(0, min(100, 50 + total / 1000)),
        liquidity_fit=75,
        drawdown_risk=max_dd * 100,
        complexity_risk=20,
    )

    return PerformanceReport(
        strategy_id=strategy_id,
        total_pnl=round(total, 2),
        pnl_percent=round((total / starting_balance) * 100, 4) if starting_balance else 0.0,
        max_drawdown=round(max_dd * 100, 4),
        win_rate=round(len(wins) / n * 100, 2) if n else 0.0,
        loss_rate=round(len(losses) / n * 100, 2) if n else 0.0,
        average_win=round(avg_win, 2),
        average_loss=round(avg_loss, 2),
        profit_factor=round(pf if pf != float("inf") else 999.0, 4),
        number_of_trades=n,
        best_trade=round(max(pnls), 2) if pnls else 0.0,
        worst_trade=round(min(pnls), 2) if pnls else 0.0,
        risk_breaches=list(risk_breaches or []),
        strategy_suitability_score=suitability,
        risk_warning=RISK_WARNING,
    )


def compute_suitability(
    user_risk_fit: float,
    market_condition_fit: float,
    capital_fit: float,
    paper_test_result: float,
    liquidity_fit: float,
    drawdown_risk: float,
    complexity_risk: float,
) -> SuitabilityScore:
    raw = (
        user_risk_fit
        + market_condition_fit
        + capital_fit
        + paper_test_result
        + liquidity_fit
        - drawdown_risk
        - complexity_risk
    )
    # Normalize roughly to 0-100 (max theoretical ~400)
    score = max(0.0, min(100.0, raw / 4.0))
    if score >= 70:
        level = "low"
    elif score >= 45:
        level = "medium"
    else:
        level = "high"
    return SuitabilityScore(
        suitable_for_user_score=round(score, 2),
        risk_level=level,
        paper_test_required=True,
        live_deployment_locked=True,
        components={
            "user_risk_fit": user_risk_fit,
            "market_condition_fit": market_condition_fit,
            "capital_fit": capital_fit,
            "paper_test_result": paper_test_result,
            "liquidity_fit": liquidity_fit,
            "drawdown_risk": drawdown_risk,
            "complexity_risk": complexity_risk,
        },
        risk_warning=RISK_WARNING,
    )
