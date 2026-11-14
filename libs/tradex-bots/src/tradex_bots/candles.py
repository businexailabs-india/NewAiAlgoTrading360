"""Tick -> exchange-aligned 5-minute candle builder, candle validation and missing-candle detection.

Alignment: buckets start at 09:15 IST and are `candle_minutes` wide (09:15, 09:20, ...). A candle is emitted only
when it is COMPLETE (a tick for a later bucket arrives, or `flush(now)` is called after the bucket end).
Operator note: start the feed before 09:15 so the first bucket has a cumulative-volume baseline; otherwise the
first candle is discarded as incomplete and must be backfilled from the historical API.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, time, timedelta

from tradex_bots.models import Candle
from tradex_bots.timeutil import at, to_ist


@dataclass(frozen=True)
class Tick:
    symbol: str
    ts: datetime
    price: float
    qty: float | None = None  # last traded quantity (used when cumulative volume is unavailable)
    cum_volume: float | None = None  # cumulative day volume
    atp: float | None = None  # average traded price (day VWAP) from the feed


class CandleAggregator:
    def __init__(self, symbol: str, candle_minutes: int = 5, session_open: time = time(9, 15),
                 session_close: time = time(15, 30)):
        self.symbol, self.m = symbol, candle_minutes
        self.open_t, self.close_t = session_open, session_close
        self.rejected: Counter[str] = Counter()
        self._reset_all()

    def _reset_all(self) -> None:
        self._start: datetime | None = None
        self._o = self._h = self._l = self._c = 0.0
        self._vol = 0.0
        self._turn = 0.0
        self._baseline_known = False
        self._cur_complete_quality = False
        self._last_ts: datetime | None = None
        self._last_key: tuple | None = None
        self._last_cum_vol: float | None = None
        self._last_cum_turn: float | None = None
        self._day = None

    def bucket_start(self, ts: datetime) -> datetime | None:
        ts = to_ist(ts)
        o, cl = at(ts.date(), self.open_t), at(ts.date(), self.close_t)
        if ts < o or ts >= cl:
            return None
        n = int((ts - o).total_seconds() // (self.m * 60))
        return o + timedelta(minutes=n * self.m)

    def on_tick(self, t: Tick) -> list[Candle]:
        out: list[Candle] = []
        if t.price is None or t.price <= 0 or t.symbol != self.symbol:
            self.rejected["invalid_tick"] += 1
            return out
        ts = to_ist(t.ts)
        if self._last_ts is not None and ts < self._last_ts:
            self.rejected["out_of_order"] += 1
            return out
        key = (ts, t.price, t.cum_volume, t.qty)
        if key == self._last_key:
            self.rejected["duplicate"] += 1
            return out
        b = self.bucket_start(ts)
        if b is None:
            if ts.time() < self.open_t and t.cum_volume is not None:
                # pre-open tick: establishes the cumulative-volume baseline for the first candle.
                # (Pre-open auction volume is therefore NOT part of the live 09:15 candle; historical candles
                # may include it - a known live-vs-historical difference.)
                if self._day is not None and ts.date() != self._day:
                    self._last_cum_vol = self._last_cum_turn = None
                self._day = ts.date()
                self._last_cum_vol = t.cum_volume
                self._last_cum_turn = t.atp * t.cum_volume if t.atp is not None else None
                self._last_ts = ts
                return out
            self.rejected["outside_session"] += 1
            return out
        if self._day is not None and ts.date() != self._day:  # new session: drop stale cumulative baselines
            c = self._close_current()
            if c:
                out.append(c)
            self._last_cum_vol = self._last_cum_turn = None
        self._day = ts.date()

        dv, dt_ = self._deltas(t)
        if dv is None:
            return out
        if self._start is not None and b > self._start:
            c = self._close_current()
            if c:
                out.append(c)
        if self._start is None:
            self._start = b
            self._o = self._h = self._l = t.price
            self._vol = self._turn = 0.0
            self._cur_complete_quality = self._baseline_known
        self._h, self._l, self._c = max(self._h, t.price), min(self._l, t.price), t.price
        self._vol += dv
        self._turn += dt_
        self._last_ts, self._last_key = ts, key
        return out

    def _deltas(self, t: Tick) -> tuple[float | None, float]:
        if t.cum_volume is not None:
            self._baseline_known = self._last_cum_vol is not None
            dv = 0.0 if self._last_cum_vol is None else t.cum_volume - self._last_cum_vol
            if dv < 0:
                self.rejected["cum_volume_decreased"] += 1
                return None, 0.0
            if t.atp is not None:
                cum_turn = t.atp * t.cum_volume
                dt_ = 0.0 if self._last_cum_turn is None else cum_turn - self._last_cum_turn
                self._last_cum_turn = cum_turn
            else:
                dt_ = t.price * dv
            self._last_cum_vol = t.cum_volume
            return dv, max(dt_, 0.0)
        self._baseline_known = True
        dv = float(t.qty or 0.0)
        return dv, t.price * dv

    def _close_current(self) -> Candle | None:
        if self._start is None:
            return None
        quality = self._cur_complete_quality
        c = Candle(self.symbol, self._start, self._o, self._h, self._l, self._c, self._vol,
                   self._turn if self._turn > 0 else None, self.m)
        self._start = None
        if not quality:
            self.rejected["incomplete_first_bucket"] += 1
            return None
        return c

    def flush(self, now: datetime) -> list[Candle]:
        """Close the open bucket if `now` is at/after its end (timer-driven close for quiet instruments)."""
        if self._start is not None and to_ist(now) >= self._start + timedelta(minutes=self.m):
            c = self._close_current()
            return [c] if c else []
        return []


class CandleValidator:
    """Per-symbol gate in front of the strategy: rejects duplicate, out-of-order, incomplete, insane, stale."""

    def __init__(self, stale_seconds: int = 20, candle_minutes: int = 5):
        self.stale, self.m = stale_seconds, candle_minutes
        self._last_start: dict[str, datetime] = {}
        self.rejected: Counter[str] = Counter()

    def accept(self, c: Candle, now: datetime) -> tuple[bool, str]:
        now = to_ist(now)
        last = self._last_start.get(c.symbol)
        if c.end > now:
            return self._rej("incomplete")
        if not c.is_sane():
            return self._rej("insane_ohlcv")
        if last is not None and c.start == last:
            return self._rej("duplicate")
        if last is not None and c.start < last:
            return self._rej("out_of_order")
        if (now - c.end).total_seconds() > self.m * 60 + self.stale:
            return self._rej("stale")
        self._last_start[c.symbol] = c.start
        return True, "ok"

    def _rej(self, why: str) -> tuple[bool, str]:
        self.rejected[why] += 1
        return False, why


def find_missing(candles: list[Candle], now: datetime, candle_minutes: int = 5, open_t: time = time(9, 15)) -> list[datetime]:
    """Bucket starts in today's session up to `now` that have no candle (candidates for historical backfill)."""
    if not candles:
        return []
    now = to_ist(now)
    day = now.date()
    have = {c.start for c in candles if to_ist(c.start).date() == day}
    cur, out = at(day, open_t), []
    while cur + timedelta(minutes=candle_minutes) <= now:
        if cur not in have:
            out.append(cur)
        cur += timedelta(minutes=candle_minutes)
    return out
