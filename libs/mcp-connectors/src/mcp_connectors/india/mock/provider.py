"""MockTradingProvider — deterministic mock for tests."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from mcp_connectors.base.models import NormalizedOrderRequest, NormalizedOrderResponse, ProviderConfig
from mcp_connectors.base.provider import BaseTradingMCPProvider
from mcp_connectors.india.mock.auth import refresh_auth
from mcp_connectors.india.mock.rate_limits import RATE_LIMIT


class MockTradingProvider(BaseTradingMCPProvider):
    provider_id = "mock_trading"
    provider_name = "Mock Trading Provider"
    provider_type = "mock"
    country = "IN"
    supported_exchanges = ["NSE", "BSE"]
    supported_segments = ["equity", "equity_derivatives"]
    supported_asset_classes = ["stocks", "futures", "options"]

    def __init__(
        self,
        config: ProviderConfig | None = None,
        connected: bool = True,
        stale: bool = False,
        reject_orders: bool = False,
        rate_limited: bool = False,
        token_expired: bool = False,
    ):
        super().__init__(config)
        self._connected = connected
        self.stale = stale
        self.reject_orders = reject_orders
        self.rate_limited = rate_limited
        self.token_expired = token_expired
        self._orders: list[dict[str, Any]] = []

    def get_rate_limits(self) -> dict[str, Any]:
        return RATE_LIMIT.to_dict()

    async def refresh_session(self) -> dict[str, Any]:
        if self.token_expired:
            self.token_expired = False
            self._connected = True
        result = await refresh_auth(True)
        return result.model_dump(mode="json")

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        cfg = config or {}
        if "connected" in cfg:
            self._connected = bool(cfg["connected"])
        if self.token_expired or cfg.get("token_expired"):
            self._connected = False
            return {"ok": False, "status": "token_expired", "provider_id": self.provider_id}
        return {
            "ok": self._connected,
            "status": "connected" if self._connected else "disconnected",
            "provider_id": self.provider_id,
        }

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        return {"ok": True, "status": "disconnected"}

    async def authenticate(self) -> dict[str, Any]:
        if self.token_expired:
            return {"ok": False, "status": "token_expired"}
        return {"ok": self._connected, "status": "authenticated" if self._connected else "disconnected"}

    async def health_check(self) -> dict[str, Any]:
        if self.rate_limited:
            return {"ok": False, "status": "rate_limited", "provider_id": self.provider_id}
        if self.token_expired:
            return {"ok": False, "status": "token_expired", "auth_expiry_warning": True}
        return {
            "ok": self._connected,
            "status": "connected" if self._connected else "disconnected",
            "stale": self.stale,
            "latency_ms": 3.0,
        }

    async def get_account_profile(self) -> dict[str, Any]:
        return {"broker": "mock_trading", "masked_client_id": "****6215"}

    async def get_accounts(self) -> list[dict[str, Any]]:
        return [{"account_id": "mock-primary", "profile": await self.get_account_profile()}]

    async def get_margins(self) -> dict[str, Any]:
        return {"available": 75000.0, "utilized": 5000.0, "currency": "INR"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return [
            {
                "symbol": "RELIANCE",
                "exchange": "NSE",
                "quantity": 10,
                "average_price": 2500,
                "last_price": 2550,
            }
        ]

    async def get_positions(self) -> list[dict[str, Any]]:
        return []

    async def get_orders(self) -> list[dict[str, Any]]:
        return list(self._orders)

    async def get_trades(self) -> list[dict[str, Any]]:
        return [o for o in self._orders if o.get("status") == "FILLED"]

    async def get_instruments(self) -> list[dict[str, Any]]:
        return [{"exchange": "NSE", "segment": "EQ", "symbol": "RELIANCE", "provider_symbol": "RELIANCE"}]

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        q = (query or "").upper()
        return [i for i in await self.get_instruments() if q in i["symbol"]]

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {
            "quotes": {self.normalize_symbol(s): {"ltp": 100.0, "stale": self.stale} for s in symbols},
            "stale": self.stale,
        }

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        self._subscribed.update(symbols)
        return {"ok": True, "subscribed": list(self._subscribed)}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        for s in symbols:
            self._subscribed.discard(s)
        return {"ok": True, "subscribed": list(self._subscribed)}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        return [
            {"close": 100 + i, "volume": 1000 + i * 5, "high": 101 + i, "low": 99 + i, "open": 100 + i}
            for i in range(40)
        ]

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"symbol": symbol, "expiry": expiry, "chain": []}

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        return {
            "preview": True,
            "accepted": not self.reject_orders,
            "provider_id": self.provider_id,
            "order_redacted": {k: v for k, v in data.items() if "token" not in k.lower()},
        }

    async def place_test_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> NormalizedOrderResponse:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        oid = str(uuid4())
        status = "REJECTED" if self.reject_orders else "FILLED"
        order = {
            "order_id": oid,
            "symbol": data.get("symbol"),
            "status": status,
            "quantity": data.get("quantity"),
        }
        self._orders.append(order)
        return NormalizedOrderResponse(
            provider_id=self.provider_id,
            provider_order_id=oid,
            status=status,
            message="mock order",
            raw_response_redacted={"mode": "mock"},
        )
