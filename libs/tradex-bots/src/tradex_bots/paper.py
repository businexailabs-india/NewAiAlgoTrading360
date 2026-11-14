"""Paper-trading simulator implementing the SAME BrokerAdapter interface as the Dhan live executor.

Each PaperBroker is a separate virtual ledger (never pooled with real money). It simulates order latency,
bid/ask execution, partial fills, charges, stop-loss triggers and broker-like rejections / disconnections.
State is in-memory; the OMS persists intents/fills/positions to the database. (Restoring a PaperBroker's own
ledger after a process restart is NOT implemented - see docs/algo-bots/KNOWN_LIMITATIONS.md.)
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable

from tradex_bots.broker import (
    BrokerAck,
    BrokerError,
    BrokerOrder,
    BrokerOrderRequest,
    BrokerPosition,
    BrokerRejected,
    BrokerStatus,
    BrokerTimeout,
    BrokerTrade,
)
from tradex_bots.config import ExecutionMode
from tradex_bots.costs import Execution, FeeModel
from tradex_bots.models import Quote, Side
from tradex_bots.timeutil import now_ist


@dataclass
class _POrder:
    order_id: str
    req: BrokerOrderRequest
    eligible_at: datetime
    status: BrokerStatus = BrokerStatus.TRANSIT
    filled: int = 0
    avg: float = 0.0
    error: str = ""
    triggered: bool = False
    updated_at: datetime | None = None


class PaperBroker:
    mode = ExecutionMode.PAPER

    def __init__(self, starting_cash: float = 20_000.0, fees: FeeModel | None = None, *, latency_ms: int = 300,
                 default_half_spread_bps: float = 2.0, partial_fill_prob: float = 0.0, partial_ratio: float = 0.5,
                 reject_prob: float = 0.0, seed: int = 11, clock: Callable[[], datetime] = now_ist):
        self.starting_cash, self.cash = starting_cash, starting_cash
        self.fees = fees or FeeModel()
        self.latency = timedelta(milliseconds=latency_ms)
        self.half_spread = default_half_spread_bps / 20_000.0
        self.partial_prob, self.partial_ratio, self.reject_prob = partial_fill_prob, partial_ratio, reject_prob
        self.rng = random.Random(seed)
        self.clock = clock
        self.connected = True
        self.fail_next_place: str | None = None  # 'timeout_before' | 'timeout_after' (test hook)
        self.orders: dict[str, _POrder] = {}
        self.trades: list[BrokerTrade] = []
        self.positions: dict[str, list[float]] = {}  # symbol -> [net_qty, avg_price]
        self.quotes: dict[str, Quote] = {}
        self.charges_paid = 0.0
        self._n = 0

    # ------------------------------------------------------------------ market events
    def on_quote(self, q: Quote) -> None:
        self.quotes[q.symbol] = q
        self._process(q.ts)

    def _bid_ask(self, sym: str) -> tuple[float, float] | None:
        q = self.quotes.get(sym)
        if q is None:
            return None
        bid = q.bid if q.bid else q.ltp * (1 - self.half_spread)
        ask = q.ask if q.ask else q.ltp * (1 + self.half_spread)
        return bid, ask

    def _process(self, now: datetime) -> None:
        for o in list(self.orders.values()):
            if o.status.terminal or o.eligible_at > now:
                continue
            ba = self._bid_ask(o.req.symbol)
            if ba is None:
                continue
            bid, ask = ba
            r = o.req
            if o.status == BrokerStatus.TRANSIT:
                o.status = BrokerStatus.PENDING
            px = None
            if r.order_type == "MARKET":
                px = ask if r.side == Side.BUY else bid
            elif r.order_type == "LIMIT":
                if r.side == Side.BUY and ask <= r.price:
                    px = min(ask, r.price)
                elif r.side == Side.SELL and bid >= r.price:
                    px = max(bid, r.price)
            elif r.order_type in ("STOP_LOSS_MARKET", "STOP_LOSS"):
                if r.side == Side.SELL and bid <= r.trigger_price:
                    o.triggered = True
                    px = bid  # may be worse than the trigger on a gap
                elif r.side == Side.BUY and ask >= r.trigger_price:
                    o.triggered = True
                    px = ask
            if px is None:
                continue
            remaining = r.quantity - o.filled
            qty = remaining
            if self.partial_prob and remaining > 1 and self.rng.random() < self.partial_prob:
                qty = max(1, math.ceil(remaining * self.partial_ratio))
            self._fill(o, qty, round(px, 2), now)

    def _fill(self, o: _POrder, qty: int, px: float, now: datetime) -> None:
        r = o.req
        notional = qty * px
        ch = float(self.fees.charges([Execution(o.order_id, r.side, qty, px)]).total)
        if r.side == Side.BUY:
            if notional + ch > self.cash + 1e-9:
                o.status, o.error = BrokerStatus.REJECTED, "insufficient_funds"
                return
            self.cash -= notional + ch
            net, avg = self.positions.get(r.symbol, [0, 0.0])
            new = net + qty
            self.positions[r.symbol] = [new, (avg * net + px * qty) / new]
        else:
            net, avg = self.positions.get(r.symbol, [0, 0.0])
            if qty > net:
                o.status, o.error = BrokerStatus.REJECTED, "would_create_short"
                return
            self.cash += notional - ch
            self.positions[r.symbol] = [net - qty, avg if net - qty else 0.0]
        self.charges_paid += ch
        o.avg = (o.avg * o.filled + px * qty) / (o.filled + qty)
        o.filled += qty
        o.status = BrokerStatus.TRADED if o.filled >= r.quantity else BrokerStatus.PART_TRADED
        o.updated_at = now
        self._n += 1
        self.trades.append(BrokerTrade(f"PT{self._n:08d}", o.order_id, r.symbol, r.side, qty, px, now))

    # ------------------------------------------------------------------ BrokerAdapter
    def _need_conn(self) -> None:
        if not self.connected:
            raise BrokerError("paper_broker_disconnected")

    def place_order(self, req: BrokerOrderRequest) -> BrokerAck:
        if not self.connected:
            raise BrokerTimeout("paper_broker_disconnected")
        if self.fail_next_place == "timeout_before":
            self.fail_next_place = None
            raise BrokerTimeout("simulated timeout before reaching broker")
        if req.quantity <= 0 or req.correlation_id == "":
            raise BrokerRejected("invalid_order")
        if self.reject_prob and self.rng.random() < self.reject_prob:
            raise BrokerRejected("simulated_broker_rejection")
        ba = self._bid_ask(req.symbol)
        if req.side == Side.BUY and ba and req.quantity * ba[1] > self.cash:
            raise BrokerRejected("insufficient_funds")
        if req.side == Side.SELL and req.quantity > self.positions.get(req.symbol, [0, 0.0])[0]:
            raise BrokerRejected("would_create_short")
        self._n += 1
        oid = f"PO{self._n:08d}"
        now = self.clock()
        self.orders[oid] = _POrder(oid, req, now + self.latency, updated_at=now)
        if self.fail_next_place == "timeout_after":
            self.fail_next_place = None
            raise BrokerTimeout("simulated lost acknowledgement (order WAS accepted)")
        return BrokerAck(oid, BrokerStatus.TRANSIT)

    def _bo(self, o: _POrder) -> BrokerOrder:
        r = o.req
        return BrokerOrder(o.order_id, r.correlation_id, o.status, r.symbol, r.side, r.quantity, o.filled, o.avg,
                           r.order_type, r.price, r.trigger_price, o.error, o.updated_at)

    def get_order(self, order_id: str) -> BrokerOrder | None:
        self._need_conn()
        o = self.orders.get(order_id)
        return self._bo(o) if o else None

    def get_order_by_correlation(self, correlation_id: str) -> BrokerOrder | None:
        self._need_conn()
        for o in self.orders.values():
            if o.req.correlation_id == correlation_id:
                return self._bo(o)
        return None

    def cancel_order(self, order_id: str) -> BrokerOrder:
        self._need_conn()
        o = self.orders.get(order_id)
        if o is None:
            raise BrokerRejected("order_not_found")
        if not o.status.terminal:
            o.status, o.updated_at = BrokerStatus.CANCELLED, self.clock()
        return self._bo(o)

    def list_orders(self) -> list[BrokerOrder]:
        self._need_conn()
        return [self._bo(o) for o in self.orders.values()]

    def list_trades(self) -> list[BrokerTrade]:
        self._need_conn()
        return list(self.trades)

    def list_positions(self) -> list[BrokerPosition]:
        self._need_conn()
        return [BrokerPosition(s, int(v[0]), v[1]) for s, v in self.positions.items() if v[0] != 0]

    def get_funds(self) -> float:
        self._need_conn()
        return self.cash

    def get_quote(self, symbol: str) -> Quote | None:
        return self.quotes.get(symbol)

    def healthy(self) -> bool:
        return self.connected
