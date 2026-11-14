from __future__ import annotations

import json
import struct
from datetime import datetime, timedelta, timezone

import pytest

from harness import SYM, Env
from tradex_bots.bots import ensure_bots
from tradex_bots.broker import BrokerError, BrokerOrderRequest, BrokerRejected, BrokerStatus, BrokerTimeout
from tradex_bots.config import BOT_01, BOT_02, live_trading_env_enabled
from tradex_bots.dhan import (
    DhanBroker, DhanHistoricalClient, RateLimited, TransportError, TransportTimeout,
)
from tradex_bots.dhan_feed import (
    DhanFeedClient, FeedHealth, parse_packet, subscribe_message,
)
from tradex_bots.live_gate import (
    CONFIRMATION_PHRASE, LiveActivationError, LiveAttestations, LiveModeGate, RuntimeStatus,
)
from tradex_bots.models import Side
from tradex_bots.timeutil import IST


# ------------------------------------------------------------------ live gate
def full_att() -> LiveAttestations:
    return LiveAttestations(*([True] * 9), notes={"static_ip": "ticket-123"})


def good_rt() -> RuntimeStatus:
    return RuntimeStatus(True, True, True, True)


@pytest.fixture
def gate_env(monkeypatch):
    env = Env()
    ensure_bots(env.store, "t1", "a1")
    gate = LiveModeGate(env.store, env.cfg, clock=env.clock)
    return env, gate, monkeypatch


def activate(gate, bot=BOT_01, role="trading_admin", phrase=None, att=None, rt=None):
    return gate.activate(bot_id=bot, operator="alice", role=role,
                         confirmation=phrase or CONFIRMATION_PHRASE.format(bot_id=bot), att=att or full_att(),
                         rt=rt or good_rt())


def test_live_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("TRADEX_LIVE_ENABLED", raising=False)
    assert live_trading_env_enabled() is False


def test_bots_are_registered_paper_and_not_live(gate_env):
    env, _, _ = gate_env
    rows = env.store.query("SELECT * FROM algo_bots")
    assert len(rows) == 6 and all(r["live_enabled"] == 0 and r["execution_mode"] == "PAPER" for r in rows)
    assert ensure_bots(env.store, "t1", "a1") == 0  # idempotent


def test_activation_blocked_without_env_flag(gate_env):
    env, gate, mp = gate_env
    mp.delenv("TRADEX_LIVE_ENABLED", raising=False)
    with pytest.raises(LiveActivationError, match="env_live_flag"):
        activate(gate)
    assert not gate.is_authorised(BOT_01)


def test_activation_requires_role_phrase_attestations_and_runtime(gate_env):
    env, gate, mp = gate_env
    mp.setenv("TRADEX_LIVE_ENABLED", "true")
    with pytest.raises(LiveActivationError, match="not authorised"):
        activate(gate, role="trader")
    with pytest.raises(LiveActivationError, match="confirmation"):
        activate(gate, phrase="yes please")
    with pytest.raises(LiveActivationError, match="static_ip_approved"):
        activate(gate, att=LiveAttestations(api_permissions_verified=True))
    with pytest.raises(LiveActivationError, match="broker_reconciled"):
        activate(gate, rt=RuntimeStatus(True, True, False, True))
    assert not gate.is_authorised(BOT_01)
    assert env.store.one("SELECT live_enabled FROM algo_bots WHERE bot_id=?", (BOT_01,))["live_enabled"] == 0


def test_successful_activation_is_audited_single_bot_and_expires(gate_env):
    env, gate, mp = gate_env
    mp.setenv("TRADEX_LIVE_ENABLED", "true")
    out = activate(gate)
    assert out["bot_id"] == BOT_01 and gate.is_authorised(BOT_01)
    assert not gate.is_authorised(BOT_02)
    with pytest.raises(LiveActivationError, match="single_live_bot"):
        activate(gate, bot=BOT_02)
    assert env.store.one("SELECT COUNT(*) n FROM audit_events WHERE action='live_trading_authorised'")["n"] == 1
    env.clock.advance(24 * 3600)  # next trading day: approval expired, nothing re-enables automatically
    assert not gate.is_authorised(BOT_01)


