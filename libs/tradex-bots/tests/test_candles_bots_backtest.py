from __future__ import annotations

from collections import Counter
from datetime import datetime, time, timedelta

import numpy as np
import pandas as pd
import pytest

from tradex_bots.backtest import Backtester
from tradex_bots.bots import BOT_REGISTRY, create_bot
from tradex_bots.candles import CandleAggregator, CandleValidator, Tick
from tradex_bots.instruments import Instrument
from tradex_bots.metrics import TradeRecord, compute_metrics
from tradex_bots.models import Candle
from tradex_bots.store import Store
from tradex_bots.synthetic import synth_candles
from tradex_bots.timeutil import IST

D = datetime(2026, 11, 16)


def t(h, m, s=0):
    return datetime(2026, 11, 16, h, m, s, tzinfo=IST)


# ------------------------------------------------------------------ candle aggregation / validation
def test_aggregator_builds_correct_ohlcv_from_cumulative_volume():
    agg = CandleAggregator("X")
    out = []
    ticks = [
        Tick("X", t(9, 10), 100.0, None, 1000),      # pre-open: baseline only
        Tick("X", t(9, 15, 5), 101.0, None, 1100),   # +100
        Tick("X", t(9, 17), 103.0, None, 1250),      # +150
        Tick("X", t(9, 19, 59), 100.5, None, 1300),  # +50
        Tick("X", t(9, 20, 1), 100.7, None, 1400),   # next bucket -> closes 09:15 candle
    ]
    for k in ticks:
        out += agg.on_tick(k)
    assert len(out) == 1
    c = out[0]
    assert c.start == t(9, 15) and c.end == t(9, 20)
    assert (c.open, c.high, c.low, c.close) == (101.0, 103.0, 100.5, 100.5)
    assert c.volume == 300  # deltas from the pre-open baseline


def test_aggregator_drops_first_bucket_without_baseline_and_rejects_bad_ticks():
    agg = CandleAggregator("X")
    out = []
    for k in [Tick("X", t(9, 16), 100.0, None, 5000), Tick("X", t(9, 21), 101.0, None, 5100)]:
        out += agg.on_tick(k)
    assert out == []  # first candle's volume unknown -> dropped rather than guessed
    assert agg.rejected["incomplete_first_bucket"] == 1
    agg.on_tick(Tick("X", t(9, 22), 101.5, None, 5200))
    agg.on_tick(Tick("X", t(9, 21, 30), 101.5, None, 5300))  # out of order
    agg.on_tick(Tick("X", t(9, 22), 101.5, None, 5200))       # duplicate
    agg.on_tick(Tick("X", t(15, 45), 101.5, None, 5400))      # outside session
    agg.on_tick(Tick("X", t(9, 23), -1.0, None, 5500))        # invalid
    assert agg.rejected["out_of_order"] == 1 and agg.rejected["duplicate"] == 1
    assert agg.rejected["outside_session"] == 1 and agg.rejected["invalid_tick"] == 1


def test_validator_rejects_incomplete_duplicate_out_of_order_and_stale():
    v = CandleValidator(stale_seconds=20)
    c1 = Candle("X", t(10, 0), 1, 2, 1, 2, 10, None, 5)
    assert v.accept(c1, t(10, 5, 1)) == (True, "ok")
    assert v.accept(c1, t(10, 5, 2))[1] == "duplicate"
    assert v.accept(Candle("X", t(10, 5), 1, 2, 1, 2, 10, None, 5), t(10, 7))[1] == "incomplete"
    assert v.accept(Candle("X", t(9, 55), 1, 2, 1, 2, 10, None, 5), t(10, 5, 5))[1] == "out_of_order"
    assert v.accept(Candle("X", t(10, 5), 1, 2, 1, 2, 10, None, 5), t(10, 30))[1] == "stale"
    assert v.accept(Candle("X", t(10, 10), 5, 2, 1, 2, 10, None, 5), t(10, 15, 1))[1] == "insane_ohlcv"


# ------------------------------------------------------------------ no look-ahead in every bot's features/signals
@pytest.mark.parametrize("bot_id", list(BOT_REGISTRY))
def test_features_and_signals_never_use_future_candles(bot_id):
    bot = create_bot(bot_id)
    df = synth_candles("TST", 14, seed=3, price0=500.0)
    cut = 400
    f1 = bot.features(df)
    df2 = df.copy()
    for c in ("open", "high", "low", "close"):
        df2.loc[cut + 1:, c] = df2.loc[cut + 1:, c] * 1.7  # violently different future
    df2.loc[cut + 1:, "volume"] = df2.loc[cut + 1:, "volume"] * 25
    f2 = bot.features(df2)
    for col in f1.a:
        a, b = np.asarray(f1[col][:cut + 1], dtype=float), np.asarray(f2[col][:cut + 1], dtype=float)
        assert np.array_equal(a, b, equal_nan=True), f"{bot_id}: column {col} changed when only the future changed"
    for i in range(cut - 30, cut + 1):
        assert bot.evaluate_at(f1, i).signal == bot.evaluate_at(f2, i).signal


