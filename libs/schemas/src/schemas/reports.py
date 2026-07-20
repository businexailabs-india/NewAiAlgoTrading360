from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from schemas.strategy import RISK_WARNING, SuitabilityScore


class PerformanceReport(BaseModel):
    report_id: str = Field(default_factory=lambda: str(uuid4()))
    strategy_id: str
    total_pnl: float = 0.0
    pnl_percent: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    loss_rate: float = 0.0
    average_win: float = 0.0
    average_loss: float = 0.0
    profit_factor: float = 0.0
    number_of_trades: int = 0
    best_trade: float = 0.0
    worst_trade: float = 0.0
    risk_breaches: list[str] = Field(default_factory=list)
    strategy_suitability_score: SuitabilityScore | None = None
    risk_warning: str = RISK_WARNING
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extras: dict[str, Any] = Field(default_factory=dict)


class PaperTestReport(BaseModel):
    test_id: str = Field(default_factory=lambda: str(uuid4()))
    strategy_id: str
    account_id: str
    performance: PerformanceReport
    orders_placed: int = 0
    risk_warning: str = RISK_WARNING
    live_trading_enabled: bool = False
    status: str = "completed"
