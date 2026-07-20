from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class PaperTradingAccount(BaseModel):
    account_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    starting_balance: float = 1_000_000.0
    cash_balance: float = 1_000_000.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    open_positions: list[dict] = Field(default_factory=list)
    closed_trades: list[dict] = Field(default_factory=list)
    currency: str = "INR"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    kill_switch_active: bool = False


class PaperOrder(BaseModel):
    order_id: str = Field(default_factory=lambda: str(uuid4()))
    account_id: str
    strategy_id: str | None = None
    symbol: str
    side: OrderSide
    order_type: OrderType = OrderType.MARKET
    quantity: int = Field(gt=0)
    limit_price: float | None = None
    status: OrderStatus = OrderStatus.PENDING
    filled_price: float | None = None
    filled_qty: int = 0
    slippage: float = 0.0
    brokerage: float = 0.0
    reject_reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaperPosition(BaseModel):
    symbol: str
    quantity: int
    average_price: float
    last_price: float
    unrealized_pnl: float = 0.0
    product_type: str = "CNC"


class PaperTrade(BaseModel):
    trade_id: str = Field(default_factory=lambda: str(uuid4()))
    account_id: str
    order_id: str
    symbol: str
    side: OrderSide
    quantity: int
    price: float
    pnl: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
