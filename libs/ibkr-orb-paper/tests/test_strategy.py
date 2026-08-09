from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


from ibkr_orb_paper.broker.fake import make_synthetic_orb_day
from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import Bar, PortfolioSnapshot, SignalDecision
from ibkr_orb_paper.strategy.orb import OpeningRangeBreakoutStrategy


TZ = ZoneInfo("America/New_York")


def _settings(**kwargs) -> Settings:
    base = {
        "dry_run": True,
        "enable_paper_orders": "NO",
        "ibkr_paper_account_id": "DU1234567",
        "starting_equity": 2400.0,
        "symbol": "SPY",
        "volume_multiplier": 1.2,
        "ema_period": 50,
        "atr_period": 14,
        "volume_lookback": 20,
    }
    base.update(kwargs)
    return Settings.model_validate(base)


def _portfolio(equity: float = 2400.0, dd: float = 0.0, trades: int = 0) -> PortfolioSnapshot:
    peak = equity / (1 - dd) if dd < 1 else equity
    return PortfolioSnapshot(
        equity=equity,
        equity_peak=peak if dd > 0 else equity,
        daily_pnl=0.0,
        weekly_pnl=0.0,
        drawdown_pct=dd,
        open_quantity=0,
        trades_today=trades,
        monthly_sizing_equity=equity,
    )


def test_valid_breakout_and_duplicate_reject() -> None:
    bars = make_synthetic_orb_day(breakout=True)
    strat = OpeningRangeBreakoutStrategy(_settings())
    port = _portfolio()
    sig = strat.evaluate(bars, portfolio=port, has_position=False, has_active_entry=False)
    assert sig.decision == SignalDecision.BUY
    assert sig.quantity > 0
    assert sig.entry_price and sig.stop_price and sig.target_price
    assert sig.breakout_key
    strat.mark_breakout_traded(sig.breakout_key)
    sig2 = strat.evaluate(bars, portfolio=port, has_position=False, has_active_entry=False)
    assert sig2.decision == SignalDecision.REJECT
    assert any("duplicate" in r for r in sig2.reasons)


def test_no_signal_before_or_complete() -> None:
    bars = make_synthetic_orb_day(breakout=True)
    # drop last two session bars so OR incomplete / no breakout bar
    # keep only first OR bar of session
    day = datetime(2024, 6, 3, tzinfo=TZ)
    truncated = [b for b in bars if b.ts.date() < day.date() or b.ts <= day.replace(hour=9, minute=45)]
    strat = OpeningRangeBreakoutStrategy(_settings())
    sig = strat.evaluate(truncated, portfolio=_portfolio(), has_position=False, has_active_entry=False)
    assert sig.decision == SignalDecision.REJECT


def test_unfinished_candle_ignored() -> None:
    bars = make_synthetic_orb_day(breakout=True)
    # mark last as incomplete — strategy uses completed only; without breakout complete → reject
    bars[-1] = Bar(
        bars[-1].ts,
        bars[-1].open,
        bars[-1].high,
        bars[-1].low,
        bars[-1].close,
        bars[-1].volume,
        False,
    )
    strat = OpeningRangeBreakoutStrategy(_settings())
    sig = strat.evaluate(bars, portfolio=_portfolio(), has_position=False, has_active_entry=False)
    assert sig.decision == SignalDecision.REJECT


def test_rejects_when_position_or_active_entry() -> None:
    bars = make_synthetic_orb_day(breakout=True)
    strat = OpeningRangeBreakoutStrategy(_settings())
    assert (
        strat.evaluate(bars, portfolio=_portfolio(), has_position=True, has_active_entry=False).decision
        == SignalDecision.REJECT
    )
    assert (
        strat.evaluate(bars, portfolio=_portfolio(), has_position=False, has_active_entry=True).decision
        == SignalDecision.REJECT
    )
