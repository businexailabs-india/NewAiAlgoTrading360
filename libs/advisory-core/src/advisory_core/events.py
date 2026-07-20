"""Kafka / Redpanda event envelopes and topic names."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class KafkaTopics:
    USER_LOGIN_SUCCESS = "user.login.success"
    ADVISORY_GENERATION_REQUESTED = "advisory.generation.requested"
    ADVISORY_GENERATED = "advisory.generated"
    ADVISORY_FAILED = "advisory.failed"
    STRATEGY_OPTION_SELECTED = "strategy.option.selected"
    STRATEGY_GENERATED_FROM_ADVISORY = "strategy.generated.from.advisory"
    STRATEGY_PAPER_TEST_REQUESTED = "strategy.paper_test.requested"
    STRATEGY_PAPER_TEST_COMPLETED = "strategy.paper_test.completed"
    STRATEGY_SAVED = "strategy.saved"
    STRATEGY_LIVE_DEPLOYMENT_REQUESTED = "strategy.live_deployment.requested"
    USER_APPROVAL_CREATED = "user.approval.created"
    COMPLIANCE_AUDIT_CREATED = "compliance.audit.created"

    # MCP provider / connection lifecycle (TradeOS360 connector layer)
    MCP_PROVIDER_REGISTERED = "mcp.provider.registered"
    MCP_CONNECTION_CREATED = "mcp.connection.created"
    MCP_CONNECTION_TESTED = "mcp.connection.tested"
    MCP_CONNECTION_FAILED = "mcp.connection.failed"
    MCP_CONNECTION_CONNECTED = "mcp.connection.connected"
    MCP_CONNECTION_DISCONNECTED = "mcp.connection.disconnected"
    MCP_CONNECTION_HEALTH_CHANGED = "mcp.connection.health.changed"
    MCP_ACCOUNT_SNAPSHOT_UPDATED = "mcp.account.snapshot.updated"
    MCP_MARKET_QUOTE_RECEIVED = "mcp.market.quote.received"
    MCP_MARKET_TICK_RECEIVED = "mcp.market.tick.received"
    MCP_ORDER_PREVIEW_CREATED = "mcp.order.preview.created"
    MCP_PROVIDER_RATE_LIMIT_WARNING = "mcp.provider.rate_limit.warning"

    ALL = [
        USER_LOGIN_SUCCESS,
        ADVISORY_GENERATION_REQUESTED,
        ADVISORY_GENERATED,
        ADVISORY_FAILED,
        STRATEGY_OPTION_SELECTED,
        STRATEGY_GENERATED_FROM_ADVISORY,
        STRATEGY_PAPER_TEST_REQUESTED,
        STRATEGY_PAPER_TEST_COMPLETED,
        STRATEGY_SAVED,
        STRATEGY_LIVE_DEPLOYMENT_REQUESTED,
        USER_APPROVAL_CREATED,
        COMPLIANCE_AUDIT_CREATED,
        MCP_PROVIDER_REGISTERED,
        MCP_CONNECTION_CREATED,
        MCP_CONNECTION_TESTED,
        MCP_CONNECTION_FAILED,
        MCP_CONNECTION_CONNECTED,
        MCP_CONNECTION_DISCONNECTED,
        MCP_CONNECTION_HEALTH_CHANGED,
        MCP_ACCOUNT_SNAPSHOT_UPDATED,
        MCP_MARKET_QUOTE_RECEIVED,
        MCP_MARKET_TICK_RECEIVED,
        MCP_ORDER_PREVIEW_CREATED,
        MCP_PROVIDER_RATE_LIMIT_WARNING,
    ]


class EventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    tenant_id: str
    user_id: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    idempotency_key: str
    payload: dict[str, Any] = Field(default_factory=dict)
    schema_version: str = "1.0"

    @classmethod
    def create(
        cls,
        event_type: str,
        tenant_id: UUID | str,
        user_id: UUID | str,
        payload: dict[str, Any],
        idempotency_key: str | None = None,
        correlation_id: str | None = None,
    ) -> "EventEnvelope":
        key = idempotency_key or f"{event_type}:{tenant_id}:{user_id}:{uuid4()}"
        return cls(
            event_type=event_type,
            tenant_id=str(tenant_id),
            user_id=str(user_id),
            payload=payload,
            idempotency_key=key,
            correlation_id=correlation_id or str(uuid4()),
        )
