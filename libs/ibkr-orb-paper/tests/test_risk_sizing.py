from __future__ import annotations

import pytest

from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import PortfolioSnapshot
from ibkr_orb_paper.risk.manager import RiskManager
from ibkr_orb_paper.sizing.position_sizer import PositionSizer


def _settings(**kwargs) -> Settings:
    base = {
        "dry_run": True,
        "enable_paper_orders": "NO",
        "ibkr_paper_account_id": "DU1234567",
        "starting_equity": 2400.0,
        "risk_per_trade_pct": 0.0025,
        "max_capital_deployment_pct": 0.90,
        "drawdown_reduce_risk_pct": 0.05,
        "drawdown_pause_pct": 0.10,
        "max_trades_per_day": 2,
        "daily_loss_limit_pct": 0.0075,
        "weekly_loss_limit_pct": 0.02,
        "estimated_commission_per_share": 0.005,
        "estimated_slippage_per_share": 0.01,
        "position_size_update": "monthly",
    }
    base.update(kwargs)
    return Settings.model_validate(base)


def _port(
    equity: float = 2400.0,
    dd: float = 0.0,
    daily: float = 0.0,
    weekly: float = 0.0,
    trades: int = 0,
) -> PortfolioSnapshot:
    peak = equity if dd <= 0 else equity / (1 - dd)
    return PortfolioSnapshot(
        equity=equity,
        equity_peak=peak,
        daily_pnl=daily,
        weekly_pnl=weekly,
        drawdown_pct=dd,
        open_quantity=0,
        trades_today=trades,
        monthly_sizing_equity=equity,
    )


def test_position_sizing_and_zero_qty() -> None:
    sizer = PositionSizer(_settings())
    r = sizer.size(entry_price=500.0, stop_distance=2.0, portfolio=_port(), min_tick=0.01)
    assert r.quantity >= 0
    assert r.quantity == min(r.risk_quantity, r.capital_quantity)
    z = sizer.size(entry_price=500.0, stop_distance=0.0, portfolio=_port(), min_tick=0.01)
    assert z.quantity == 0


def test_max_capital_constraint() -> None:
    sizer = PositionSizer(_settings(max_capital_deployment_pct=0.01, risk_per_trade_pct=0.5))
    r = sizer.size(entry_price=500.0, stop_distance=0.5, portfolio=_port(equity=2400), min_tick=0.01)
    assert r.capital_quantity == 0 or r.quantity <= r.capital_quantity
    assert r.quantity == min(r.risk_quantity, r.capital_quantity)


def test_drawdown_reduce_and_pause() -> None:
    sizer = PositionSizer(_settings())
    assert sizer.effective_risk_pct(0.049) == pytest.approx(0.0025)
    assert sizer.effective_risk_pct(0.05) == pytest.approx(0.00125)
    assert sizer.effective_risk_pct(0.10) == 0.0
    paused = sizer.size(entry_price=100, stop_distance=1, portfolio=_port(dd=0.10), min_tick=0.01)
    assert paused.quantity == 0


def test_daily_weekly_trade_limits() -> None:
    rm = RiskManager(_settings())
    gates = rm.evaluate(
        portfolio=_port(daily=-100, equity=2400),
        has_position=False,
        has_active_entry=False,
        data_fresh=True,
        data_delayed=False,
        in_rth=True,
        quantity=1,
        stop_distance=1,
        entry_price=100,
        account_verified_paper=True,
        connection_ok=True,
        duplicate_breakout=False,
    )
    by = {g.name: g.passed for g in gates}
    assert by["daily_loss"] is False

    gates2 = rm.evaluate(
        portfolio=_port(trades=2),
        has_position=False,
        has_active_entry=False,
        data_fresh=True,
        data_delayed=False,
        in_rth=True,
        quantity=1,
        stop_distance=1,
        entry_price=100,
        account_verified_paper=True,
        connection_ok=True,
        duplicate_breakout=False,
    )
    assert {g.name: g.passed for g in gates2}["max_trades"] is False


def test_stale_delayed_and_kill_switch() -> None:
    rm = RiskManager(_settings())
    gates = rm.evaluate(
        portfolio=_port(),
        has_position=False,
        has_active_entry=False,
        data_fresh=False,
        data_delayed=True,
        in_rth=True,
        quantity=1,
        stop_distance=1,
        entry_price=100,
        account_verified_paper=True,
        connection_ok=True,
        duplicate_breakout=False,
    )
    assert {g.name: g.passed for g in gates}["market_data_fresh"] is False
    rm.engage_kill_switch()
    gates2 = rm.evaluate(
        portfolio=_port(),
        has_position=False,
        has_active_entry=False,
        data_fresh=True,
        data_delayed=False,
        in_rth=True,
        quantity=1,
        stop_distance=1,
        entry_price=100,
        account_verified_paper=True,
        connection_ok=True,
        duplicate_breakout=False,
    )
    assert {g.name: g.passed for g in gates2}["kill_switch"] is False