def test_kill_switch_revoke_and_env_off_each_disable_live(gate_env):
    env, gate, mp = gate_env
    mp.setenv("TRADEX_LIVE_ENABLED", "true")
    activate(gate)
    env.risk.engage_kill_switch("t", "ops")
    assert not gate.is_authorised(BOT_01)
    env.risk.release_kill_switch("ops", "ok")
    assert gate.is_authorised(BOT_01)
    mp.setenv("TRADEX_LIVE_ENABLED", "false")
    assert not gate.is_authorised(BOT_01)
    mp.setenv("TRADEX_LIVE_ENABLED", "true")
    gate.revoke(bot_id=BOT_01, by="ops", reason="done")
    assert not gate.is_authorised(BOT_01)
    assert env.store.one("SELECT execution_mode m FROM algo_bots WHERE bot_id=?", (BOT_01,))["m"] == "PAPER"


# ------------------------------------------------------------------ Dhan adapter with a fake transport
class FakeTransport:
    def __init__(self):
        self.calls: list[tuple[str, str, object]] = []
        self.routes: dict[tuple[str, str], object] = {}

    def request(self, method, path, *, json=None, timeout=10.0):
        self.calls.append((method, path, json))
        r = self.routes.get((method, path))
        if r is None:
            r = self.routes.get((method, path.rsplit("/", 1)[0] + "/*"))
        if isinstance(r, Exception):
            raise r
        if callable(r):
            return r(json)
        return r if r is not None else (404, {"errorCode": "DH-907", "errorType": "x", "errorMessage": "none"})

    def count(self, method, prefix):
        return sum(1 for m, p, _ in self.calls if m == method and p.startswith(prefix))


def broker(allow=True, **kw):
    t = FakeTransport()
    return DhanBroker(t, "1000012345", lambda: allow, orders_per_second=0, get_retries=2, **kw), t


def buy(q=10):
    return BrokerOrderRequest("TXE-abc", SYM, "1234", Side.BUY, q, "MARKET")


def test_buy_is_blocked_without_live_authorisation_and_sends_nothing():
    b, t = broker(allow=False)
    with pytest.raises(BrokerRejected, match="live_not_authorised"):
        b.place_order(buy())
    assert t.calls == []


def test_place_order_payload_and_ack():
    b, t = broker()
    t.routes[("POST", "/v2/orders")] = (200, {"orderId": "112", "orderStatus": "TRANSIT"})
    ack = b.place_order(buy())
    assert ack.order_id == "112" and ack.status == BrokerStatus.TRANSIT
    body = t.calls[0][2]
    assert body["productType"] == "INTRADAY" and body["transactionType"] == "BUY" and body["quantity"] == 10
    assert body["correlationId"] == "TXE-abc" and len(body["correlationId"]) <= 30
    assert body["dhanClientId"] == "1000012345"


def test_post_is_never_retried_on_timeout_or_5xx():
    b, t = broker()
    t.routes[("POST", "/v2/orders")] = TransportTimeout()
    with pytest.raises(BrokerTimeout):
        b.place_order(buy())
    assert t.count("POST", "/v2/orders") == 1
    t.routes[("POST", "/v2/orders")] = (502, {})
    with pytest.raises(BrokerTimeout):
        b.place_order(buy())
    assert t.count("POST", "/v2/orders") == 2  # one call per attempt, no hidden retry
    t.routes[("POST", "/v2/orders")] = TransportError()
    with pytest.raises(BrokerTimeout):
        b.place_order(buy())


def test_gets_are_retried_but_bounded():
    b, t = broker()
    t.routes[("GET", "/v2/fundlimit")] = TransportTimeout()
    with pytest.raises(BrokerTimeout):
        b.get_funds()
    assert t.count("GET", "/v2/fundlimit") == 3


def test_rate_limit_and_error_mapping():
    b, t = broker()
    t.routes[("POST", "/v2/orders")] = (429, {})
    with pytest.raises(RateLimited):
        b.place_order(buy())
    t.routes[("POST", "/v2/orders")] = (400, {"errorType": "Order_Error", "errorCode": "DH-906",
                                                "errorMessage": "Invalid"})
    with pytest.raises(BrokerRejected, match="DH-906"):
        b.place_order(buy())


def test_sell_is_reduce_only():
    b, t = broker()
    t.routes[("GET", "/v2/positions")] = (200, [{"tradingSymbol": SYM, "netQty": 10, "costPrice": 100.0,
                                                  "productType": "INTRADAY"}])
    t.routes[("POST", "/v2/orders")] = (200, {"orderId": "9", "orderStatus": "TRANSIT"})
    with pytest.raises(BrokerRejected, match="would_create_short"):
        b.place_order(BrokerOrderRequest("TXX-1", SYM, "1234", Side.SELL, 20, "MARKET"))
    assert t.count("POST", "/v2/orders") == 0
    assert b.place_order(BrokerOrderRequest("TXX-2", SYM, "1234", Side.SELL, 10, "MARKET")).order_id == "9"


