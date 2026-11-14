"""Fee-inclusive position sizing. Rs 100 is a TOTAL loss budget, not just (entry - stop) * qty."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from tradex_bots.config import RiskConfig
from tradex_bots.costs import Execution, FeeModel, SlippageScenario
from tradex_bots.models import Side, TradeLevels


@dataclass
class SizingResult:
    approved: bool
    quantity: int
    reason: str
    notional: float = 0.0
    raw_quantity: int = 0  # spec formula before fee/slippage reduction
    projected_loss_at_stop: float = 0.0  # gross + slippage + all charges
    projected_charges_at_stop: float = 0.0
    expected_gross_reward: float = 0.0
    expected_net_reward: float = 0.0
    round_trip_cost_at_target: float = 0.0
    details: dict[str, float] = field(default_factory=dict)


def _loss_at_stop(
    q: int, entry_fill: float, stop_exit: float, fees: FeeModel
) -> tuple[float, float]:
    charges = fees.charges(
        [Execution("e", Side.BUY, q, entry_fill), Execution("x", Side.SELL, q, stop_exit)]
    )
    loss = q * (entry_fill - stop_exit) + float(charges.total)
    return loss, float(charges.total)


def size_position(
    levels: TradeLevels,
    *,
    available_funds: float,
    risk: RiskConfig,
    fees: FeeModel,
    slippage: SlippageScenario,
    tick: float,
    live: bool = False,
    risk_budget: float | None = None,
) -> SizingResult:
    """Q = floor(min(risk/d, exposure/P, (funds - reserve)/P)), then shrink until the projected TOTAL loss at the
    stop (adverse slippage on both legs + brokerage + statutory charges) fits the risk budget."""
    P, d = levels.entry_price, levels.stop_distance
    budget = risk.risk_per_trade_inr if risk_budget is None else risk_budget
    exposure_cap = min(risk.max_exposure_inr, risk.live_max_exposure_inr) if live else risk.max_exposure_inr

    entry_fill = slippage.entry_price(P, tick)  # price we expect to PAY (conservative for cash + exposure)
    stop_exit = slippage.exit_price(levels.stop_price, tick)
    target_exit = slippage.exit_price(levels.target_price, tick)

    usable = available_funds - risk.fee_reserve_inr
    if usable <= 0 or P <= 0 or d <= 0:
        return SizingResult(False, 0, "insufficient_funds_after_reserve")

    raw_q = math.floor(min(budget / d, exposure_cap / entry_fill, usable / entry_fill))
    q = raw_q
    if q < 1:
        return SizingResult(False, 0, "quantity_zero", raw_quantity=max(raw_q, 0))

    loss, charges = _loss_at_stop(q, entry_fill, stop_exit, fees)
    while q > 0 and loss > budget + 1e-9:
        q -= 1
        if q:
            loss, charges = _loss_at_stop(q, entry_fill, stop_exit, fees)
    if q < 1:
        return SizingResult(False, 0, "quantity_zero_after_fee_inclusive_risk", raw_quantity=raw_q)

    # Hard re-checks: never exceed exposure or funds (belt and braces).
    if q * entry_fill > exposure_cap + 1e-9 or q * entry_fill + risk.fee_reserve_inr > available_funds + 1e-9:
        return SizingResult(False, 0, "exceeds_exposure_or_funds", raw_quantity=raw_q)

    gross_reward = q * (target_exit - entry_fill)
    cost_target = float(fees.round_trip(q, entry_fill, target_exit).total)
    net_reward = gross_reward - cost_target
    res = SizingResult(
        approved=True,
        quantity=q,
        reason="ok",
        notional=round(q * entry_fill, 2),
        raw_quantity=raw_q,
        projected_loss_at_stop=round(loss, 2),
        projected_charges_at_stop=round(charges, 2),
        expected_gross_reward=round(gross_reward, 2),
        expected_net_reward=round(net_reward, 2),
        round_trip_cost_at_target=round(cost_target, 2),
        details={"entry_fill_est": entry_fill, "stop_exit_est": stop_exit, "target_exit_est": target_exit},
    )
    if net_reward < risk.min_net_reward_inr:
        res.approved, res.reason = False, "net_reward_below_minimum"
    elif gross_reward <= 0 or cost_target / gross_reward > risk.max_cost_to_reward_ratio:
        res.approved, res.reason = False, "costs_too_large_vs_reward"
    return res


def risk_with_actual_fill(
    quantity: int, avg_fill: float, stop_price: float, fees: FeeModel, slippage: SlippageScenario, tick: float
) -> float:
    """Total projected loss at the stop using the ACTUAL average fill price (post-fill recheck)."""
    stop_exit = slippage.exit_price(stop_price, tick)
    loss, _ = _loss_at_stop(quantity, avg_fill, stop_exit, fees)
    return loss
