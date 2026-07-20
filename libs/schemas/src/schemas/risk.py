from __future__ import annotations

from pydantic import BaseModel, Field


class RiskRules(BaseModel):
    stop_loss_percent: float = Field(gt=0, le=50, default=2.0)
    target_percent: float | None = Field(default=4.0, ge=0, le=100)
    max_daily_loss: float = Field(gt=0, default=25000.0, description="INR absolute")
    max_position_value: float = Field(gt=0, default=200000.0)
    max_trades_per_day: int = Field(ge=1, default=10)
    cooldown_after_loss_minutes: int = Field(ge=0, default=30)
    intraday_square_off_time: str = "15:20"
    allow_options_selling: bool = False
    kill_switch_enabled: bool = True


class RiskCheckResult(BaseModel):
    allowed: bool
    reason: str = ""
    breaches: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
