"""Broker-neutral execution interface shared by the paper executor and the Dhan live executor."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Protocol, runtime_checkable

from tradex_bots.config import ExecutionMode
from tradex_bots.models import Quote, Side


class BrokerError(Exception):
    """Definitive broker/transport failure (request was not accepted)."""


class BrokerRejected(BrokerError):
    """Broker responded and rejected the request."""


class BrokerTimeout(BrokerError):
    """Outcome UNKNOWN: the request may or may not have reached the broker. Query before retrying."""


class BrokerStatus(str, Enum):
    TRANSIT = "TRANSIT"
    PENDING = "PENDING"
    PART_TRADED = "PART_TRADED"
    TRADED = "TRADED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    TRIGGERED = "TRIGGERED"

    @property
    def terminal(self) -> bool:
        return self in (BrokerStatus.TRADED, BrokerStatus.CANCELLED, BrokerStatus.REJECTED, BrokerStatus.EXPIRED)


@dataclass
class BrokerOrderRequest:
    correlation_id: str
    symbol: str
    security_id: str
    side: Side
    quantity: int
    order_type: str  # MARKET | LIMIT | STOP_LOSS | STOP_LOSS_MARKET
    price: float = 0.0
    trigger_price: float = 0.0
    product: str = "INTRADAY"
    exchange_segment: str = "NSE_EQ"
    validity: str = "DAY"


@dataclass
class BrokerOrder:
    order_id: str
    correlation_id: str
    status: BrokerStatus
    symbol: str = ""
    side: Side | None = None
    quantity: int = 0
    filled_qty: int = 0
    avg_price: float = 0.0
    order_type: str = ""
    price: float = 0.0
    trigger_price: float = 0.0
    error: str = ""
    updated_at: datetime | None = None


@dataclass
class BrokerTrade:
    trade_id: str
    order_id: str
    symbol: str
    side: Side
    quantity: int
    price: float
    ts: datetime | None = None


@dataclass
class BrokerPosition:
    symbol: str
    net_qty: int
    avg_price: float = 0.0


@dataclass
class BrokerAck:
    order_id: str
    status: BrokerStatus
    raw: dict = field(default_factory=dict)


@runtime_checkable
class BrokerAdapter(Protocol):
    mode: ExecutionMode

    def place_order(self, req: BrokerOrderRequest) -> BrokerAck: ...
    def get_order(self, order_id: str) -> BrokerOrder | None: ...
    def get_order_by_correlation(self, correlation_id: str) -> BrokerOrder | None: ...
    def cancel_order(self, order_id: str) -> BrokerOrder: ...
    def list_orders(self) -> list[BrokerOrder]: ...
    def list_trades(self) -> list[BrokerTrade]: ...
    def list_positions(self) -> list[BrokerPosition]: ...
    def get_funds(self) -> float: ...
    def get_quote(self, symbol: str) -> Quote | None: ...
    def healthy(self) -> bool: ...
