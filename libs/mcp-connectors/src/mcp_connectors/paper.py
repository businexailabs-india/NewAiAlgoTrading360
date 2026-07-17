"""Paper trading connector — simulated account for advisory paper workflows."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from mcp_connectors.base import BaseTradingMCPConnector, ConnectorCapabilities


class PaperTradingMCPConnector(BaseTradingMCPConnector):
    name = "paper"

    def __init__(self, initial_cash: float = 100000.0):
        self.cash = initial_cash
        self.holdings: list[dict[str, Any]] = []
        self.positions: list[dict[str, Any]] = []
        self.orders: list[dict[str, Any]] = []
        self.connected = False

    async def connect(self) -> dict[str, Any]:
        self.connected = True
        return {"ok": True, "status": "connected", "mode": "paper"}

    async def disconnect(self) -> dict[str, Any]:
        self.connected = False
        return {"ok": True, "status": "disconnected"}

    async def health_check(self) -> dict[str, Any]:
        return {
            "ok": bool(self.connected),
            "status": "connected" if self.connected else "disconnected",
            "mode": "paper",
        }

    async def get_account_profile(self) -> dict[str, Any]:
        return {"broker": "paper", "masked_client_id": "PAPER****", "mode": "paper"}

    async def get_margins(self) -> dict[str, Any]:
        return {"available": self.cash, "utilized": 0.0, "currency": "INR"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return list(self.holdings)

    async def get_positions(self) -> list[dict[str, Any]]:
        return list(self.positions)

    async def get_orders(self) -> list[dict[str, Any]]:
        return list(self.orders)

    async def get_trades(self) -> list[dict[str, Any]]:
        return [o for o in self.orders if o.get("status") == "COMPLETE"]

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {"quotes": {s: {"ltp": 100.0, "source": "paper_sim"} for s in symbols}}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        # Deterministic synthetic bars for paper/backtest without claiming real market data
        bars = []
        price = 100.0
        for i in range(60):
            price += (1 if i % 3 else -0.5)
            bars.append(
                {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "open": price - 0.2,
                    "high": price + 0.5,
                    "low": price - 0.5,
                    "close": price,
                    "volume": 10000 + i * 10,
                    "ts": i,
                }
            )
        return bars

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"symbol": symbol, "expiry": expiry, "chain": [], "note": "paper empty chain"}

    async def get_market_status(self) -> dict[str, Any]:
        return {"status": "open", "mode": "paper"}

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
