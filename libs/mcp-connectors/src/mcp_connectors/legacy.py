"""Adapters that keep BaseTradingMCPConnector-compatible API for advisory services."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from mcp_connectors.base.provider import BaseTradingMCPProvider


class ConnectorCapabilities(BaseModel):
    name: str
    configured: bool = False
    supports_holdings: bool = False
    supports_positions: bool = False
    supports_margins: bool = False
    supports_quotes: bool = False
    supports_historical: bool = False
    supports_option_chain: bool = False
    supports_order_preview: bool = False
    live_execution_from_advisory: bool = False


class LegacyConnectorAdapter:
    """Wraps BaseTradingMCPProvider with the older connector method names."""

    def __init__(self, provider: BaseTradingMCPProvider):
        self.provider = provider
        self.name = provider.provider_id

    async def connect(self) -> dict[str, Any]:
        # Prefer mock/demo for advisory path; Dhan uses rich fixtures
        cfg = {"use_mock": True, "demo": True}
        return await self.provider.connect({}, cfg)

    async def get_account_snapshot(self) -> dict[str, Any]:
        if hasattr(self.provider, "get_account_snapshot"):
            return await self.provider.get_account_snapshot()
        return {
            "provider_id": self.name,
            "profile": await self.get_account_profile(),
            "margins": await self.get_margins(),
            "holdings": await self.get_holdings(),
            "positions": await self.get_positions(),
            "orders": await self.get_orders(),
            "trades": await self.get_trades(),
            "live_order_execution": False,
            "secrets_included": False,
        }

    async def disconnect(self) -> dict[str, Any]:
        return await self.provider.disconnect()

    async def health_check(self) -> dict[str, Any]:
        return await self.provider.health_check()

    async def get_account_profile(self) -> dict[str, Any]:
        return await self.provider.get_account_profile()

    async def get_margins(self) -> dict[str, Any]:
        return await self.provider.get_margins()

    async def get_holdings(self) -> list[dict[str, Any]]:
        return await self.provider.get_holdings()

    async def get_positions(self) -> list[dict[str, Any]]:
        return await self.provider.get_positions()

    async def get_orders(self) -> list[dict[str, Any]]:
        return await self.provider.get_orders()

    async def get_trades(self) -> list[dict[str, Any]]:
        return await self.provider.get_trades()

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return await self.provider.get_live_quotes(symbols)

    async def get_historical_data(
        self, symbol: str, timeframe: str, from_date: date | datetime, to_date: date | datetime
    ) -> list[dict[str, Any]]:
        return await self.provider.get_historical_data(symbol, timeframe, from_date, to_date)

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return await self.provider.get_option_chain(symbol, expiry)

    async def get_market_status(self) -> dict[str, Any]:
        health = await self.provider.health_check()
        return {"status": "open" if health.get("ok") else "closed", "broker": self.name}

    async def get_broker_capabilities(self) -> ConnectorCapabilities:
        caps = await self.provider.get_provider_capabilities()
        names = set(caps.get("capabilities") or [])
        configured = (await self.provider.health_check()).get("status") != "not_configured"
        return ConnectorCapabilities(
            name=self.name,
            configured=configured,
            supports_holdings="HOLDINGS" in names or configured,
            supports_positions="POSITIONS" in names or configured,
            supports_margins="MARGINS" in names or configured,
            supports_quotes="LIVE_QUOTES" in names or configured,
            supports_historical="HISTORICAL_DATA" in names or configured,
            supports_option_chain="OPTION_CHAIN" in names,
            supports_order_preview="ORDER_PREVIEW" in names or configured,
            live_execution_from_advisory=False,
        )

    async def validate_order_capability(self) -> dict[str, Any]:
        return {
            "preview_allowed": True,
            "live_execution_from_advisory": False,
            "message": "AI advisory cannot place live orders; OMS/RMS required",
        }

    async def place_order_preview(self, order: dict[str, Any]) -> dict[str, Any]:
        return await self.provider.preview_order(order)

    async def execute_order_disabled_by_default(self, order: dict[str, Any]) -> dict[str, Any]:
        raise PermissionError(
            "execute_order_disabled_by_default: AI advisory must never place trades. "
            "Route through OMS + RMS after explicit user approval."
        )


# Keep ABC name importable from mcp_connectors.base (legacy path)
class BaseTradingMCPConnector:  # pragma: no cover - marker for isinstance checks
    """Deprecated alias marker; use BaseTradingMCPProvider."""

    pass
