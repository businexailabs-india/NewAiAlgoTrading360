"""Shared in-process runtime for Algo MVP services (paper-only)."""

from __future__ import annotations

from functools import lru_cache

from algo_templates import AlgoLibrary360
from market_simulator import MockMarketDataFeed
from paper_broker import PaperBroker
from risk_rules import RiskGuard360
from strategy_engine import StrategyEngine


class AlgoPlatformRuntime:
    def __init__(self):
        self.market = MockMarketDataFeed(seed=7)
        self.risk = RiskGuard360()
        self.broker = PaperBroker(risk=self.risk, market=self.market)
        self.engine = StrategyEngine(broker=self.broker, risk=self.risk, market=self.market)
        self.library = AlgoLibrary360()
        self.seeded = False


@lru_cache(maxsize=1)
def get_runtime() -> AlgoPlatformRuntime:
    rt = AlgoPlatformRuntime()
    seed_demo_data(rt)
    return rt


def seed_demo_data(rt: AlgoPlatformRuntime | None = None) -> dict:
    rt = rt or get_runtime()
    if rt.seeded:
        return {"ok": True, "already_seeded": True}
    acct = rt.broker.create_account("demo-user", starting_balance=1_000_000.0)
    # Force known demo account id for docs/tests
    old_id = acct.account_id
    acct.account_id = "demo-paper-account"
    rt.broker.accounts["demo-paper-account"] = acct
    if old_id in rt.broker.accounts and old_id != "demo-paper-account":
        del rt.broker.accounts[old_id]

    from algo_templates import create_strategy_from_template

    sample = create_strategy_from_template(
        "ma_crossover",
        symbols=["RELIANCE"],
        created_by="demo-user",
        strategy_name="Demo MA Crossover RELIANCE",
    )
    sample.strategy_id = "demo-ma-strategy"
    rt.engine.save_strategy(sample)
    rt.seeded = True
    return {
        "ok": True,
        "demo_user": "demo-user",
        "paper_account_id": "demo-paper-account",
        "starting_balance": 1_000_000.0,
        "sample_strategy_id": "demo-ma-strategy",
        "templates": len(rt.library.list_templates()),
        "live_trading_enabled": False,
    }
