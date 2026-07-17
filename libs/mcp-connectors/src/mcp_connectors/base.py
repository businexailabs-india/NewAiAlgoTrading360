"""BaseTradingMCPConnector — advisory may preview but never execute live orders."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


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
    live_execution_from_advisory: bool = False  # always False for advisory path


class BaseTradingMCPConnector(ABC):
    name: str = "base"

    @abstractmethod
    async def connect(self) -> dict[str, Any]: ...

    @abstractmethod
    async def disconnect(self) -> dict[str, Any]: ...

    @abstractmethod
    async def health_check(self) -> dict[str, Any]: ...

    @abstractmethod
    async def get_account_profile(self) -> dict[str, Any]: ...

    @abstractmethod
    async def get_margins(self) -> dict[str, Any]: ...

    @abstractmethod
    async def get_holdings(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def get_positions(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def get_orders(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def get_trades(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]: ...

    @abstractmethod
    async def get_historical_data(
        self, symbol: str, timeframe: str, from_date: date | datetime, to_date: date | datetime
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]: ...

    @abstractmethod
    async def get_market_status(self) -> dict[str, Any]: ...

    @abstractmethod
    async def get_broker_capabilities(self) -> ConnectorCapabilities: ...

    async def validate_order_capability(self) -> dict[str, Any]:
        caps = await self.get_broker_capabilities()
        return {
            "preview_allowed": caps.supports_order_preview,
            "live_execution_from_advisory": False,
            "message": "AI advisory cannot place live orders; OMS/RMS required",
        }

    async def place_order_preview(self, order: dict[str, Any]) -> dict[str, Any]:
        return {
            "preview": True,
            "accepted": False,
            "reason": "Preview only — advisory path cannot submit orders",
            "order_redacted": {k: v for k, v in order.items() if "token" not in k.lower()},
        }

    async def execute_order_disabled_by_default(self, order: dict[str, Any]) -> dict[str, Any]:
        """Hard block — advisory connectors never execute."""
        raise PermissionError(
            "execute_order_disabled_by_default: AI advisory must never place trades. "
            "Route through OMS + RMS after explicit user approval."
        )


class NotConfiguredConnector(BaseTradingMCPConnector):
    """Placeholder for brokers without credentials/MCP endpoint."""

    def __init__(self, name: str):
        self.name = name

    async def connect(self) -> dict[str, Any]:
        return {"ok": False, "status": "not_configured", "broker": self.name}

    async def disconnect(self) -> dict[str, Any]:
        return {"ok": True, "status": "disconnected"}

    async def health_check(self) -> dict[str, Any]:
        return {"ok": False, "status": "not_configured", "broker": self.name}

    async def get_account_profile(self) -> dict[str, Any]:
        return {"status": "not_configured"}

    async def get_margins(self) -> dict[str, Any]:
        return {"available": 0, "status": "not_configured"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return []

    async def get_positions(self) -> list[dict[str, Any]]:
        return []

    async def get_orders(self) -> list[dict[str, Any]]:
        return []

    async def get_trades(self) -> list[dict[str, Any]]:
        return []

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {"quotes": {}, "status": "not_configured"}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        return []

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"status": "not_configured", "chain": []}

    async def get_market_status(self) -> dict[str, Any]:
        return {"status": "unknown", "broker": self.name}

    async def get_broker_capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(name=self.name, configured=False)
