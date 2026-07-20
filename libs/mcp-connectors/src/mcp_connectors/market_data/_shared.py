"""Shared market-data placeholder provider."""

from __future__ import annotations

from typing import Any

from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india._shared import PlaceholderBrokerProvider


class PlaceholderMarketDataProvider(PlaceholderBrokerProvider):
    provider_type = "market_data"

    async def get_account_profile(self) -> dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "type": "market_data",
            "status": "connected" if self._connected else self._mode,
        }

    async def get_margins(self) -> dict[str, Any]:
        return {"note": "market_data_provider_has_no_margins"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return []

    async def get_positions(self) -> list[dict[str, Any]]:
        return []

    async def get_orders(self) -> list[dict[str, Any]]:
        return []

    async def get_trades(self) -> list[dict[str, Any]]:
        return []

    async def preview_order(self, order_request) -> dict[str, Any]:
        return {"preview": False, "accepted": False, "reason": "market_data_provider"}
