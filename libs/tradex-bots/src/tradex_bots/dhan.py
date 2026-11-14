"""DhanHQ v2 adapters (orders, tradebook, positions, funds, historical data, instrument master).

Built against https://dhanhq.co/docs/v2/ (orders, super-order, historical-data, annexure) as fetched on 2026-11-14.
NOT yet exercised against a real Dhan account or sandbox - see docs/algo-bots/KNOWN_LIMITATIONS.md.

Safety properties
* The HTTP transport is injected: automated tests use a fake transport; no test ever contacts Dhan.
* BUY orders require the live-entry guard on EVERY call; SELL orders are reduce-only (never create a short).
* POST/DELETE are never retried automatically; timeouts / 5xx raise BrokerTimeout so the OMS queries by
  correlation id before doing anything else. Only idempotent GETs are retried.
* Access tokens never appear in logs, reprs, errors or audit records.
"""

from __future__ import annotations

import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Protocol

import pandas as pd

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
from tradex_bots.models import Quote, Side
from tradex_bots.timeutil import IST


class TransportTimeout(Exception):
    pass


class TransportError(Exception):
    pass


class HttpTransport(Protocol):
    def request(self, method: str, path: str, *, json: Any = None, timeout: float = 10.0) -> tuple[int, Any]: ...


class HttpxTransport:
    """Real transport (requires httpx). The token is held privately and never rendered."""

    def __init__(self, base_url: str, access_token: str, client_id: str):
        import httpx

        self._client = httpx.Client(base_url=base_url.rstrip("/"), headers={
            "access-token": access_token, "client-id": client_id, "Content-Type": "application/json"})

    def request(self, method: str, path: str, *, json: Any = None, timeout: float = 10.0) -> tuple[int, Any]:
        import httpx

        try:
            r = self._client.request(method, path, json=json, timeout=timeout)
        except httpx.TimeoutException as e:
            raise TransportTimeout(type(e).__name__) from None
        except httpx.HTTPError as e:
            raise TransportError(type(e).__name__) from None
        try:
            body = r.json() if r.content else {}
        except ValueError:
            body = {"raw": r.text[:200]}
        return r.status_code, body

    def __repr__(self) -> str:
        return "HttpxTransport(token=[REDACTED])"


class RateLimited(BrokerRejected):
    """Request definitively NOT processed (HTTP 429 / DH-904). Not auto-retried for entries."""


class _Throttle:
    def __init__(self, per_second: float):
        self.min_gap = 1.0 / per_second if per_second > 0 else 0.0
        self._last = 0.0
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            delay = self._last + self.min_gap - now
            if delay > 0:
                time.sleep(delay)
            self._last = time.monotonic()


STATUS_MAP = {
    "TRANSIT": BrokerStatus.TRANSIT, "PENDING": BrokerStatus.PENDING, "PART_TRADED": BrokerStatus.PART_TRADED,
    "TRADED": BrokerStatus.TRADED, "CANCELLED": BrokerStatus.CANCELLED, "REJECTED": BrokerStatus.REJECTED,
    "EXPIRED": BrokerStatus.EXPIRED, "TRIGGERED": BrokerStatus.TRIGGERED, "CLOSED": BrokerStatus.TRADED,
}


