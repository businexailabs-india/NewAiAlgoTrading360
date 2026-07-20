"""Adapter-specific request/response DTOs for Fyers API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from mcp_connectors.base.dtos import (
    AccountProfileDTO,
    ConnectRequestDTO,
    ConnectResponseDTO,
    HistoricalRequestDTO,
    HoldingDTO,
    MarginsDTO,
    OrderPreviewRequestDTO,
    OrderPreviewResponseDTO,
    QuoteRequestDTO,
    QuoteResponseDTO,
)


class FyersConnectRequest(ConnectRequestDTO):
    """Connect payload for fyers."""


class FyersOrderStub(BaseModel):
    """Broker-native order payload stub (not executed in Phase 2)."""

    exchange: str = "NSE"
    symbol: str
    transaction_type: str = "BUY"
    quantity: int
    order_type: str = "MARKET"
    product: str = "CNC"
    price: float | None = None
    trigger_price: float | None = None
    validity: str = "DAY"
    tag: str | None = None
    extras: dict[str, Any] = Field(default_factory=dict)
