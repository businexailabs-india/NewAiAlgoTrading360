"""Core value types shared by backtest, paper and live paths."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class Candle:
    """A candle. `start` is the bucket start (IST, tz-aware). `turnover` is sum(price*qty) when known."""

    symbol: str
    start: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    turnover: float | None = None
    interval_minutes: int = 5

    @property
    def end(self) -> datetime:
        return self.start + timedelta(minutes=self.interval_minutes)

    def is_sane(self) -> bool:
        return (
            self.low <= min(self.open, self.close)
            and self.high >= max(self.open, self.close)
            and self.low > 0
            and self.volume >= 0
        )


@dataclass(frozen=True)
class Quote:
    symbol: str
    ts: datetime
    ltp: float
    bid: float | None = None
    ask: float | None = None
    volume: float | None = None  # cumulative day volume

    @property
    def spread_bps(self) -> float | None:
        if self.bid and self.ask and self.bid > 0 and self.ask >= self.bid:
            mid = (self.bid + self.ask) / 2
            return (self.ask - self.bid) / mid * 10_000
        return None


@dataclass(frozen=True)
class TradeLevels:
    entry_price: float
    stop_distance: float
    stop_price: float
    target_price: float


class ExitReason(str, Enum):
    STOP_LOSS = "STOP_LOSS"
    TARGET = "TARGET"
    EMA_BEARISH_CROSS = "EMA_BEARISH_CROSS"
    VWAP_BREAKDOWN = "VWAP_BREAKDOWN"
    SUPERTREND_REVERSAL = "SUPERTREND_REVERSAL"
    TIME_SQUAREOFF = "TIME_SQUAREOFF"
    EMERGENCY = "EMERGENCY"
    DAILY_LOSS = "DAILY_LOSS"
    END_OF_DATA = "END_OF_DATA"


@dataclass
class SignalDecision:
    bot_id: str
    symbol: str
    candle_start: datetime
    candle_end: datetime
    signal: bool
    checks: dict[str, bool] = field(default_factory=dict)
    values: dict[str, float] = field(default_factory=dict)

    @property
    def failed(self) -> list[str]:
        return [k for k, v in self.checks.items() if not v]

    @property
    def signal_id(self) -> str:
        return f"{self.bot_id}:{self.symbol}:{self.candle_start.isoformat()}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "bot_id": self.bot_id,
            "symbol": self.symbol,
            "candle_start": self.candle_start.isoformat(),
            "candle_end": self.candle_end.isoformat(),
            "signal": self.signal,
            "failed": self.failed,
            "values": self.values,
        }
