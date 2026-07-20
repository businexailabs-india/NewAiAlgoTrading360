"""Shared request/response DTOs used across Indian MCP adapters."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ConnectRequestDTO(BaseModel):
    credentials: dict[str, str] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    use_mock: bool = True


class ConnectResponseDTO(BaseModel):
    ok: bool
    status: str
    provider_id: str
    mode: str = "mock"
    masked_client_id: str | None = None
    note: str | None = None
    auth_flow: str | None = None


class QuoteRequestDTO(BaseModel):
    symbols: list[str]
    exchange: str | None = None


class QuoteResponseDTO(BaseModel):
    provider_id: str
    quotes: dict[str, Any] = Field(default_factory=dict)
    stale: bool = False
    mode: str = "mock"


class HistoricalRequestDTO(BaseModel):
    symbol: str
    timeframe: str = "1d"
    from_date: str
    to_date: str
    exchange: str = "NSE"


class OrderPreviewRequestDTO(BaseModel):
    exchange: str = "NSE"
    symbol: str
    side: str
    quantity: int
    order_type: str = "MARKET"
    product_type: str = "CNC"
    price: float | None = None
    trigger_price: float | None = None
    validity: str = "DAY"
    idempotency_key: str | None = None


class OrderPreviewResponseDTO(BaseModel):
    preview: bool = True
    accepted: bool
    provider_id: str
    estimated_margin: float | None = None
    normalized_symbol: str | None = None
    mapped_order_type: str | None = None
    mapped_product_type: str | None = None
    order_redacted: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class AccountProfileDTO(BaseModel):
    provider_id: str
    masked_client_id: str
    mode: str
    segments: list[str] = Field(default_factory=list)
    extras: dict[str, Any] = Field(default_factory=dict)


class MarginsDTO(BaseModel):
    available: float
    utilized: float = 0.0
    currency: str = "INR"
    mode: str = "mock"
    extras: dict[str, Any] = Field(default_factory=dict)


class HoldingDTO(BaseModel):
    symbol: str
    exchange: str = "NSE"
    quantity: int
    average_price: float | None = None
    last_price: float | None = None
    normalized_symbol: str | None = None


class PositionDTO(BaseModel):
    symbol: str
    exchange: str = "NSE"
    quantity: int
    product_type: str | None = None
    average_price: float | None = None
    pnl: float | None = None
