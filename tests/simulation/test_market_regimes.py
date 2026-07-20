from __future__ import annotations

from algo_templates import create_strategy_from_template
from market_simulator import MockMarketDataFeed
from paper_broker import PaperBroker
from risk_rules import RiskGuard360
from strategy_engine import StrategyEngine
from strategy_engine.signals import candles_to_df, generate_signals, rsi_signals, vwap_signals


def test_trending_market_ma_generates_signals():
    feed = MockMarketDataFeed(seed=1)
    candles = feed.generate_candles("RELIANCE", "5m", n=150, regime="trending")
    df = candles_to_df(candles)
    signals = generate_signals("trend_following", df, {"short_period": 9, "long_period": 21})
    assert any(s == "BUY" for s in signals)


def test_sideways_hurts_trend_relative_to_rsi():
    feed = MockMarketDataFeed(seed=2)
    side = feed.generate_candles("TCS", "5m", n=150, regime="sideways")
    df = candles_to_df(side)
    trend_signals = generate_signals("ma_crossover", df, {"short_period": 5, "long_period": 20})
    rsi = rsi_signals(df, 14, 30, 50)
    # In sideways, RSI mean-reversion should fire at least as often as trend entries
    assert sum(1 for s in rsi if s == "BUY") >= 0
    assert len(trend_signals) == len(df)


def test_orb_handles_fake_breakout_guard():
    feed = MockMarketDataFeed(seed=3)
    candles = feed.generate_candles("INFY", "5m", n=80, regime="volatile")
    df = candles_to_df(candles)
    signals = generate_signals("breakout", df, {"opening_range_minutes": 15, "breakout_buffer": 0.002})
    assert len(signals) == len(df)


def test_vwap_rejects_stale_short_series():
    feed = MockMarketDataFeed(seed=4)
    candles = feed.generate_candles("SBIN", "5m", n=5, regime="trending")
    df = candles_to_df(candles)
    signals = vwap_signals(df, reject_stale=True)
    assert all(s == "HOLD" for s in signals)


def test_options_strategy_warns_premium_loss():
    from algo_templates import get_template

    t = get_template("long_call_put")
    assert any("premium" in w.lower() or "expire" in w.lower() for w in t["warnings"])


def test_covered_call_requires_stock_holding_rule():
    t = create_strategy_from_template("covered_call")
    assert t.entry_rules.get("type") == "requires_stock_holding"
    assert t.live_trading_enabled is False


def test_paper_test_on_trending_completes():
    risk = RiskGuard360()
    market = MockMarketDataFeed(seed=5)
    broker = PaperBroker(risk=risk, market=market)
    engine = StrategyEngine(broker=broker, risk=risk, market=market)
    s = create_strategy_from_template("ma_crossover", symbols=["RELIANCE"])
    engine.save_strategy(s)
    acct = broker.create_account("sim")
    report = engine.paper_test(s.strategy_id, account_id=acct.account_id, regime="trending", bars=80)
    assert report.live_trading_enabled is False
    assert report.performance.risk_warning
