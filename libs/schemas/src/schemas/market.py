from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class MarketRegime(str, Enum):
    TRENDING = "trending"
    SIDEWAYS = "sideways"
    VOLATILE = "volatile"
    GAP_UP = "gap_up"
    GAP_DOWN = "gap_down"


class Candle(BaseModel):
    symbol: str
    timeframe: str
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    regime: MarketRegime | None = None


class MarketQuote(BaseModel):
    symbol: str
    ltp: float
    bid: float | None = None
    ask: float | None = None
    volume: float = 0.0
    ts: datetime | None = None
    stale: bool = False
