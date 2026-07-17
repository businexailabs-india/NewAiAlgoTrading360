"""Canonical Pydantic contracts for advisory, strategies, and frontend APIs."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AdvisoryStatus(str, Enum):
    PREPARING = "preparing"
    READY = "ready"
    FAILED = "failed"
    EXPIRED = "expired"
    DISMISSED = "dismissed"


class LicenseStatus(str, Enum):
    UNKNOWN = "license_unknown"
    VALIDATED = "license_validated"
    REJECTED = "license_rejected"
    INTERNAL = "internal"
    USER_PROVIDED = "user_provided"


class VerificationStatus(str, Enum):
    NOT_VERIFIED = "not_verified"
    DISCOVERED = "discovered"
    NORMALIZED = "normalized"
    RISK_SCANNED = "risk_scanned"
    PAPER_TEST_READY = "paper_test_ready"
    REJECTED = "rejected"
    APPROVED_INTERNAL = "approved_internal"


class SourceType(str, Enum):
    INTERNAL = "internal"
    AI_GENERATED = "ai_generated"
    EXTERNAL_CANDIDATE = "third_party_strategy_candidate"
    USER_UPLOADED = "user_uploaded"
    PARTNER_API = "partner_api"
    GITHUB = "github"


FORBIDDEN_CLAIM_PATTERNS = (
    "guaranteed return",
    "guarantee profit",
    "guaranteed profit",
    "risk free",
    "risk-free",
    "sure shot",
    "100% return",
)


def reject_profit_promises(text: str) -> str:
    lower = (text or "").lower()
    for p in FORBIDDEN_CLAIM_PATTERNS:
        if p in lower:
            raise ValueError(f"Forbidden profit-promise language detected: {p}")
    return text


class RiskProfile(StrictModel):
    level: Literal["conservative", "balanced", "aggressive", "unknown"] = "unknown"
    max_daily_loss_pct: float | None = None
    max_position_pct: float | None = None
    options_allowed: bool = False
    completed: bool = False


class DataFreshness(StrictModel):
    source: str
    as_of: datetime
    max_age_seconds: int = 300
    is_stale: bool = False


class BrokerContext(StrictModel):
    account_id: str | None = None
    broker: str = "unknown"
    status: Literal["connected", "disconnected", "error", "paper"] = "disconnected"
    capabilities: list[str] = Field(default_factory=list)
    masked_client_id: str | None = None
    health: dict[str, Any] = Field(default_factory=dict)


class MarginSnapshot(StrictModel):
    available: float = 0.0
    utilized: float = 0.0
    currency: str = "INR"


class PortfolioSnapshot(StrictModel):
    holdings_count: int = 0
    total_invested: float = 0.0
    total_current: float = 0.0
    total_pnl: float = 0.0
    holdings: list[dict[str, Any]] = Field(default_factory=list)
    positions: list[dict[str, Any]] = Field(default_factory=list)


class MarketRegime(StrictModel):
    trend: Literal["bullish", "bearish", "sideways", "unknown"] = "unknown"
    volatility: Literal["low", "moderate", "high", "extreme"] = "moderate"
    risk_on: bool = False
    regime_label: str = "unknown"
    signals: dict[str, Any] = Field(default_factory=dict)
    explanation: str = ""


class StrategyRules(StrictModel):
    entry_rules: list[dict[str, Any]] = Field(default_factory=list)
    exit_rules: list[dict[str, Any]] = Field(default_factory=list)
    risk_rules: list[dict[str, Any]] = Field(default_factory=list)
    position_sizing: dict[str, Any] = Field(default_factory=dict)
    instruments: list[str] = Field(default_factory=list)
    timeframe: str = "5m"
    strategy_type: str = "custom"
    stop_loss_required: bool = True
    daily_max_loss: float | None = None
    unbounded_options_risk: bool = False


class RecommendationAction(str, Enum):
    CONVERT_TO_ALGO = "convert_to_algo"
    PAPER_TEST = "paper_test"
    SAVE = "save"
    DISMISS = "dismiss"


class AdvisoryRecommendationDTO(StrictModel):
    id: str
    title: str
    type: str
    symbols: list[str] = Field(default_factory=list)
    confidence_score: float = Field(ge=0, le=1)
    risk_score: float = Field(ge=0, le=1)
    required_capital: float = 0
    timeframe: str = "5m"
    rationale: str
    warnings: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    direction: str | None = None
    expected_holding_period: str | None = None
    max_loss_estimate: float | None = None
    stop_loss_required: bool = True
    target_required: bool = True
    explanation: str | None = None
    paper_only: bool = True
    source_type: SourceType = SourceType.AI_GENERATED

    @field_validator("title", "rationale", "explanation")
    @classmethod
    def _no_promises(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return reject_profit_promises(v)


class LoginAdvisoryResponse(StrictModel):
    advisory_id: str
    status: AdvisoryStatus
    generated_at: datetime | None = None
    market_status: str = "unknown"
    broker_status: str = "unknown"
    risk_profile: str = "unknown"
    summary: str
    recommendations: list[AdvisoryRecommendationDTO] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    disclaimer: str = (
        "This is not financial advice and does not guarantee returns. "
        "Paper test required before any live deployment. Live trading is disabled by default."
    )

    @field_validator("summary")
    @classmethod
    def _no_promises(cls, v: str) -> str:
        return reject_profit_promises(v)


class RmsDecision(StrictModel):
    allowed: bool
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    paper_only: bool = True
    live_blocked: bool = True
    checks: dict[str, bool] = Field(default_factory=dict)


class PaperTestMetrics(StrictModel):
    initial_capital: float
    final_capital: float
    pnl: float
    pnl_percent: float
    max_drawdown: float
    win_rate: float
    trade_count: int
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    risk_breaches: list[dict[str, Any]] = Field(default_factory=list)
    result_status: Literal["passed", "failed", "breached", "incomplete"] = "incomplete"
    qualified_for_live: bool = False


class AuditEventCreate(StrictModel):
    tenant_id: UUID
    user_id: UUID
    action: str
    resource: str
    details: dict[str, Any] = Field(default_factory=dict)
    ip_address: str | None = None
    device_id: str | None = None
    request_id: str | None = None


class ServiceIdentity(StrictModel):
    tenant_id: UUID
    user_id: UUID
    role: str = "user"
    request_id: str
    timestamp: int
