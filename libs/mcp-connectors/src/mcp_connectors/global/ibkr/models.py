"""Normalized IBKR models for TradeOS360."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from .config import IBKRConnectionConfig

__all__ = [
    "IBKRConnectionConfig",
    "IBKRContractRequest",
    "IBKRContract",
    "IBKROrderRequest",
    "IBKROrderResponse",
    "IBKRPosition",
    "IBKRAccountSummary",
    "IBKRExecution",
    "IBKRMarketDataTick",
    "IBKRHistoricalBar",
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IBKRContractRequest(BaseModel):
    symbol: str
    sec_type: Literal["STK", "OPT", "FUT", "CASH", "BOND", "ETF"] = "STK"
    exchange: str = "SMART"
    currency: str = "USD"
    last_trade_date_or_contract_month: str | None = None
    strike: float | None = None
    right: Literal["C", "P"] | None = None
    multiplier: str | None = None
    primary_exchange: str | None = None
    local_symbol: str | None = None
    con_id: int | None = None


class IBKRContract(BaseModel):
    con_id: int | None = None
    symbol: str
    sec_type: str = "STK"
    exchange: str = "SMART"
    currency: str = "USD"
    local_symbol: str | None = None
    trading_class: str | None = None
    primary_exchange: str | None = None
    last_trade_date_or_contract_month: str | None = None
    strike: float | None = None
    right: str | None = None
    multiplier: str | None = None
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class IBKROrderRequest(BaseModel):
    symbol: str
    side: Literal["BUY", "SELL"]
    quantity: float
    order_type: Literal["MARKET", "LIMIT", "STOP", "STOP_LIMIT", "BRACKET"] = "MARKET"
    sec_type: str = "STK"
    exchange: str = "SMART"
    currency: str = "USD"
    limit_price: float | None = None
    stop_price: float | None = None
    tif: str = "DAY"
    account_id: str = ""
    idempotency_key: str = Field(default_factory=lambda: str(uuid4()))
    oms_order_id: str | None = None
    rms_approval_id: str | None = None
    user_approval_id: str | None = None
    strategy_id: str | None = None
    caller_role: str = "user"
    con_id: int | None = None
    last_trade_date_or_contract_month: str | None = None
    strike: float | None = None
    right: Literal["C", "P"] | None = None
    multiplier: str | None = None


class IBKROrderResponse(BaseModel):
    provider_id: str = "ibkr"
    provider_order_id: str | None = None
    platform_order_id: str = Field(default_factory=lambda: str(uuid4()))
    status: str
    message: str = ""
    filled_qty: float = 0
    avg_fill_price: float | None = None
    mode: str = "paper"
    idempotency_key: str | None = None
    raw_response_redacted: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)


class IBKRPosition(BaseModel):
    account_id_masked: str = ""
    symbol: str
    sec_type: str = "STK"
    exchange: str = "SMART"
    currency: str = "USD"
    position: float
    avg_cost: float = 0
    market_price: float | None = None
    market_value: float | None = None
    unrealized_pnl: float | None = None
    con_id: int | None = None


class IBKRAccountSummary(BaseModel):
    account_id_masked: str = ""
    currency: str = "USD"
    net_liquidation: float = 0
    total_cash: float = 0
    buying_power: float = 0
    available_funds: float = 0
    excess_liquidity: float = 0
    maintenance_margin: float = 0
    init_margin: float = 0
    unrealized_pnl: float = 0
    realized_pnl: float = 0
    mode: str = "paper"
    provider_id: str = "ibkr"


class IBKRExecution(BaseModel):
    exec_id: str
    provider_order_id: str
    symbol: str
    side: str
    shares: float
    price: float
    currency: str = "USD"
    exchange: str = ""
    time: str = ""
    account_id_masked: str = ""
    commission: float | None = None


class IBKRMarketDataTick(BaseModel):
    symbol: str
    bid: float | None = None
    ask: float | None = None
    last: float | None = None
    close: float | None = None
    volume: float | None = None
    bid_size: float | None = None
    ask_size: float | None = None
    currency: str = "USD"
    delayed: bool = True


class IBKRHistoricalBar(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float = 0
    bar_count: int | None = None
    wap: float | None = None
