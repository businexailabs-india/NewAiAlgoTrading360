"""Dhan-specific request/response DTOs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from mcp_connectors.base.dtos import (
    AccountProfileDTO,
    ConnectRequestDTO,
    ConnectResponseDTO,
    HoldingDTO,
    MarginsDTO,
    OrderPreviewRequestDTO,
    OrderPreviewResponseDTO,
    QuoteResponseDTO,
)


class DhanConnectRequest(ConnectRequestDTO):
    client_id: str | None = None
    access_token: str | None = None
    api_key: str | None = None


class DhanOrderStub(BaseModel):
    """Native Dhan place-order payload stub — never auto-executed."""

    dhanClientId: str | None = None
    transactionType: str = "BUY"
    exchangeSegment: str = "NSE_EQ"
    productType: str = "CNC"
    orderType: str = "MARKET"
    securityId: str = ""
    quantity: int
    price: float = 0.0
    triggerPrice: float = 0.0
    validity: str = "DAY"
    correlationId: str | None = None


class DhanAccountSnapshotDTO(BaseModel):
    provider_id: str = "dhan"
    mode: str = "mock"
    profile: dict[str, Any] = Field(default_factory=dict)
    margins: dict[str, Any] = Field(default_factory=dict)
    holdings: list[dict[str, Any]] = Field(default_factory=list)
    positions: list[dict[str, Any]] = Field(default_factory=list)
    orders: list[dict[str, Any]] = Field(default_factory=list)
    trades: list[dict[str, Any]] = Field(default_factory=list)
    health: dict[str, Any] = Field(default_factory=dict)
    live_order_execution: bool = False
    secrets_included: bool = False


class DhanProviderStatusDTO(BaseModel):
    """Safe status payload for DhanLaxmi — no secrets."""

    provider_id: str = "dhan"
    provider_name: str = "Dhan / DhanHQ"
    connected: bool = False
    health_status: str = "unknown"
    mode: str = "mock"
    masked_client_id: str | None = None
    available_margin: float | None = None
    holdings_count: int = 0
    open_positions_count: int = 0
    open_orders_count: int = 0
    live_trading_enabled: bool = False
    message: str = ""


__all__ = [
    "AccountProfileDTO",
    "ConnectRequestDTO",
    "ConnectResponseDTO",
    "DhanAccountSnapshotDTO",
    "DhanConnectRequest",
    "DhanOrderStub",
    "DhanProviderStatusDTO",
    "HoldingDTO",
    "MarginsDTO",
    "OrderPreviewRequestDTO",
    "OrderPreviewResponseDTO",
    "QuoteResponseDTO",
]
