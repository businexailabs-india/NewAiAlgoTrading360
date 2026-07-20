"""Normalized MCP provider data models for BusineXAi TradeOS360."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProviderConfig(BaseModel):
    provider_id: str
    provider_name: str
    provider_type: str
    country: str = "IN"
    supported_exchanges: list[str] = Field(default_factory=list)
    supported_segments: list[str] = Field(default_factory=list)
    supported_asset_classes: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    auth_type: list[str] = Field(default_factory=list)
    credentials_required: list[str] = Field(default_factory=list)
    live_trading_default: bool = False
    paper_trading_default: bool = False
    status: str = "active"
    documentation_url: str = ""
    enabled: bool = False
    adapter_class: str = ""
    env_enable_flag: str = ""
    priority: int = 100
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class MCPConnection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    user_id: str
    provider_id: str
    account_alias: str = ""
    status: str = "created"
    auth_status: str = "pending"
    health_status: str = "unknown"
    last_connected_at: datetime | None = None
    last_health_check_at: datetime | None = None
    permissions_json: dict[str, Any] = Field(default_factory=dict)
    capabilities_json: dict[str, Any] = Field(default_factory=dict)
    encrypted_credentials_ref: str | None = None
    live_trading_enabled: bool = False
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class ProviderCredential(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    user_id: str
    provider_id: str
    credential_type: str
    encrypted_value: str
    masked_value: str
    created_at: datetime = Field(default_factory=_utcnow)
    rotated_at: datetime | None = None
    expires_at: datetime | None = None


class ProviderHealthCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    provider_id: str
    tenant_id: str | None = None
    connection_id: str | None = None
    status: str
    latency_ms: float | None = None
    error_code: str | None = None
    error_message: str | None = None
    checked_at: datetime = Field(default_factory=_utcnow)
    websocket_status: str | None = None
    rate_limit_status: str | None = None
    auth_expiry_warning: bool = False


class ProviderCapability(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    provider_id: str
    capability_name: str
    enabled: bool = True
    requires_permission: str | None = None
    requires_live_trading: bool = False
    requires_market_data_subscription: bool = False


class NormalizedAccountSnapshot(BaseModel):
    provider_id: str
    account_id: str
    user_id: str
    tenant_id: str
    profile_json: dict[str, Any] = Field(default_factory=dict)
    margins_json: dict[str, Any] = Field(default_factory=dict)
    holdings_json: list[dict[str, Any]] = Field(default_factory=list)
    positions_json: list[dict[str, Any]] = Field(default_factory=list)
    orders_json: list[dict[str, Any]] = Field(default_factory=list)
    trades_json: list[dict[str, Any]] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=_utcnow)


class NormalizedInstrument(BaseModel):
    exchange: str
    segment: str
    symbol: str
    provider_symbol: str
    instrument_token: str | int | None = None
    isin: str | None = None
    lot_size: int = 1
    tick_size: float = 0.05
    expiry: str | None = None
    strike: float | None = None
    option_type: str | None = None


class NormalizedOrderRequest(BaseModel):
    tenant_id: str
    user_id: str
    provider_id: str
    account_id: str = ""
    exchange: str
    symbol: str
    side: str
    quantity: int
    order_type: str = "MARKET"
    product_type: str = "CNC"
    price: float | None = None
    trigger_price: float | None = None
    validity: str = "DAY"
    strategy_id: str | None = None
    bot_id: str | None = None
    approval_id: str | None = None
    rms_approval_id: str | None = None
    idempotency_key: str = Field(default_factory=lambda: str(uuid4()))


class NormalizedOrderResponse(BaseModel):
    provider_id: str
    provider_order_id: str | None = None
    platform_order_id: str = Field(default_factory=lambda: str(uuid4()))
    status: str
    message: str = ""
    raw_response_redacted: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)


class LiveOrderGateContext(BaseModel):
    """Caller context required for gated live order APIs."""

    live_trading_enabled: bool = False
    caller_role: str = "user"
    rms_approval_id: str | None = None
    user_approval_id: str | None = None
    provider_live_trading_enabled: bool = False
    kill_switch_off: bool = True
