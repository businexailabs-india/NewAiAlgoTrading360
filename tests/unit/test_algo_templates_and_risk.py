from __future__ import annotations

import pytest

from algo_templates import create_strategy_from_template, list_templates
from paper_broker import PaperBroker
from risk_rules import RiskGuard360
from schemas.paper import OrderSide, OrderType, PaperOrder
from schemas.risk import RiskRules
from schemas.strategy import StrategyConfig
from strategy_engine import validate_strategy
from market_simulator import MockMarketDataFeed, SAMPLE_SYMBOLS


def test_all_templates_generate_valid_strategy_config():
    templates = list_templates()
    assert len(templates) >= 11
    for t in templates:
        s = create_strategy_from_template(t["template_id"], symbols=["RELIANCE"])
        assert isinstance(s, StrategyConfig)
        assert s.live_trading_enabled is False
        assert s.paper_trading_required is True
        assert s.risk_rules.stop_loss_percent > 0
        assert "risk" in s.risk_warning.lower() or "loss" in s.risk_warning.lower()


def test_validation_requires_stop_loss():
    s = create_strategy_from_template("ma_crossover")
    s.risk_rules = RiskRules(stop_loss_percent=0.01)  # still > 0
    ok = validate_strategy(s)
    assert ok.ok is True
    # force invalid via guard path
    s.risk_rules.stop_loss_percent = 0
    # pydantic may prevent <=0 — use model_construct
    bad = StrategyConfig.model_construct(
        strategy_name="bad",
        strategy_type="x",
        symbols=["RELIANCE"],
        risk_rules=RiskRules.model_construct(stop_loss_percent=0, max_daily_loss=1, max_position_value=1),
        live_trading_enabled=True,
        paper_trading_required=False,
    )
    result = RiskGuard360().validate_strategy(bad)
    assert result.allowed is False
    assert any("stop_loss" in b or "live_trading" in b for b in result.breaches)


def test_live_trading_false_by_default():
    s = StrategyConfig(strategy_name="t", strategy_type="x", symbols=["TCS"])
    assert s.live_trading_enabled is False


def test_risk_rejects_oversized_order():
    broker = PaperBroker()
    acct = broker.create_account("u1")
    order = PaperOrder(
        account_id=acct.account_id,
        symbol="RELIANCE",
        side=OrderSide.BUY,
        quantity=10_000,
        order_type=OrderType.MARKET,
    )
    filled = broker.place_order(order, RiskRules(max_position_value=1000))
    assert filled.status.value == "REJECTED"
    assert "max_position_value" in (filled.reject_reason or "")


def test_paper_broker_updates_positions_and_pnl():
    broker = PaperBroker()
    acct = broker.create_account("u1", 1_000_000)
    buy = PaperOrder(
        account_id=acct.account_id, symbol="RELIANCE", side=OrderSide.BUY, quantity=2, order_type=OrderType.MARKET
    )
    buy = broker.place_order(buy)
    assert buy.status.value == "FILLED"
    positions = broker.list_positions(acct.account_id)
    assert positions[0]["quantity"] == 2
    sell = PaperOrder(
        account_id=acct.account_id, symbol="RELIANCE", side=OrderSide.SELL, quantity=2, order_type=OrderType.MARKET
    )
    sell = broker.place_order(sell)
    assert sell.status.value == "FILLED"
    assert len(broker.list_trades(acct.account_id)) == 1


def test_kill_switch_blocks_orders():
    risk = RiskGuard360()
    broker = PaperBroker(risk=risk)
    acct = broker.create_account("u1")
    risk.trigger_kill_switch("test")
    order = PaperOrder(
        account_id=acct.account_id, symbol="TCS", side=OrderSide.BUY, quantity=1, order_type=OrderType.MARKET
    )
    filled = broker.place_order(order)
    assert filled.status.value == "REJECTED"
    assert "kill_switch" in (filled.reject_reason or "")


def test_market_simulator_creates_candles():
    feed = MockMarketDataFeed()
    for sym in SAMPLE_SYMBOLS:
        candles = feed.generate_candles(sym, "5m", n=50, regime="trending")
        assert len(candles) == 50
        assert candles[0].open > 0
    q = feed.get_quote("NIFTY")
    assert q.ltp > 0