def test_sell_works_even_when_live_authorisation_lapsed():
    b, t = broker(allow=False)
    t.routes[("GET", "/v2/positions")] = (200, [{"tradingSymbol": SYM, "netQty": 5, "productType": "INTRADAY"}])
    t.routes[("POST", "/v2/orders")] = (200, {"orderId": "9", "orderStatus": "TRANSIT"})
    assert b.place_order(BrokerOrderRequest("TXX-3", SYM, "1234", Side.SELL, 5, "MARKET")).order_id == "9"


def test_lookup_by_correlation_not_found_vs_failure():
    b, t = broker()
    assert b.get_order_by_correlation("nope") is None  # 404 / DH-907 => definitive "no such order"
    t.routes[("GET", "/v2/orders/external/x")] = (500, {})
    with pytest.raises(BrokerTimeout):
        b.get_order_by_correlation("x")  # failure is NOT "not found"
    t.routes[("GET", "/v2/orders/external/y")] = (200, {
        "orderId": "5", "correlationId": "y", "orderStatus": "TRADED", "tradingSymbol": SYM,
        "transactionType": "BUY", "quantity": 10, "filledQty": 10, "averageTradedPrice": 400.0,
        "orderType": "MARKET", "updateTime": "2026-11-16 10:00:01"})
    o = b.get_order_by_correlation("y")
    assert o.status == BrokerStatus.TRADED and o.filled_qty == 10 and o.updated_at.tzinfo is not None


def test_unknown_broker_status_is_an_error_not_a_guess():
    b, t = broker()
    t.routes[("GET", "/v2/orders/7")] = (200, {"orderId": "7", "orderStatus": "WEIRD_NEW_STATUS"})
    with pytest.raises(BrokerError):
        b.get_order("7")


def test_secrets_not_in_repr():
    b, _ = broker()
    assert "TOKEN" not in repr(b) and "1000012345" not in repr(b)


def test_funds_accepts_documented_typo_key():
    b, t = broker()
    t.routes[("GET", "/v2/fundlimit")] = (200, {"availabelBalance": 1234.5})
    assert b.get_funds() == 1234.5


def test_historical_parse_converts_epoch_to_ist():
    epoch = int(datetime(2026, 11, 16, 9, 15, tzinfo=IST).timestamp())
    df = DhanHistoricalClient.parse_intraday(SYM, {"timestamp": [epoch], "open": [1], "high": [2], "low": [1],
                                                     "close": [2], "volume": [100]})
    assert df["start"].iloc[0].hour == 9 and df["start"].iloc[0].minute == 15


# ------------------------------------------------------------------ live feed parser
def pkt_ticker(sec=1234, ltp=401.25, epoch=1_700_000_000):
    return struct.pack("<BhBi", 2, 16, 1, sec) + struct.pack("<fi", ltp, epoch)


def pkt_quote(sec=1234, ltp=401.25, epoch=1_700_000_000, atp=400.5, vol=12345):
    payload = struct.pack("<fhifi", ltp, 10, epoch, atp, vol).ljust(42, b"\0")
    return struct.pack("<BhBi", 4, 50, 1, sec) + payload


def test_feed_packets_parse():
    t = parse_packet(pkt_ticker())
    assert t.kind == "ticker" and t.security_id == 1234 and t.ltp == pytest.approx(401.25)
    q = parse_packet(pkt_quote())
    assert q.kind == "quote" and q.volume == 12345 and q.atp == pytest.approx(400.5)
    assert parse_packet(b"\x01") is None
    assert parse_packet(struct.pack("<BhBi", 99, 8, 1, 5)).kind == "other"


def test_subscribe_message_batches_at_100():
    msgs = subscribe_message([str(i) for i in range(250)])
    assert len(msgs) == 3 and json.loads(msgs[0])["InstrumentCount"] == 100


def test_feed_client_dispatch_and_health():
    ticks = []
    now = [0.0]
    h = FeedHealth(stale_after_s=20, clock=lambda: now[0])
    c = DhanFeedClient(lambda: "wss://example", {SYM: "1234"}, ticks.append, health=h)
    h.connected = True
    c.handle(pkt_quote())
    c.handle(pkt_quote(sec=9999))  # unknown instrument ignored
    assert len(ticks) == 1 and ticks[0].symbol == SYM and h.fresh
    now[0] = 100.0
    assert not h.fresh  # stale feed => not fresh => entries blocked by Health
    c.handle(struct.pack("<BhBi", 50, 10, 1, 0) + struct.pack("<h", 805))
    assert h.connected is False
