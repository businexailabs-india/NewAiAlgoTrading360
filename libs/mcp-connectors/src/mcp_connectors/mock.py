"""Deterministic mock connector for unit tests."""

from __future__ import annotations

from typing import Any

from mcp_connectors.base import BaseTradingMCPConnector, ConnectorCapabilities


class MockTradingMCPConnector(BaseTradingMCPConnector):
    name = "mock"

    def __init__(self, connected: bool = True, stale: bool = False):
        self.connected = connected
        self.stale = stale

    async def connect(self) -> dict[str, Any]:
        # Preserve constructor intent (e.g. disconnected broker simulations).
        return {
            "ok": self.connected,
            "status": "connected" if self.connected else "disconnected",
        }

    async def disconnect(self) -> dict[str, Any]:
        self.connected = False
        return {"ok": True}

    async def health_check(self) -> dict[str, Any]:
        return {
            "ok": self.connected,
            "status": "connected" if self.connected else "disconnected",
            "stale": self.stale,
        }

    async def get_account_profile(self) -> dict[str, Any]:
        return {"broker": "mock", "masked_client_id": "****6215"}

    async def get_margins(self) -> dict[str, Any]:
        return {"available": 75000.0, "utilized": 5000.0, "currency": "INR"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return [
            {
                "symbol": "RELIANCE",
                "exchange": "NSE",
                "quantity": 10,
                "averagePrice": 2500,
                "lastPrice": 2550,
            }
        ]

    async def get_positions(self) -> list[dict[str, Any]]:
        return []

    async def get_orders(self) -> list[dict[str, Any]]:
        return []

    async def get_trades(self) -> list[dict[str, Any]]:
        return []

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {
            "quotes": {s: {"ltp": 100.0, "stale": self.stale} for s in symbols},
            "stale": self.stale,
        }

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        return [
            {"close": 100 + i, "volume": 1000 + i * 5, "high": 101 + i, "low": 99 + i, "open": 100 + i}
            for i in range(40)
        ]

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"chain": []}

    async def get_market_status(self) -> dict[str, Any]:
        return {"status": "open" if self.connected else "closed"}

    async def get_broker_capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            name=self.name,
            configured=True,
            supports_holdings=True,
            supports_positions=True,
            supports_margins=True,
            supports_quotes=True,
            supports_historical=True,
            supports_order_preview=True,
            live_execution_from_advisory=False,
        )
