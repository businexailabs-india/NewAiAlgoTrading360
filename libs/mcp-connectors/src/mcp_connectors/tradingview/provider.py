"""TradingViewMCPProvider — signal/webhook MCP adapter (paper only, no live click-trading)."""

from __future__ import annotations

import secrets
from datetime import date, datetime
from typing import Any
from uuid import uuid4

from mcp_connectors.base.models import NormalizedOrderRequest, ProviderConfig
from mcp_connectors.base.provider import BaseTradingMCPProvider, LiveTradingBlockedError
from mcp_connectors.tradingview.payloads import build_payload_template, system_payload_templates
from mcp_connectors.tradingview.rate_limits import RATE_LIMIT
from mcp_connectors.tradingview.signal import preview_signal
from mcp_connectors.tradingview.symbols import map_symbol, search_mapped_symbols


class TradingViewMCPProvider(BaseTradingMCPProvider):
    """
    TradingView Connect as an MCP provider.

    Capabilities: webhook connections, alert payloads, symbol mapping, signal preview.
    Does NOT place live broker orders. Alerts never execute live trades directly.
    """

    provider_id = "tradingview"
    provider_name = "TradingView Connect"
    provider_type = "signal_integration"
    country = "GLOBAL"
    supported_exchanges = ["NSE", "BSE", "NYSE", "NASDAQ", "MCX"]
    supported_segments = ["equity", "equity_derivatives"]
    supported_asset_classes = ["stocks", "futures", "options"]

    def __init__(self, config: ProviderConfig | None = None):
        super().__init__(config)
        self._webhook_secret: str = ""
        self._connections: list[dict[str, Any]] = []
        self._signals: list[dict[str, Any]] = []

    def get_rate_limits(self) -> dict[str, Any]:
        return RATE_LIMIT.to_dict()

    # ---- session -----------------------------------------------------------

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        self._runtime_config = config or {}
        secret = (credentials or {}).get("webhook_secret") or ""
        if not secret:
            secret = secrets.token_urlsafe(24)
        self._credentials = {"webhook_secret": secret}
        self._webhook_secret = secret
        self._connected = True
        conn = {
            "connection_id": str(uuid4()),
            "name": (config or {}).get("name") or "TradingView webhook",
            "mode": "PAPER",
            "secret_hint": f"{secret[:4]}…{secret[-4:]}" if len(secret) > 8 else "****",
            "live_trading_disabled": True,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        self._connections.append(conn)
        return {
            "ok": True,
            "status": "connected",
            "mode": "paper",
            "provider_id": self.provider_id,
            "connection": conn,
            # Return secret once at connect time only (caller must store securely)
            "webhook_secret": secret,
            "note": "Store webhook_secret securely. Never send to LLMs. Live trading disabled.",
        }

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        self._webhook_secret = ""
        self._credentials = {}
        return {"ok": True, "status": "disconnected"}

    async def authenticate(self) -> dict[str, Any]:
        return {
            "ok": self._connected,
            "status": "authenticated" if self._connected else "disconnected",
            "auth_type": "webhook_secret",
            "mode": "paper",
        }

    async def refresh_session(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": "disconnected"}
        return {"ok": True, "status": "refreshed", "mode": "paper"}

    async def health_check(self) -> dict[str, Any]:
        return {
            "ok": self._connected,
            "status": "connected" if self._connected else "disconnected",
            "mode": "paper",
            "live_trading_disabled": True,
            "connections": len(self._connections),
            "signals_previewed": len(self._signals),
        }

    # ---- TV-specific -------------------------------------------------------

    async def list_webhook_connections(self) -> list[dict[str, Any]]:
        # Never include raw secrets
        return [
            {k: v for k, v in c.items() if k != "webhook_secret"}
            for c in self._connections
        ]

    async def rotate_webhook_secret(self, connection_id: str | None = None) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "reason": "not_connected"}
        new_secret = secrets.token_urlsafe(24)
        self._webhook_secret = new_secret
        self._credentials["webhook_secret"] = new_secret
        target = None
        for c in self._connections:
            if connection_id is None or c.get("connection_id") == connection_id:
                c["secret_hint"] = f"{new_secret[:4]}…{new_secret[-4:]}"
                c["rotated_at"] = datetime.utcnow().isoformat() + "Z"
                target = c
                if connection_id:
                    break
        return {
            "ok": True,
            "connection": target,
            "webhook_secret": new_secret,
            "note": "Previous secret invalidated. Update TradingView alert URL secret.",
        }

    async def get_payload_templates(self) -> list[dict[str, Any]]:
        return system_payload_templates()

    async def get_payload_template(self, kind: str) -> dict[str, Any]:
        allowed = {"BUY", "SELL", "EXIT", "STOP_LOSS", "OPTIONS", "MULTI_ACCOUNT", "STANDARD"}
        key = (kind or "STANDARD").upper()
        if key not in allowed:
            key = "STANDARD"
        return {
            "kind": key,
            "template": build_payload_template(key),  # type: ignore[arg-type]
            "live_trading_disabled": True,
        }

    async def map_tv_symbol(self, symbol: str, exchange: str | None = None) -> dict[str, Any]:
        return map_symbol(symbol, exchange)

    async def preview_alert(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = preview_signal(payload, expected_secret=self._webhook_secret or None)
        self._signals.append(
            {
                "at": datetime.utcnow().isoformat() + "Z",
                "accepted": result.get("accepted"),
                "signal_id": (result.get("signal") or {}).get("signal_id"),
            }
        )
        return result

    # ---- account stubs (TV is not a broker) --------------------------------

    async def get_account_profile(self) -> dict[str, Any]:
        return {
            "provider": "tradingview",
            "type": "signal_integration",
            "mode": "paper",
            "live_trading_disabled": True,
            "masked_secret": (
                f"{self._webhook_secret[:4]}…{self._webhook_secret[-4:]}"
                if len(self._webhook_secret) > 8
                else ("****" if self._webhook_secret else "")
            ),
        }

    async def get_accounts(self) -> list[dict[str, Any]]:
        return [{"account_id": "tv-signals", "profile": await self.get_account_profile()}]

    async def get_margins(self) -> dict[str, Any]:
        return {"available": 0, "utilized": 0, "currency": "INR", "note": "signal_provider_no_margins"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return []

    async def get_positions(self) -> list[dict[str, Any]]:
        return []

    async def get_orders(self) -> list[dict[str, Any]]:
        return []

    async def get_trades(self) -> list[dict[str, Any]]:
        return []

    # ---- instruments / market (mapping only) -------------------------------

    async def get_instruments(self) -> list[dict[str, Any]]:
        return search_mapped_symbols("")

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        return search_mapped_symbols(query)

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {
            "quotes": {},
            "note": "TradingView MCP does not stream quotes; use a market-data MCP provider",
            "mapped": [map_symbol(s) for s in symbols],
        }

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        return {"ok": False, "reason": "not_supported", "provider_id": self.provider_id}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        return {"ok": True, "subscribed": []}

    async def get_historical_data(
        self, symbol: str, timeframe: str, from_date: date | datetime | str, to_date: date | datetime | str
    ) -> list[dict[str, Any]]:
        return []

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"symbol": symbol, "expiry": expiry, "chain": [], "note": "not_supported"}

    # ---- orders: preview only ----------------------------------------------

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        # Treat as TV alert preview
        alert = {
            "symbol": data.get("symbol"),
            "exchange": data.get("exchange"),
            "side": data.get("side"),
            "quantity": data.get("quantity"),
            "price": data.get("price"),
            "mode": "PAPER",
            "signal_type": data.get("signal_type") or "ORDER_PREVIEW",
            "secret": data.get("secret") or self._webhook_secret,
        }
        return await self.preview_alert(alert)

    async def _place_live_order(self, order_request: NormalizedOrderRequest | dict[str, Any]):
        raise LiveTradingBlockedError(
            "TradingView MCP never places live orders. Route paper fills via OMS/RMS paper broker."
        )