@pytest.mark.parametrize("bot_id", list(BOT_REGISTRY))
def test_evaluate_latest_ignores_incomplete_candle(bot_id):
    bot = create_bot(bot_id)
    df = synth_candles("TST", 3, seed=5)
    candles = [Candle("TST", r.start.to_pydatetime(), r.open, r.high, r.low, r.close, r.volume, None, 5)
               for r in df.itertuples()]
    now = candles[150].end
    d, _ = bot.evaluate_latest(candles, now)
    assert d.candle_start == candles[150].start  # candle 150 ended exactly at `now`; 151+ are future
    d2, _ = bot.evaluate_latest(candles, now - timedelta(seconds=1))
    assert d2.candle_start == candles[149].start  # candle 150 not complete one second earlier


# ------------------------------------------------------------------ backtest invariants (synthetic data: plumbing only)
def _data(n_days=40):
    syms = ["AAA", "BBB", "CCC"]
    data = {s: synth_candles(s, n_days, seed=20 + i, price0=300.0 + 150 * i, vol_spike_prob=0.15)
            for i, s in enumerate(syms)}
    return data, {s: Instrument(s, str(10 + i)) for i, s in enumerate(syms)}


@pytest.fixture(scope="module")
def runs():
    data, inst = _data()
    out = {}
    for bid in BOT_REGISTRY:
        out[bid] = Backtester(create_bot(bid), data, inst).run()
    return data, inst, out


def test_backtest_invariants_all_bots(runs):
    data, inst, out = runs
    total = 0
    for bid, res in out.items():
        trades = sorted(res.trades, key=lambda x: x.entry_ts)
        total += len(trades)
        per_day = Counter(tr.entry_ts.date() for tr in trades)
        assert all(v <= 2 for v in per_day.values()), f"{bid}: more than 2 entries/day"
        for a, b in zip(trades, trades[1:]):
            assert b.entry_ts >= a.exit_ts, f"{bid}: overlapping positions (max 1 open)"
        for tr in trades:
            assert tr.entry_ts.date() == tr.exit_ts.date(), "intraday only"
            assert tr.exit_ts.time() <= time(15, 30)
            assert tr.quantity * tr.entry_price <= 18_000 + 1e-6
            assert tr.net_pnl == pytest.approx(tr.gross_pnl - tr.slippage_cost - tr.charges, abs=0.03)
            assert tr.charges > 0
            df = data[tr.symbol]
            row = df[df["start"] == pd.Timestamp(tr.entry_ts)]
            assert len(row) == 1 and tr.entry_ref == pytest.approx(float(row["open"].iloc[0]), abs=0.051), \
                f"{bid}: entry must execute at the NEXT candle's open, not the signal candle's close"
    assert total > 0, "synthetic run produced no trades at all: test data is not exercising the engine"


def test_backtest_is_deterministic():
    data, inst = _data(20)
    a = Backtester(create_bot("BOT_01_VWAP_EMA_VOLUME"), data, inst).run()
    b = Backtester(create_bot("BOT_01_VWAP_EMA_VOLUME"), data, inst).run()
    assert [t.to_row() for t in a.trades] == [t.to_row() for t in b.trades]


def test_backtest_persists_and_exports(tmp_path, runs):
    _, _, out = runs
    res = next(r for r in out.values() if r.trades)
    store = Store()
    run_id = res.persist(store, "t1", "a1")
    assert store.one("SELECT COUNT(*) n FROM backtest_runs WHERE run_id=?", (run_id,))["n"] == 1
    assert store.one("SELECT COUNT(*) n FROM backtest_trades WHERE run_id=?", (run_id,))["n"] == len(res.trades)
    res.to_csv(tmp_path / "t.csv")
    res.to_json(tmp_path / "t.json")
    assert (tmp_path / "t.csv").read_text().startswith("symbol,")


# ------------------------------------------------------------------ metrics
def _tr(net, r, day=1, h=10):
    e = datetime(2026, 11, day, h, 0, tzinfo=IST)
    return TradeRecord("X", e, e + timedelta(minutes=30), 10, 100, 100, 100, 100, net, 0, 0, net, 100, r, "TARGET")


def test_metrics_hand_checked():
    trades = [_tr(100, 1.0, 1), _tr(-50, -0.5, 2), _tr(200, 2.0, 3), _tr(-100, -1.0, 4)]
    m = compute_metrics(trades, 20_000.0)
    assert m["trade_count"] == 4 and m["net_profit"] == 150
    assert m["win_rate"] == pytest.approx(0.5)
    assert m["profit_factor"] == pytest.approx(300 / 150)
    assert m["expectancy"] == pytest.approx(37.5)
    assert m["max_drawdown_abs"] == pytest.approx(100.0)  # peak 250 -> 150
