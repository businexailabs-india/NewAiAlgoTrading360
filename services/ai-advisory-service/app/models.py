"""SQLAlchemy models for advisory schema."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from advisory_core.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class AdvisorySession(Base):
    __tablename__ = "advisory_sessions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "advisory_date", name="uq_advisory_daily"),
        Index("ix_advisory_sessions_user_status", "user_id", "status"),
        {"schema": "advisory"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    account_id: Mapped[str | None] = mapped_column(String(128))
    advisory_date: Mapped[date] = mapped_column(Date, nullable=False)
    market: Mapped[str] = mapped_column(String(32), default="NSE")
    broker: Mapped[str] = mapped_column(String(64), default="unknown")
    status: Mapped[str] = mapped_column(String(32), default="preparing")
    summary: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(String(64))
    prompt_version: Mapped[str] = mapped_column(String(32), default="v1")
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    snapshot = relationship("AdvisoryInputSnapshot", back_populates="session", uselist=False)
    recommendations = relationship("AdvisoryRecommendation", back_populates="session")


class AdvisoryInputSnapshot(Base):
    __tablename__ = "advisory_input_snapshots"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    advisory_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advisory.advisory_sessions.id", ondelete="CASCADE")
    )
    portfolio_snapshot_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    margin_snapshot_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    risk_profile_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    market_snapshot_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    active_strategy_snapshot_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    broker_health_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    market_regime_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    data_sources_json: Mapped[dict] = mapped_column(JSONB, default=dict)

    session = relationship("AdvisorySession", back_populates="snapshot")


class AdvisoryRecommendation(Base):
    __tablename__ = "advisory_recommendations"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    advisory_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advisory.advisory_sessions.id", ondelete="CASCADE"), index=True
    )
    recommendation_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(256))
    summary: Mapped[str] = mapped_column(Text)
    asset_class: Mapped[str] = mapped_column(String(64), default="equity")
    exchange: Mapped[str] = mapped_column(String(32), default="NSE")
    symbols: Mapped[list] = mapped_column(JSONB, default=list)
    direction: Mapped[str | None] = mapped_column(String(32))
    timeframe: Mapped[str] = mapped_column(String(16), default="5m")
    expected_holding_period: Mapped[str | None] = mapped_column(String(64))
    confidence_score: Mapped[float] = mapped_column(Float, default=0.5)
    risk_score: Mapped[float] = mapped_column(Float, default=0.5)
    required_capital: Mapped[float] = mapped_column(Float, default=0)
    max_loss_estimate: Mapped[float | None] = mapped_column(Float)
    stop_loss_required: Mapped[bool] = mapped_column(Boolean, default=True)
    target_required: Mapped[bool] = mapped_column(Boolean, default=True)
    explanation: Mapped[str | None] = mapped_column(Text)
    warnings: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(32), default="active")
    paper_only: Mapped[bool] = mapped_column(Boolean, default=True)

    session = relationship("AdvisorySession", back_populates="recommendations")
    strategy_options = relationship("StrategyOption", back_populates="recommendation")


class StrategyOption(Base):
    __tablename__ = "strategy_options"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    advisory_recommendation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advisory.advisory_recommendations.id", ondelete="SET NULL")
    )
    strategy_type: Mapped[str] = mapped_column(String(64))
    strategy_name: Mapped[str] = mapped_column(String(256))
    version: Mapped[int] = mapped_column(Integer, default=1)
    entry_rules_json: Mapped[list] = mapped_column(JSONB, default=list)
    exit_rules_json: Mapped[list] = mapped_column(JSONB, default=list)
    risk_rules_json: Mapped[list] = mapped_column(JSONB, default=list)
    position_sizing_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    instruments_json: Mapped[list] = mapped_column(JSONB, default=list)
    timeframe: Mapped[str] = mapped_column(String(16), default="5m")
    paper_test_required: Mapped[bool] = mapped_column(Boolean, default=True)
    live_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    source_type: Mapped[str] = mapped_column(String(64), default="ai_generated")
    source_name: Mapped[str] = mapped_column(String(128), default="BusineXAi Advisory")
    source_license_status: Mapped[str] = mapped_column(String(64), default="internal")
    validation_status: Mapped[str] = mapped_column(String(64), default="draft")
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    paper_deployed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    recommendation = relationship("AdvisoryRecommendation", back_populates="strategy_options")
    paper_results = relationship("PaperTestResult", back_populates="strategy_option")
    approvals = relationship("UserStrategyApproval", back_populates="strategy_option")


class StrategyConfig(Base):
    __tablename__ = "strategy_configs"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    strategy_option_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(256))
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    versions = relationship("StrategyVersion", back_populates="config")


class StrategyVersion(Base):
    __tablename__ = "strategy_versions"
    __table_args__ = (
        UniqueConstraint("strategy_config_id", "version", name="uq_strategy_version"),
        {"schema": "advisory"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    strategy_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advisory.strategy_configs.id", ondelete="CASCADE")
    )
    version: Mapped[int] = mapped_column(Integer)
    config_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    config = relationship("StrategyConfig", back_populates="versions")


class ExternalAlgoCandidate(Base):
    __tablename__ = "external_algo_candidates"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    source_name: Mapped[str] = mapped_column(String(128))
    source_url: Mapped[str | None] = mapped_column(String(512))
    source_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text)
    asset_class: Mapped[str] = mapped_column(String(64), default="equity")
    exchange: Mapped[str] = mapped_column(String(32), default="NSE")
    strategy_logic_raw: Mapped[dict] = mapped_column(JSONB, default=dict)
    normalized_strategy_json: Mapped[dict | None] = mapped_column(JSONB)
    license_status: Mapped[str] = mapped_column(String(64), default="license_unknown")
    verification_status: Mapped[str] = mapped_column(String(64), default="discovered")
    performance_claims_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    risk_warnings: Mapped[list] = mapped_column(JSONB, default=list)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PaperTestResult(Base):
    __tablename__ = "paper_test_results"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    strategy_option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advisory.strategy_options.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    account_id: Mapped[str | None] = mapped_column(String(128))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    initial_capital: Mapped[float] = mapped_column(Float)
    final_capital: Mapped[float | None] = mapped_column(Float)
    pnl: Mapped[float | None] = mapped_column(Float)
    pnl_percent: Mapped[float | None] = mapped_column(Float)
    max_drawdown: Mapped[float | None] = mapped_column(Float)
    win_rate: Mapped[float | None] = mapped_column(Float)
    trade_count: Mapped[int] = mapped_column(Integer, default=0)
    profit_factor: Mapped[float | None] = mapped_column(Float)
    sharpe_ratio: Mapped[float | None] = mapped_column(Float)
    risk_breaches_json: Mapped[list] = mapped_column(JSONB, default=list)
    result_status: Mapped[str] = mapped_column(String(32), default="incomplete")
    qualified_for_live: Mapped[bool] = mapped_column(Boolean, default=False)
    dataset_version: Mapped[str | None] = mapped_column(String(64))

    strategy_option = relationship("StrategyOption", back_populates="paper_results")


class UserStrategyApproval(Base):
    __tablename__ = "user_strategy_approvals"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    strategy_option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advisory.strategy_options.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    approval_type: Mapped[str] = mapped_column(String(64))  # paper_deploy | live_request | risk_disclosure
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ip_address: Mapped[str | None] = mapped_column(String(64))
    device_id: Mapped[str | None] = mapped_column(String(128))
    risk_disclosure_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_text: Mapped[str | None] = mapped_column(Text)

    strategy_option = relationship("StrategyOption", back_populates="approvals")


class LiveDeploymentRequest(Base):
    __tablename__ = "live_deployment_requests"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    strategy_option_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending|approved|rejected|blocked
    block_reasons: Mapped[list] = mapped_column(JSONB, default=list)
    explicit_confirmation: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdvisoryAuditEvent(Base):
    __tablename__ = "advisory_audit_events"
    __table_args__ = (
        Index("ix_advisory_audit_tenant_user", "tenant_id", "user_id"),
        {"schema": "advisory"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String(128))
    resource: Mapped[str] = mapped_column(String(128))
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    device_id: Mapped[str | None] = mapped_column(String(128))
    request_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KafkaInbox(Base):
    __tablename__ = "kafka_inbox"
    __table_args__ = ({"schema": "advisory"},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(256), unique=True)
    topic: Mapped[str] = mapped_column(String(128))
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
