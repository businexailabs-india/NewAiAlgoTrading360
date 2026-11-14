"""BotRunner: the paper/live execution loop. One runner serves one account+mode.

Pipeline per completed 5-minute candle:
  validate candle -> (indicator exits for held positions) -> evaluate every active bot -> arbitrate signals
  -> central risk check + fee-inclusive sizing -> capital reservation -> persist intent -> OMS submit.
The same BotStrategy / RiskEngine / OrderManager classes are used by the backtester, paper and live modes.

Live mode additionally requires the OrderManager's live guard (LiveModeGate). The runner never decides to go live.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable

from tradex_bots.arbitration import Candidate, CapitalAllocator, SignalArbiter
from tradex_bots.bots.base import BotStrategy, GuardState
from tradex_bots.broker import BrokerAdapter, BrokerError
from tradex_bots.candles import CandleValidator
from tradex_bots.config import EngineConfig, ExecutionMode
from tradex_bots.instruments import Instrument
from tradex_bots.models import Candle, ExitReason, Quote, Side
from tradex_bots.oms import OrderManager
from tradex_bots.risk import EntryRequest, Health, RiskEngine
from tradex_bots.store import Store
from tradex_bots.timeutil import ist_date, to_ist

HISTORY_BARS = 300  # ~4 sessions: ample for 100-bar warm-up; bounds per-candle compute


@dataclass
class RunnerEvent:
    kind: str
    symbol: str = ""
    bot_id: str = ""
    detail: dict = field(default_factory=dict)


class BotRunner:
    def __init__(self, *, store: Store, cfg: EngineConfig, mode: ExecutionMode, broker: BrokerAdapter,
                 om: OrderManager, risk: RiskEngine, allocator: CapitalAllocator, arbiter: SignalArbiter,
                 bots: list[BotStrategy], instruments: dict[str, Instrument],
                 health_fn: Callable[[], Health] | None = None, clock: Callable[[], datetime] | None = None):
        self.store, self.cfg, self.mode, self.broker = store, cfg, mode, broker
        self.om, self.risk, self.alloc, self.arbiter = om, risk, allocator, arbiter
        self.bots = {b.bot_id: b for b in bots}
        self.instruments = instruments
        om.instruments.update(instruments)
        self.health_fn = health_fn or (lambda: Health())
        self.clock = clock
        self.validator = CandleValidator()
        self.guard = GuardState()
        self.candles: dict[str, list[Candle]] = defaultdict(list)
        self.last_price: dict[str, float] = {}
        self._squared_off: set = set()
        self.events: list[RunnerEvent] = []
        self.active_bots: set[str] = set()  # bots the operator has started (desired state)

    # ------------------------------------------------------------------ setup
    def seed_history(self, symbol: str, candles: list[Candle]) -> None:
        self.candles[symbol] = list(candles)[-HISTORY_BARS:]

    def start_bot(self, bot_id: str) -> None:
        if bot_id not in self.bots:
            raise KeyError(bot_id)
        self.active_bots.add(bot_id)

    def stop_bot(self, bot_id: str) -> None:
        self.active_bots.discard(bot_id)

    def _emit(self, kind: str, **kw) -> RunnerEvent:
        e = RunnerEvent(kind, kw.pop("symbol", ""), kw.pop("bot_id", ""), kw)
        self.events.append(e)
        return e

    # ------------------------------------------------------------------ market events
    def on_quote(self, q: Quote) -> list[str]:
        self.last_price[q.symbol] = q.ltp
        if hasattr(self.broker, "on_quote"):
            self.broker.on_quote(q)  # paper broker matches orders against quotes
        acts = self.om.on_price(q.symbol, q.ltp)
        return acts

    def _health(self) -> Health:
        h = self.health_fn()
        h.broker_connected = h.broker_connected and self.broker.healthy()
        h.reconciled = h.reconciled and self.om.reconciled and self.om.recovered
        return h

    def on_candle(self, c: Candle, now: datetime) -> list[RunnerEvent]:
        """Called once per completed candle. Returns the events produced (also appended to self.events)."""
        start = len(self.events)
        ok, why = self.validator.accept(c, now)
        if not ok:
            self.store.health_event("candle_rejected", why, {"symbol": c.symbol, "start": c.start.isoformat()},
                                    tenant_id=self.cfg.tenant_id, account_id=self.cfg.account_id)
            self._emit("candle_rejected", symbol=c.symbol, reason=why)
            return self.events[start:]
        buf = self.candles[c.symbol]
        buf.append(c)
        del buf[:-HISTORY_BARS]
        self.last_price[c.symbol] = c.close
        self.om.poll()  # apply fills / place protection before deciding anything
        self._indicator_exits(c, now)
        if self._maybe_square_off(now):
            return self.events[start:]
        self._entries(c, now)
        return self.events[start:]

    # ------------------------------------------------------------------ exits
    def _indicator_exits(self, c: Candle, now: datetime) -> None:
        for p in self.om.open_positions():
            if p["symbol"] != c.symbol or p["exit_reason"]:
                continue
            bot = self.bots.get(p["bot_id"] or "")
            if bot is None:
                continue
            f = bot.features(self._frame(c.symbol))
            reason = bot.exit_signal(f, f.n - 1)
            if reason is not None:
                res = self.om.exit_on_signal(c.symbol, reason, ref_price=c.close)
                self._emit("indicator_exit", symbol=c.symbol, bot_id=bot.bot_id, reason=reason.value, result=res)

    @staticmethod
    def _frame_of(candles):
        from tradex_bots.indicators import candles_to_frame

        return candles_to_frame(candles)

    def _frame(self, symbol: str):
        from tradex_bots.indicators import candles_to_frame

        return candles_to_frame(self.candles[symbol])

    def _maybe_square_off(self, now: datetime) -> bool:
        now = to_ist(now)
        day = ist_date(now)
        any_bot = next(iter(self.bots.values()))
        if now.time() < any_bot.p.forced_squareoff:
            return False
        if day not in self._squared_off:
            self._squared_off.add(day)
            res = self.om.flatten_all(ExitReason.TIME_SQUAREOFF)
            self._emit("forced_squareoff", results=res)
        return True

    def square_off_now(self, reason: ExitReason = ExitReason.TIME_SQUAREOFF) -> list[str]:
        return self.om.flatten_all(reason)

    # ------------------------------------------------------------------ entries
    def _entries(self, c: Candle, now: datetime) -> None:
        sym = c.symbol
        inst = self.instruments.get(sym)
        if inst is None:
            self._emit("no_instrument", symbol=sym)
            return
        close_t = to_ist(c.end).time()
        if not any(self.bots[b].p.entry_window_start <= close_t <= self.bots[b].p.entry_window_end
                   for b in self.active_bots):
            return  # no active bot can enter now: skip the (comparatively expensive) feature computation
        blocked = self.om.entries_blocked()
        cands: list[Candidate] = []
        feats = {}
        now_i = to_ist(now)
        done = [x for x in self.candles[sym] if x.end <= now_i]
        frame = self._frame_of(done) if done else None
        for bid in sorted(self.active_bots):
            bot = self.bots[bid]
            dec, f = bot.evaluate_latest(self.candles[sym], now, frame)
            if dec is None or not dec.signal:
                continue
            if self.mode == ExecutionMode.LIVE and bid not in self.arbiter.live_enabled:
                pass  # arbitration records the rejection reason
            ok, why = self.guard.can_enter(bot, sym, now)
            if not ok:
                self.arbiter.record_signal(dec, bot, "REJECTED", [why])
                continue
            cands.append(Candidate(bot, dec))
            feats[bid] = f
        if not cands:
            return
        held = {p["symbol"] for p in self.om.open_positions()}
        pend_rows = self.om.pending_entries()
        results = self.arbiter.arbitrate(cands, held_symbols=held, pending_symbols={r["symbol"] for r in pend_rows},
                                         open_count=len(held), pending_count=len(pend_rows))
        for r in results:
            if not r.accepted:
                self._emit("signal_rejected", symbol=sym, bot_id=r.candidate.decision.bot_id, reasons=r.reasons)
                continue
            self._execute_candidate(r.candidate, feats[r.candidate.decision.bot_id], inst, now, blocked)

    def _execute_candidate(self, cand: Candidate, f, inst: Instrument, now: datetime, blocked: list[str]) -> None:
        bot, dec = cand.bot, cand.decision
        sym = dec.symbol
        reject = lambda reasons: (self.arbiter.set_status(dec, "REJECTED", reasons),  # noqa: E731
                                  self._emit("entry_rejected", symbol=sym, bot_id=bot.bot_id, reasons=reasons))
        if blocked:
            reject(blocked)
            return
        q = self.broker.get_quote(sym)
        ref = (q.ask if q and q.ask else None) or (q.ltp if q else None) or f["close"][f.n - 1]
        levels, why = bot.build_levels(f, f.n - 1, float(ref), inst.tick_size)
        if levels is None:
            reject([f"levels:{why}"])
            return
        try:
            funds = self.broker.get_funds()
        except BrokerError as e:
            reject([f"funds_unavailable:{e}"])
            return
        avail = self.alloc.available_after_reservations(funds)
        decision = self.risk.check_entry(EntryRequest(
            bot_id=bot.bot_id, symbol=sym, instrument=inst, levels=levels, params=bot.p, now=now,
            available_funds=avail, health=self._health(), quote=q,
            open_positions=self.om.open_risk_view(self.last_price), pending_entry_orders=len(self.om.pending_entries()),
            require_quote=self.mode == ExecutionMode.LIVE))
        if not decision.approved or decision.sizing is None:
            reject(decision.reasons)
            return
        qty = decision.sizing.quantity
        notional = qty * levels.entry_price
        rid = self.alloc.reserve(bot.bot_id, sym, notional, funds,
                                 open_notional=sum(p["quantity"] * p["avg_price"] for p in self.om.open_positions()))
        if rid is None:
            reject(["capital_reservation_failed"])
            return
        iid, created = self.om.create_intent(
            bot_id=bot.bot_id, strategy_version=bot.version, config_hash=bot.config_hash, symbol=sym,
            security_id=inst.security_id, side=Side.BUY,
            role="ENTRY", quantity=qty, order_type="MARKET", dedupe_key=f"{bot.bot_id}:{sym}:{dec.candle_start.isoformat()}",
            ref_price=levels.entry_price, ref_bid=q.bid if q else None, ref_ask=q.ask if q else None,
            planned={"entry_price": levels.entry_price, "stop_price": levels.stop_price,
                     "stop_distance": levels.stop_distance, "target_price": levels.target_price,
                     "planned_risk": round(qty * levels.stop_distance, 2), "sizing": decision.sizing.details})
        if not created:
            self.alloc.settle(rid, "RELEASED")
            reject(["duplicate_intent"])
            return
        self.alloc.attach_intent(rid, iid)
        self.om.approve(iid)
        self.risk.record_entry(now)
        self.guard.record_entry(bot.bot_id, sym, now)
        res = self.om.submit(iid)
        self.arbiter.set_status(dec, "SUBMITTED" if res.state.value not in ("REJECTED", "CANCELLED") else "REJECTED",
                                [res.note] if res.note else [])
        self._emit("entry_submitted", symbol=sym, bot_id=bot.bot_id, intent_id=iid, state=res.state.value,
                   qty=qty, entry=levels.entry_price, stop=levels.stop_price, target=levels.target_price)
        self.om.poll()

    # ------------------------------------------------------------------ housekeeping
    def tick(self, now: datetime) -> None:
        """Periodic (e.g. every 1-5 s): apply broker updates, protect fills, enforce square-off."""
        self.om.poll()
        self._maybe_square_off(now)
        h = self._health()
        # These facts are what the API/live gate relies on; they are measured here, never assumed by the API.
        self.store.health_event(
            "runner_heartbeat", "OK" if not h.problems() else "DEGRADED",
            {"mode": self.mode.value, "active": sorted(self.active_bots),
             "credentials_valid": bool(h.broker_connected),
             "market_data_healthy": bool(h.data_fresh and h.feed_connected),
             "broker_reconciled": bool(h.reconciled),
             "risk_engine_operational": not self.risk.kill_switch_active() and bool(h.protection_known and h.orders_known),
             "problems": h.problems()},
            tenant_id=self.cfg.tenant_id, account_id=self.cfg.account_id)


# ====================================================================== deterministic replay (paper-mode drill / tests)
def replay_candles(runner: BotRunner, clock, data: dict[str, list[Candle]], *, spread: float = 0.10) -> None:
    """Drive a runner with historical/synthetic candles through the live code path: quotes inside each candle
    (open, low, high, close - pessimistic order), then the candle-close event. `clock` must be the shared Clock used
    by the runner's OrderManager and PaperBroker."""
    items = sorted((c for cs in data.values() for c in cs), key=lambda c: (c.start, c.symbol))
    for c in items:
        for px, dt in ((c.open, 1), (c.low, 100), (c.high, 200), (c.close, 299)):
            clock.t = c.start + timedelta(seconds=dt)
            runner.on_quote(Quote(c.symbol, clock.t, px, round(px - spread / 2, 2), round(px + spread / 2, 2)))
        clock.t = c.end + timedelta(seconds=1)
        runner.on_candle(c, clock.t)
        runner.tick(clock.t)
