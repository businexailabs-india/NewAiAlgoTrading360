"""BaseTradingMCPProvider — common Indian broker/data MCP abstraction."""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Any

from mcp_connectors.base.capabilities import normalize_capabilities
from mcp_connectors.base.mappings import (
    denormalize_symbol as _denormalize_symbol,
    map_order_status as _map_order_status,
    map_order_type as _map_order_type,
    map_product_type as _map_product_type,
    normalize_symbol as _normalize_symbol,
)
from mcp_connectors.base.models import (
    LiveOrderGateContext,
    NormalizedOrderRequest,
    NormalizedOrderResponse,
    ProviderConfig,
)


class LiveTradingBlockedError(PermissionError):
    """Raised when live order APIs are invoked without full OMS/RMS gates."""


class BaseTradingMCPProvider(ABC):
    """Every Indian broker/data provider must implement this interface."""

    provider_id: str = "base"
    provider_name: str = "Base Provider"
    country: str = "IN"
    provider_type: str = "broker"
    supported_exchanges: list[str] = []
    supported_segments: list[str] = []
    supported_asset_classes: list[str] = []

    def __init__(self, config: ProviderConfig | None = None):
        self.config = config
        self._connected = False
        self._credentials: dict[str, str] = {}
        self._runtime_config: dict[str, Any] = {}
        self._subscribed: set[str] = set()
        if config:
            self.provider_id = config.provider_id
            self.provider_name = config.provider_name
            self.country = config.country
            self.provider_type = config.provider_type
            self.supported_exchanges = list(config.supported_exchanges)
            self.supported_segments = list(config.supported_segments)
            self.supported_asset_classes = list(config.supported_asset_classes)

    # ---- session lifecycle -------------------------------------------------

    @abstractmethod
    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        ...

    @abstractmethod
    async def disconnect(self) -> dict[str, Any]:
        ...

    @abstractmethod
    async def authenticate(self) -> dict[str, Any]:
        ...

    @abstractmethod
    async def refresh_session(self) -> dict[str, Any]:
        ...

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        ...

    async def get_provider_status(self) -> dict[str, Any]:
        health = await self.health_check()
        return {
            "provider_id": self.provider_id,
            "connected": self._connected,
            "health": health,
            "live_trading_default": bool(self.config.live_trading_default) if self.config else False,
            "enabled": bool(self.config.enabled) if self.config else False,
        }

    async def get_provider_capabilities(self) -> dict[str, Any]:
        raw = list(self.config.capabilities) if self.config else []
        return {
            "provider_id": self.provider_id,
            "capabilities": normalize_capabilities(raw),
            "raw_capabilities": raw,
            "live_order_execution": False,  # advisory/AI path never true by default
            "paper_order_execution": "PAPER_ORDER_EXECUTION" in normalize_capabilities(raw),
        }

    # ---- account / portfolio -----------------------------------------------

    @abstractmethod
    async def get_account_profile(self) -> dict[str, Any]:
        ...

    @abstractmethod
    async def get_accounts(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def get_margins(self) -> dict[str, Any]:
        ...

    @abstractmethod
    async def get_holdings(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def get_positions(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def get_orders(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def get_trades(self) -> list[dict[str, Any]]:
        ...

    # ---- instruments / market data -----------------------------------------

    @abstractmethod
    async def get_instruments(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        ...

    @abstractmethod
    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        ...

    @abstractmethod
    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        ...

    @abstractmethod
    async def get_historical_data(
        self,
        symbol: str,
        timeframe: str,
        from_date: date | datetime,
        to_date: date | datetime,
    ) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        ...

    # ---- orders ------------------------------------------------------------

    @abstractmethod
    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        ...

    async def place_order_disabled_by_default(
        self,
        order_request: NormalizedOrderRequest | dict[str, Any],
        gate: LiveOrderGateContext | None = None,
    ) -> NormalizedOrderResponse:
        """Must not execute real trades unless LIVE_TRADING_ENABLED and OMS/RMS gates pass."""
        self._assert_live_gates(gate)
        return await self._place_live_order(order_request)

    async def modify_order_disabled_by_default(
        self,
        order_id: str,
        modify_request: dict[str, Any],
        gate: LiveOrderGateContext | None = None,
    ) -> NormalizedOrderResponse:
        self._assert_live_gates(gate)
        return await self._modify_live_order(order_id, modify_request)

    async def cancel_order_disabled_by_default(
        self,
        order_id: str,
        gate: LiveOrderGateContext | None = None,
    ) -> NormalizedOrderResponse:
        self._assert_live_gates(gate)
        return await self._cancel_live_order(order_id)

    async def _place_live_order(
        self, order_request: NormalizedOrderRequest | dict[str, Any]
    ) -> NormalizedOrderResponse:
        raise NotImplementedError(f"{self.provider_id} live place_order not implemented")

    async def _modify_live_order(self, order_id: str, modify_request: dict[str, Any]) -> NormalizedOrderResponse:
        raise NotImplementedError(f"{self.provider_id} live modify_order not implemented")

    async def _cancel_live_order(self, order_id: str) -> NormalizedOrderResponse:
        raise NotImplementedError(f"{self.provider_id} live cancel_order not implemented")

    def _assert_live_gates(self, gate: LiveOrderGateContext | None) -> None:
        env_enabled = os.getenv("LIVE_TRADING_ENABLED", "false").lower() in ("1", "true", "yes")
        g = gate or LiveOrderGateContext()
        reasons: list[str] = []
        if not env_enabled or not g.live_trading_enabled:
            reasons.append("LIVE_TRADING_ENABLED=false")
        if g.caller_role != "oms_service":
            reasons.append("caller is not OMS service")
        if not g.rms_approval_id:
            reasons.append("RMS approval missing")
        if not g.user_approval_id:
            reasons.append("user approval missing")
        if not g.provider_live_trading_enabled:
            reasons.append("provider live_trading_enabled=false")
        if not g.kill_switch_off:
            reasons.append("kill switch active")
        if reasons:
            raise LiveTradingBlockedError(
                "Live order blocked: " + "; ".join(reasons)
                + ". Route: approval → RMS → OMS → execution router → broker adapter."
            )

    # ---- normalization helpers ---------------------------------------------

    def normalize_symbol(self, provider_symbol: str, exchange: str = "NSE") -> str:
        return _normalize_symbol(exchange, provider_symbol)

    def denormalize_symbol(self, normalized_symbol: str) -> str:
        return _denormalize_symbol(normalized_symbol, style=self.provider_id)

    def map_order_status(self, provider_status: str) -> str:
        return _map_order_status(self.provider_id, provider_status).value

    def map_product_type(self, provider_product_type: str) -> str:
        return _map_product_type(self.provider_id, provider_product_type).value

    def map_order_type(self, provider_order_type: str) -> str:
        return _map_order_type(self.provider_id, provider_order_type).value

    def get_rate_limits(self) -> dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "requests_per_second": 10,
            "orders_per_second": 5,
            "burst": 20,
        }

    def get_required_credentials(self) -> list[str]:
        if self.config:
            return list(self.config.credentials_required)
        return []

    def get_required_permissions(self) -> list[str]:
        return ["mcp.connections.read", "mcp.account.read", "mcp.market_data.read"]


class NotConfiguredProvider(BaseTradingMCPProvider):
    """Graceful placeholder until real broker credentials / API binding exist."""

    def __init__(self, provider_id: str, config: ProviderConfig | None = None):
        super().__init__(config)
        self.provider_id = provider_id
        if config is None:
            self.provider_name = provider_id

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        self._credentials = {}  # never retain secrets in not-configured path
        self._runtime_config = config or {}
        self._connected = False
        return {"ok": False, "status": "not_configured", "provider_id": self.provider_id}

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        return {"ok": True, "status": "disconnected"}

    async def authenticate(self) -> dict[str, Any]:
        return {"ok": False, "status": "not_configured"}

    async def refresh_session(self) -> dict[str, Any]:
        return {"ok": False, "status": "not_configured"}

    async def health_check(self) -> dict[str, Any]:
        return {"ok": False, "status": "not_configured", "provider_id": self.provider_id}

    async def get_account_profile(self) -> dict[str, Any]:
        return {"status": "not_configured", "provider_id": self.provider_id}

    async def get_accounts(self) -> list[dict[str, Any]]:
        return []

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

    async def get_instruments(self) -> list[dict[str, Any]]:
        return []

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        return []

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {"quotes": {}, "status": "not_configured"}

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        return {"ok": False, "status": "not_configured"}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        return {"ok": True, "status": "not_configured"}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        return []

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"status": "not_configured", "chain": []}

    async def preview_order(self, order_request) -> dict[str, Any]:
        return {
            "preview": True,
            "accepted": False,
            "status": "not_configured",
            "provider_id": self.provider_id,
        }