def _ts(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
    except ValueError:
        return None


class DhanBroker:
    """Live executor. Constructing it does NOT enable trading: every BUY is gated by `entry_guard`."""

    mode = ExecutionMode.LIVE

    def __init__(self, transport: HttpTransport, client_id: str, entry_guard: Callable[[], bool], *,
                 orders_per_second: float = 5.0, get_retries: int = 2, timeout_s: float = 10.0,
                 product_type: str = "INTRADAY", exchange_segment: str = "NSE_EQ"):
        self.t, self.client_id, self.entry_guard = transport, client_id, entry_guard
        self.throttle, self.get_retries, self.timeout_s = _Throttle(orders_per_second), get_retries, timeout_s
        self.product, self.segment = product_type, exchange_segment
        self.quotes: dict[str, Quote] = {}
        self._healthy = False
        self.last_latency_ms: float | None = None

    def __repr__(self) -> str:
        return f"DhanBroker(client_id=***{self.client_id[-3:]}, token=[REDACTED])"

    # ------------------------------------------------------------------ plumbing
    def _call(self, method: str, path: str, body: Any = None, *, retry: bool = False) -> Any:
        attempts = (self.get_retries + 1) if retry else 1
        last: Exception | None = None
        for _ in range(attempts):
            started = time.perf_counter()
            try:
                status, data = self.t.request(method, path, json=body, timeout=self.timeout_s)
            except TransportTimeout:
                last = BrokerTimeout(f"timeout on {method} {path}")
                self._healthy = False
                continue
            except TransportError as e:
                last = BrokerTimeout(f"transport error on {method} {path}: {e}")
                self._healthy = False
                continue
            self.last_latency_ms = (time.perf_counter() - started) * 1000
            if status == 429 or (isinstance(data, dict) and data.get("errorCode") == "DH-904"):
                raise RateLimited("rate limited by broker")
            if status >= 500:
                last = BrokerTimeout(f"broker {status} on {method} {path}")
                continue
            self._healthy = True
            if status >= 400 or (isinstance(data, dict) and data.get("errorType")):
                code = data.get("errorCode") if isinstance(data, dict) else None
                msg = data.get("errorMessage") if isinstance(data, dict) else ""
                raise _DhanHttpError(status, code, msg)
            return data
        assert last is not None
        raise last

    def check_health(self) -> bool:
        try:
            self._call("GET", "/v2/fundlimit", retry=True)
            return True
        except BrokerError:
            return False

    def healthy(self) -> bool:
        return self._healthy

    # ------------------------------------------------------------------ orders
    def _payload(self, r: BrokerOrderRequest) -> dict[str, Any]:
        p: dict[str, Any] = {
            "dhanClientId": self.client_id, "correlationId": r.correlation_id[:30], "transactionType": r.side.value,
            "exchangeSegment": r.exchange_segment or self.segment, "productType": r.product or self.product,
            "orderType": r.order_type, "validity": r.validity, "securityId": str(r.security_id),
            "quantity": int(r.quantity), "afterMarketOrder": False,
        }
        if r.order_type in ("LIMIT", "STOP_LOSS"):
            p["price"] = float(r.price)
        if r.order_type in ("STOP_LOSS", "STOP_LOSS_MARKET"):
            p["triggerPrice"] = float(r.trigger_price)
        return p

    def place_order(self, req: BrokerOrderRequest) -> BrokerAck:
        if req.order_type not in ("MARKET", "LIMIT", "STOP_LOSS", "STOP_LOSS_MARKET"):
            raise BrokerRejected(f"unsupported_order_type:{req.order_type}")
        if (req.product or self.product) != "INTRADAY":
            raise BrokerRejected("only_intraday_supported_in_v1")
        if req.side == Side.BUY:
            if not self.entry_guard():
                raise BrokerRejected("live_not_authorised")
        else:  # reduce-only: never create a short position
            net = sum(p.net_qty for p in self.list_positions() if p.symbol == req.symbol)
            if req.quantity > net:
                raise BrokerRejected("would_create_short_or_oversell")
        self.throttle.wait()
        try:
            data = self._call("POST", "/v2/orders", self._payload(req))  # never retried
        except _DhanHttpError as e:
            raise BrokerRejected(f"{e.code or e.status}: {e.msg}") from None
        oid = str(data.get("orderId") or "")
        if not oid:
            raise BrokerTimeout("response without orderId: outcome unknown")
        return BrokerAck(oid, self._status(data.get("orderStatus")), data)

    @staticmethod
    def _status(s: Any) -> BrokerStatus:
        try:
            return STATUS_MAP[str(s).upper()]
        except KeyError:
            raise BrokerError(f"unknown order status from broker: {s!r}") from None

    def _to_order(self, d: dict[str, Any]) -> BrokerOrder:
        return BrokerOrder(
            order_id=str(d.get("orderId")), correlation_id=str(d.get("correlationId") or ""),
            status=self._status(d.get("orderStatus")), symbol=str(d.get("tradingSymbol") or ""),
            side=Side(d["transactionType"]) if d.get("transactionType") in ("BUY", "SELL") else None,
            quantity=int(d.get("quantity") or 0), filled_qty=int(d.get("filledQty") or 0),
            avg_price=float(d.get("averageTradedPrice") or 0.0), order_type=str(d.get("orderType") or ""),
            price=float(d.get("price") or 0.0), trigger_price=float(d.get("triggerPrice") or 0.0),
            error=str(d.get("omsErrorDescription") or ""), updated_at=_ts(d.get("updateTime")))

    def get_order(self, order_id: str) -> BrokerOrder | None:
        try:
            return self._to_order(self._call("GET", f"/v2/orders/{order_id}", retry=True))
        except _DhanHttpError as e:
            if e.status == 404 or e.code == "DH-907":
                return None
            raise BrokerError(f"{e.code or e.status}: {e.msg}") from None

    def get_order_by_correlation(self, correlation_id: str) -> BrokerOrder | None:
        try:
            data = self._call("GET", f"/v2/orders/external/{correlation_id}", retry=True)
        except _DhanHttpError as e:
            if e.status == 404 or e.code == "DH-907":
                return None  # definitive: broker has no such order
            raise BrokerError(f"{e.code or e.status}: {e.msg}") from None
        if isinstance(data, list):
            data = data[0] if data else None
        if not data:
            return None
        return self._to_order(data)

    def cancel_order(self, order_id: str) -> BrokerOrder:
        self.throttle.wait()
        try:
            self._call("DELETE", f"/v2/orders/{order_id}")
        except _DhanHttpError as e:
            raise BrokerRejected(f"{e.code or e.status}: {e.msg}") from None
        bo = self.get_order(order_id)
        if bo is None:
            raise BrokerError("order not found after cancel")
        return bo

    def list_orders(self) -> list[BrokerOrder]:
        data = self._call("GET", "/v2/orders", retry=True)
        return [self._to_order(d) for d in (data if isinstance(data, list) else [])]

    def list_trades(self) -> list[BrokerTrade]:
        data = self._call("GET", "/v2/trades", retry=True)
        out = []
        for d in data if isinstance(data, list) else []:
            out.append(BrokerTrade(
                trade_id=str(d.get("exchangeTradeId") or f"{d.get('orderId')}-{d.get('updateTime')}"),
                order_id=str(d.get("orderId")), symbol=str(d.get("tradingSymbol") or ""),
                side=Side(d["transactionType"]), quantity=int(d.get("tradedQuantity") or 0),
                price=float(d.get("tradedPrice") or 0.0), ts=_ts(d.get("updateTime"))))
        return out

    def list_positions(self) -> list[BrokerPosition]:
        data = self._call("GET", "/v2/positions", retry=True)
        return [BrokerPosition(str(d.get("tradingSymbol") or ""), int(d.get("netQty") or 0),
                               float(d.get("costPrice") or d.get("buyAvg") or 0.0))
                for d in (data if isinstance(data, list) else []) if d.get("productType", "INTRADAY") == "INTRADAY"]

    def get_funds(self) -> float:
        d = self._call("GET", "/v2/fundlimit", retry=True)
        # Dhan's documented response key contains a typo ("availabelBalance"); accept both.
        return float(d.get("availabelBalance", d.get("availableBalance", 0.0)))

    def get_quote(self, symbol: str) -> Quote | None:
        return self.quotes.get(symbol)

    def update_quote(self, q: Quote) -> None:
        self.quotes[q.symbol] = q

    # ------------------------------------------------------------------ super order (adapter-level, not used by OMS)
    def place_super_order(self, req: BrokerOrderRequest, target_price: float, stop_loss_price: float,
                          trailing_jump: float = 0.0) -> BrokerAck:
        """Dhan linked entry+target+stop-loss. UNVERIFIED against a real account; OMS does not use it in v1."""
        if req.side != Side.BUY or not self.entry_guard():
            raise BrokerRejected("live_not_authorised")
        body = {**self._payload(req), "targetPrice": target_price, "stopLossPrice": stop_loss_price,
                "trailingJump": trailing_jump}
        body.pop("validity", None)
        body.pop("afterMarketOrder", None)
        self.throttle.wait()
        try:
            data = self._call("POST", "/v2/super/orders", body)
        except _DhanHttpError as e:
            raise BrokerRejected(f"{e.code or e.status}: {e.msg}") from None
        return BrokerAck(str(data.get("orderId") or ""), self._status(data.get("orderStatus")), data)


class _DhanHttpError(Exception):
    def __init__(self, status: int, code: str | None, msg: str | None):
        super().__init__(f"{status} {code} {msg}")
        self.status, self.code, self.msg = status, code, msg or ""


# ---------------------------------------------------------------------------------------------- historical data
class DhanHistoricalClient:
    """Intraday OHLCV (5-minute) via POST /v2/charts/intraday, max 90 days per request.

    ASSUMPTIONS to verify on a real response: `timestamp` is epoch seconds (UTC) of the candle START; volume is
    per-candle. The API has no traded-value field, so VWAP built from these candles is the documented
    typical-price approximation (indicators.VWAP_TYPICAL)."""

    def __init__(self, transport: HttpTransport, timeout_s: float = 30.0):
        self.t, self.timeout_s = transport, timeout_s

    def fetch_intraday(self, symbol: str, security_id: str, start: date, end: date, interval: int = 5,
                       exchange_segment: str = "NSE_EQ") -> pd.DataFrame:
        frames = []
        cur = start
        while cur <= end:
            chunk_end = min(cur + timedelta(days=89), end)
            body = {"securityId": str(security_id), "exchangeSegment": exchange_segment, "instrument": "EQUITY",
                    "interval": str(interval), "oi": False,
                    "fromDate": f"{cur.isoformat()} 09:15:00", "toDate": f"{chunk_end.isoformat()} 15:30:00"}
            try:
                status, data = self.t.request("POST", "/v2/charts/intraday", json=body, timeout=self.timeout_s)
            except (TransportTimeout, TransportError) as e:
                raise BrokerError(f"historical fetch failed: {type(e).__name__}") from None
            if status != 200 or not isinstance(data, dict) or "timestamp" not in data:
                raise BrokerError(f"historical fetch error status={status}")
            frames.append(self.parse_intraday(symbol, data))
            cur = chunk_end + timedelta(days=1)
        if not frames:
            return pd.DataFrame()
        out = pd.concat(frames, ignore_index=True).drop_duplicates("start").sort_values("start")
        return out.reset_index(drop=True)

    @staticmethod
    def parse_intraday(symbol: str, data: dict[str, Any]) -> pd.DataFrame:
        n = len(data.get("timestamp", []))
        if n == 0:
            return pd.DataFrame(columns=["symbol", "start", "open", "high", "low", "close", "volume", "turnover"])
        df = pd.DataFrame({
            "symbol": symbol,
            "start": [datetime.fromtimestamp(int(t), tz=timezone.utc).astimezone(IST) for t in data["timestamp"]],
            "open": data["open"], "high": data["high"], "low": data["low"], "close": data["close"],
            "volume": [float(v) for v in data["volume"]], "turnover": float("nan"),
        })
        df["start"] = pd.to_datetime(df["start"])
        return df
