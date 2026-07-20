"""Shared placeholder broker behavior for Indian adapters."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import uuid4

from mcp_connectors.base.http_client import ProviderHTTPClient
from mcp_connectors.base.mappings import denormalize_symbol
from mcp_connectors.base.models import NormalizedOrderRequest, ProviderConfig
from mcp_connectors.base.provider import BaseTradingMCPProvider, NotConfiguredProvider


class PlaceholderBrokerProvider(BaseTradingMCPProvider):
    """Default Indian broker adapter — not_configured until real API wired."""

    symbol_style = "plain"
    use_mock_http = True

    def __init__(self, config: ProviderConfig | None = None, http: ProviderHTTPClient | None = None):
        super().__init__(config)
        self.http = http or ProviderHTTPClient(use_mock=True)
        self._mode = "not_configured"

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        self._runtime_config = config or {}
        # Accept credentials into memory only for session; never log them
        has_required = bool(credentials) and any(credentials.values())
        force_mock = bool((config or {}).get("use_mock")) or bool((config or {}).get("demo"))
        if force_mock:
            self._mode = "mock"
            self._connected = True
            self._credentials = {"_present": "true"}
            return {"ok": True, "status": "connected", "mode": "mock", "provider_id": self.provider_id}
        if not has_required:
            self._mode = "not_configured"
            self._connected = False
            self._credentials = {}
            return {"ok": False, "status": "not_configured", "provider_id": self.provider_id}
        # Placeholder: treat credential presence as session-ready mock binding
        self._mode = "session_placeholder"
        self._connected = True
        self._credentials = {"_present": "true"}
        return {
            "ok": True,
            "status": "connected",
            "mode": "session_placeholder",
            "provider_id": self.provider_id,
            "note": "Replace with real broker API binding via DHAN_BASE_URL / provider env",
        }

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        self._credentials = {}
        await self.http.aclose()
        return {"ok": True, "status": "disconnected", "provider_id": self.provider_id}

    async def authenticate(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": self._mode}
        return {"ok": True, "status": "authenticated", "provider_id": self.provider_id}

    async def refresh_session(self) -> dict[str, Any]:
        return await self.authenticate()

    async def health_check(self) -> dict[str, Any]:
        if self._mode == "not_configured":
            return {"ok": False, "status": "not_configured", "provider_id": self.provider_id}
        return {
            "ok": self._connected,
            "status": "connected" if self._connected else "disconnected",
            "provider_id": self.provider_id,
            "mode": self._mode,
            "latency_ms": 5.0,
        }

    async def get_account_profile(self) -> dict[str, Any]:
        if self._mode == "not_configured":
            return {"status": "not_configured", "provider_id": self.provider_id}
        return {
            "provider_id": self.provider_id,
            "masked_client_id": "****0001",
            "mode": self._mode,
        }

    async def get_accounts(self) -> list[dict[str, Any]]:
        profile = await self.get_account_profile()
        if profile.get("status") == "not_configured":
            return []
        return [{"account_id": f"{self.provider_id}-primary", "profile": profile}]

    async def get_margins(self) -> dict[str, Any]:
        if self._mode == "not_configured":
            return {"available": 0, "status": "not_configured"}
        return {"available": 100000.0, "utilized": 0.0, "currency": "INR", "mode": self._mode}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return []

    async def get_positions(self) -> list[dict[str, Any]]:
        return []

    async def get_orders(self) -> list[dict[str, Any]]:
        return []

    async def get_trades(self) -> list[dict[str, Any]]:
        return []

    async def get_instruments(self) -> list[dict[str, Any]]:
        return [
            {
                "exchange": "NSE",
                "segment": "EQ",
                "symbol": "RELIANCE",
                "provider_symbol": denormalize_symbol("NSE:RELIANCE", self.symbol_style),
            }
        ]

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        q = (query or "").upper()
        return [i for i in await self.get_instruments() if q in i["symbol"]]

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        if self._mode == "not_configured":
            return {"quotes": {}, "status": "not_configured"}
        return {
            "quotes": {
                self.normalize_symbol(s): {"ltp": 100.0, "provider_id": self.provider_id} for s in symbols
            }
        }

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        self._subscribed.update(symbols)
        return {"ok": self._connected, "subscribed": list(self._subscribed)}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        for s in symbols:
            self._subscribed.discard(s)
        return {"ok": True, "subscribed": list(self._subscribed)}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        if self._mode == "not_configured":
            return []
        return [{"symbol": symbol, "close": 100 + i, "timeframe": timeframe} for i in range(10)]

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"symbol": symbol, "expiry": expiry, "chain": [], "provider_id": self.provider_id}

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        # strip secret-looking keys
        safe = {k: v for k, v in data.items() if "token" not in k.lower() and "secret" not in k.lower()}
        return {
            "preview": True,
            "accepted": self._connected and self._mode != "not_configured",
            "provider_id": self.provider_id,
            "normalized_symbol": self.normalize_symbol(str(safe.get("symbol", "")), str(safe.get("exchange", "NSE"))),
            "order_type": self.map_order_type(str(safe.get("order_type", "MARKET"))),
            "product_type": self.map_product_type(str(safe.get("product_type", "CNC"))),
            "order_redacted": safe,
            "estimated_margin": float(safe.get("quantity", 0) or 0) * float(safe.get("price") or 100.0) * 0.2,
            "idempotency_key": safe.get("idempotency_key") or str(uuid4()),
        }

    def denormalize_symbol(self, normalized_symbol: str) -> str:
        return denormalize_symbol(normalized_symbol, style=self.symbol_style)


# Re-export for convenience
__all__ = ["PlaceholderBrokerProvider", "NotConfiguredProvider"]
