"""Dhan Live Market Feed v2: binary packet parsing, subscription messages and a reconnecting client.

Packet layouts follow https://dhanhq.co/docs/v2/live-market-feed/ (little-endian; 8-byte header:
response code u8, message length i16, exchange segment u8, security id i32). Not yet verified against live data.
"""

from __future__ import annotations

import asyncio
import json
import struct
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from tradex_bots.candles import Tick
from tradex_bots.models import Quote
from tradex_bots.timeutil import IST

REQ_SUBSCRIBE_TICKER, REQ_SUBSCRIBE_QUOTE, REQ_SUBSCRIBE_FULL, REQ_DISCONNECT = 15, 17, 21, 12
RESP_TICKER, RESP_QUOTE, RESP_PREV_CLOSE, RESP_FULL, RESP_DISCONNECT = 2, 4, 6, 8, 50
SEGMENT_NSE_EQ = 1
HEADER = struct.Struct("<BhBi")  # code, length, segment, security_id


@dataclass
class FeedPacket:
    kind: str
    security_id: int
    ltp: float | None = None
    ltt: datetime | None = None
    atp: float | None = None
    volume: int | None = None
    bid: float | None = None
    ask: float | None = None
    disconnect_code: int | None = None


def _dt(epoch: int) -> datetime:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).astimezone(IST)


def parse_packet(buf: bytes) -> FeedPacket | None:
    if len(buf) < HEADER.size:
        return None
    code, _length, _seg, sec = HEADER.unpack_from(buf, 0)
    p = buf[HEADER.size:]
    if code == RESP_TICKER and len(p) >= 8:
        ltp, ltt = struct.unpack_from("<fi", p)
        return FeedPacket("ticker", sec, ltp=ltp, ltt=_dt(ltt))
    if code in (RESP_QUOTE, RESP_FULL) and len(p) >= 42:
        ltp, _lq, ltt, atp, vol = struct.unpack_from("<fhifi", p)
        pkt = FeedPacket("quote" if code == RESP_QUOTE else "full", sec, ltp=ltp, ltt=_dt(ltt), atp=atp, volume=vol)
        if code == RESP_FULL and len(p) >= 154:  # depth: 5 x 20 bytes starting after 54 payload bytes
            bq, aq, nb, na, bp, ap = struct.unpack_from("<iihhff", p, 54)
            if bp > 0 and ap > 0:
                pkt.bid, pkt.ask = bp, ap
        return pkt
    if code == RESP_DISCONNECT and len(p) >= 2:
        return FeedPacket("disconnect", sec, disconnect_code=struct.unpack_from("<h", p)[0])
    return FeedPacket("other", sec)


def subscribe_message(security_ids: list[str], request_code: int = REQ_SUBSCRIBE_FULL,
                      segment: str = "NSE_EQ") -> list[str]:
    """JSON subscribe messages (max 100 instruments per message)."""
    msgs = []
    for i in range(0, len(security_ids), 100):
        chunk = security_ids[i:i + 100]
        msgs.append(json.dumps({"RequestCode": request_code, "InstrumentCount": len(chunk),
                                "InstrumentList": [{"ExchangeSegment": segment, "SecurityId": s} for s in chunk]}))
    return msgs


class FeedHealth:
    """Data-freshness monitor feeding Health.data_fresh / feed_connected."""

    def __init__(self, stale_after_s: float = 20.0, clock: Callable[[], float] = time.monotonic):
        self.stale_after, self.clock = stale_after_s, clock
        self.connected = False
        self.last_tick = 0.0
        self.reconnects = 0

    def tick(self) -> None:
        self.last_tick = self.clock()

    @property
    def fresh(self) -> bool:
        return self.connected and (self.clock() - self.last_tick) <= self.stale_after


class DhanFeedClient:
    """Async reconnecting WebSocket client. `connect_fn(url)` is injectable so tests never open a socket."""

    def __init__(self, url_factory: Callable[[], str], security_ids: dict[str, str],
                 on_tick: Callable[[Tick], None], on_quote: Callable[[Quote], None] | None = None,
                 health: FeedHealth | None = None, connect_fn=None, max_backoff_s: float = 30.0):
        self.url_factory = url_factory  # builds the URL with token at connect time; never logged
        self.sec_to_sym = {v: k for k, v in security_ids.items()}
        self.on_tick, self.on_quote = on_tick, on_quote
        self.health = health or FeedHealth()
        self.connect_fn = connect_fn
        self.max_backoff = max_backoff_s
        self._stop = False

    def handle(self, raw: bytes) -> None:
        pkt = parse_packet(raw)
        if pkt is None:
            return
        sym = self.sec_to_sym.get(str(pkt.security_id))
        if pkt.kind == "disconnect":
            self.health.connected = False
            return
        if sym is None or pkt.ltp is None:
            return
        self.health.tick()
        self.on_tick(Tick(sym, pkt.ltt or datetime.now(IST), float(pkt.ltp), None, pkt.volume, pkt.atp))
        if self.on_quote:
            self.on_quote(Quote(sym, pkt.ltt or datetime.now(IST), float(pkt.ltp), pkt.bid, pkt.ask, pkt.volume))

    async def run(self) -> None:
        import websockets  # imported lazily so the library has no hard dependency

        connect = self.connect_fn or websockets.connect
        backoff = 1.0
        while not self._stop:
            try:
                async with connect(self.url_factory()) as ws:
                    self.health.connected = True
                    backoff = 1.0
                    for m in subscribe_message(list(self.sec_to_sym)):
                        await ws.send(m)
                    async for raw in ws:
                        if isinstance(raw, (bytes, bytearray)):
                            self.handle(bytes(raw))
            except Exception:  # noqa: BLE001 - any failure => mark unhealthy and reconnect with backoff
                self.health.connected = False
                self.health.reconnects += 1
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, self.max_backoff)

    def stop(self) -> None:
        self._stop = True
