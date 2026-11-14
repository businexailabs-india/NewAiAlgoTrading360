"""Shared test helpers. Everything uses the in-memory SQLite store and the PaperBroker: no network, no real orders."""

from __future__ import annotations

from datetime import datetime, timedelta

from tradex_bots.arbitration import CapitalAllocator
from tradex_bots.config import EngineConfig, ExecutionMode
from tradex_bots.costs import FeeModel
from tradex_bots.instruments import Instrument
from tradex_bots.models import Quote, Side
from tradex_bots.oms import OrderManager
from tradex_bots.paper import PaperBroker
from tradex_bots.risk import RiskEngine
from tradex_bots.store import Store
from tradex_bots.timeutil import IST

SYM = "TESTCO"


class Clock:
    def __init__(self, t: datetime | None = None):
        self.t = t or datetime(2026, 11, 16, 10, 0, tzinfo=IST)  # a Monday

    def __call__(self) -> datetime:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += timedelta(seconds=seconds)


class Env:
    def __init__(self, mode: ExecutionMode = ExecutionMode.PAPER, *, store: Store | None = None, tenant: str = "t1",
                 account: str = "a1", **broker_kw):
        self.clock = Clock()
        self.store = store or Store()
        self.cfg = EngineConfig(tenant_id=tenant, account_id=account)
        self.fees = FeeModel()
        broker_kw.setdefault("latency_ms", 0)
        self.broker = PaperBroker(20_000.0, self.fees, clock=self.clock, **broker_kw)
        self.mode = mode
        self.risk = RiskEngine(self.cfg, self.store, self.fees, mode)
        self.alloc = CapitalAllocator(self.store, self.cfg, mode)
        self.alerts: list[tuple[str, dict]] = []
        self.live_ok = False
        self.om = self.make_om()

    def make_om(self) -> OrderManager:
        om = OrderManager(self.store, self.broker, self.cfg, self.mode, self.risk, self.fees, self.alloc,
                          live_guard=lambda: self.live_ok, alert=lambda k, d: self.alerts.append((k, d)),
                          clock=self.clock)
        om.recovered = True
        om.instruments[SYM] = Instrument(SYM, "1234")
        return om

    def quote(self, ltp: float, spread: float = 0.10, sym: str = SYM) -> Quote:
        q = Quote(sym, self.clock(), ltp, round(ltp - spread / 2, 2), round(ltp + spread / 2, 2), 1000)
        self.broker.on_quote(q)
        return q

    def entry(self, qty: int = 40, price: float = 400.0, stop_dist: float = 2.0, key: str = "k1", bot: str = "BOT_01_VWAP_EMA_VOLUME"):
        iid, created = self.om.create_intent(
            bot_id=bot, strategy_version="1.0.0", config_hash="h", symbol=SYM, security_id="1234", side=Side.BUY,
            role="ENTRY", quantity=qty, order_type="MARKET", dedupe_key=key, ref_price=price,
            planned={"entry_price": price, "stop_price": price - stop_dist, "stop_distance": stop_dist,
                     "target_price": price + 2 * stop_dist, "planned_risk": qty * stop_dist})
        assert created
        self.om.approve(iid)
        return iid

    def filled_position(self, **kw) -> tuple[str, str]:
        """Entry -> fill -> poll -> protection. Returns (entry_intent_id, position_id)."""
        iid = self.entry(**kw)
        self.om.submit(iid)
        self.quote(kw.get("price", 400.0))
        self.om.poll()
        return iid, f"pos-{iid}"
