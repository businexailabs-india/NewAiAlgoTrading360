from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4


class SignalDecision(str, Enum):
    BUY = "BUY"
    HOLD = "HOLD"
    REJECT = "REJECT"


class OrderIntentStatus(str, Enum):
    PROPOSED = "PROPOSED"
    VALIDATED = "VALIDATED"
    SUBMITTED = "SUBMITTED"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    DRY_RUN = "DRY_RUN"


@dataclass(frozen=True)
class Bar:
    ts: datetime  # timezone-aware, bar end / close time
    open: float
    high: float
    low: float
    close: float
    volume: float
    complete: bool = True


@dataclass
class IndicatorSnapshot:
    ema: float
    ema_slope: float
    vwap: float
    atr: float
    avg_volume: float
    opening_range_high: float
    opening_range_low: float
    opening_range_complete: bool


@dataclass
class SignalResult:
    decision: SignalDecision
    symbol: str
    bar_ts: datetime
    entry_price: float | None = None
    stop_price: float | None = None
    target_price: float | None = None
    stop_distance: float | None = None
    quantity: int = 0
    reasons: list[str] = field(default_factory=list)
    indicators: IndicatorSnapshot | None = None
    signal_id: str = field(default_factory=lambda: str(uuid4()))
    breakout_key: str | None = None


@dataclass
class RiskGateResult:
    name: str
    passed: bool
    detail: str


@dataclass
class BracketOrderSpec:
    strategy_id: str
    symbol: str
    account_id: str
    quantity: int
    entry_limit: float
    stop_price: float
    target_price: float
    tif: str = "DAY"
    outside_rth: bool = False
    parent_order_id: int | None = None
    stop_order_id: int | None = None
    target_order_id: int | None = None
    oca_group: str | None = None
    client_order_key: str = field(default_factory=lambda: str(uuid4()))
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class ContractInfo:
    symbol: str
    con_id: int
    exchange: str
    primary_exchange: str
    currency: str
    min_tick: float
    trading_hours: str = ""
    liquid_hours: str = ""
    time_zone_id: str = "America/New_York"


@dataclass
class AccountSnapshot:
    account_id: str
    net_liquidation: float
    currency: str
    is_paper: bool


@dataclass
class PortfolioSnapshot:
    equity: float
    equity_peak: float
    daily_pnl: float
    weekly_pnl: float
    drawdown_pct: float
    open_quantity: int
    trades_today: int
    monthly_sizing_equity: float
