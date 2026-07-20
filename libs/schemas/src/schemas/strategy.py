from __future__ import annotations

import os
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from schemas.risk import RiskRules

RISK_WARNING = (
    "Trading involves risk of loss. Past paper-test results do not guarantee future performance. "
    "Never risk capital you cannot afford to lose. No strategy promises profit."
)


class StrategyStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    PAPER_TESTING = "paper_testing"
    PAPER_DEPLOYED = "paper_deployed"
    LIVE_ELIGIBLE = "live_eligible"
    PAUSED = "paused"
    STOPPED = "stopped"
    REJECTED = "rejected"


def _strategy_live_allowed_by_env() -> bool:
    return os.getenv("ALLOW_STRATEGY_LIVE", "false").lower() in ("1", "true", "yes", "on")


class StrategyConfig(BaseModel):
    strategy_id: str = Field(default_factory=lambda: str(uuid4()))
    strategy_name: str
    strategy_type: str
    asset_class: str = "equity"
    exchange: str = "NSE"
    symbols: list[str] = Field(default_factory=list)
    timeframe: str = "5m"
    entry_rules: dict[str, Any] = Field(default_factory=dict)
    exit_rules: dict[str, Any] = Field(default_factory=dict)
    risk_rules: RiskRules = Field(default_factory=RiskRules)
    position_sizing: dict[str, Any] = Field(
        default_factory=lambda: {"method": "fixed_fraction", "fraction": 0.1, "max_qty": 100}
    )
    paper_trading_required: bool = True
    live_trading_enabled: bool = False
    created_by: str = "demo-user"
    version: str = "1.0.0"
    status: StrategyStatus = StrategyStatus.DRAFT
    template_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    risk_warning: str = RISK_WARNING
    paper_qualified: bool = False
    admin_approved_for_live: bool = False

    def model_post_init(self, __context: Any) -> None:
        # Default lock — live only via unlock_live() when ALLOW_STRATEGY_LIVE=true
        if not _strategy_live_allowed_by_env() or not (
            self.paper_qualified and self.admin_approved_for_live
        ):
            object.__setattr__(self, "live_trading_enabled", False)
        if not self.paper_trading_required:
            object.__setattr__(self, "paper_trading_required", True)

    def unlock_live(self, *, paper_qualified: bool, admin_approved: bool) -> "StrategyConfig":
        """Gated unlock for Phase 4. Still requires OMS for any broker order."""
        if not _strategy_live_allowed_by_env():
            raise PermissionError("ALLOW_STRATEGY_LIVE=false")
        if not paper_qualified:
            raise PermissionError("paper_qualification_required")
        if not admin_approved:
            raise PermissionError("admin_approval_required")
        object.__setattr__(self, "paper_qualified", True)
        object.__setattr__(self, "admin_approved_for_live", True)
        object.__setattr__(self, "live_trading_enabled", True)
        object.__setattr__(self, "status", StrategyStatus.LIVE_ELIGIBLE)
        return self


class StrategyValidationResult(BaseModel):
    ok: bool
    strategy_id: str
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    live_trading_enabled: bool = False
    paper_trading_required: bool = True
    risk_warning: str = RISK_WARNING


class SuitabilityScore(BaseModel):
    suitable_for_user_score: float = Field(ge=0, le=100)
    risk_level: str = "medium"
    paper_test_required: bool = True
    live_deployment_locked: bool = True
    components: dict[str, float] = Field(default_factory=dict)
    risk_warning: str = RISK_WARNING
