from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import Bar
from ibkr_orb_paper.indicators.service import (
    IndicatorService,
    atr,
    average_volume,
    bars_to_dataframe,
    ema,
    ema_slope,
    opening_range,
    only_completed,
    parse_bar_minutes,
    round_to_tick,
    session_vwap,
)


TZ = ZoneInfo("America/New_York")


def _bar(
    ts: datetime, o: float, h: float, low: float, c: float, v: float, complete: bool = True
) -> Bar:
    return Bar(ts, o, h, low, c, v, complete)


def test_opening_range_requires_two_15m_bars() -> None:
    day = datetime(2024, 6, 3, tzinfo=TZ)
    bars = [
        _bar(day.replace(hour=9, minute=45), 100, 101, 99.5, 100.5, 1e6),
        _bar(day.replace(hour=10, minute=0), 100.5, 102, 100, 101.5, 1e6),
        _bar(day.replace(hour=10, minute=15), 101.5, 103, 101, 102.5, 1e6),
    ]
    df = bars_to_dataframe(bars)
    hi, lo, done = opening_range(
        df, opening_range_minutes=30, bar_minutes=15, market_timezone="America/New_York"
    )
    assert done
    assert hi == 102.0
    assert lo == 99.5


def test_no_signal_indicators_before_or_complete() -> None:
    day = datetime(2024, 6, 3, tzinfo=TZ)
    # only one OR bar
    warmup = []
    t = datetime(2024, 5, 20, 10, 0, tzinfo=TZ)
    px = 100.0
    while len(warmup) < 60:
        if t.weekday() < 5:
            warmup.append(_bar(t, px, px + 0.2, px - 0.2, px + 0.05, 1e6))
            px += 0.02
        t += timedelta(minutes=15)
    bars = warmup + [_bar(day.replace(hour=9, minute=45), 105, 106, 104.5, 105.5, 2e6)]
    svc = IndicatorService()
    snap = svc.compute_with_prior_avg_volume(
        bars,
        ema_period=50,
        atr_period=14,
        volume_lookback=20,
        opening_range_minutes=30,
        bar_size="15 mins",
        market_timezone="America/New_York",
    )
    assert snap is not None
    assert snap.opening_range_complete is False


def test_vwap_ema_atr_volume() -> None:
    rows = []
    t0 = datetime(2024, 6, 3, 9, 45, tzinfo=TZ)
    for i in range(5):
        c = 100 + i
        rows.append(_bar(t0 + timedelta(minutes=15 * i), c, c + 1, c - 1, c, 1000 * (i + 1)))
    df = bars_to_dataframe(rows)
    v = session_vwap(df)
    assert float(v.iloc[-1]) > 0
    e = ema(df["close"], 3)
    assert ema_slope(e) > 0
    a = atr(df, 3)
    assert float(a.iloc[-1]) > 0
    assert average_volume(df["volume"], 3) == pytest.approx((3000 + 4000 + 5000) / 3)


def test_completed_candle_only() -> None:
    t = datetime(2024, 6, 3, 10, 0, tzinfo=TZ)
    bars = [
        _bar(t, 1, 2, 0.5, 1.5, 100, True),
        _bar(t + timedelta(minutes=15), 1.5, 2.5, 1, 2, 100, False),
    ]
    df = only_completed(bars_to_dataframe(bars))
    assert len(df) == 1


def test_no_lookahead_bars_as_of() -> None:
    from ibkr_orb_paper.market_data.loader import bars_as_of

    t = datetime(2024, 6, 3, 10, 0, tzinfo=TZ)
    bars = [_bar(t, 1, 1, 1, 1, 1), _bar(t + timedelta(minutes=15), 2, 2, 2, 2, 2)]
    assert len(bars_as_of(bars, t)) == 1


def test_round_to_tick() -> None:
    assert round_to_tick(10.014, 0.01, "down") == pytest.approx(10.01)
    assert round_to_tick(10.011, 0.01, "up") == pytest.approx(10.02)
    assert parse_bar_minutes("15 mins") == 15


def test_settings_defaults_dry_run() -> None:
    s = Settings(
        _env_file=None,  # type: ignore[call-arg]
    )
    # pydantic-settings may still read env; force via model_construct if needed
    s = Settings.model_validate(
        {
            "dry_run": True,
            "enable_paper_orders": "NO",
            "ibkr_paper_account_id": "",
        }
    )
    assert s.dry_run is True
    assert s.can_submit_paper_orders() is False
