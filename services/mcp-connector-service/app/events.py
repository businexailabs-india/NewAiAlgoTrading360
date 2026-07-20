"""Kafka event publishing helpers for MCP lifecycle."""

from __future__ import annotations

import logging
from typing import Any

from advisory_core.events import EventEnvelope, KafkaTopics
from advisory_core.kafka_io import publish_event
from advisory_core.security import redact_secrets

logger = logging.getLogger(__name__)


async def emit(
    topic: str,
    *,
    tenant_id: str,
    user_id: str,
    payload: dict[str, Any],
    bootstrap: str | None = None,
) -> None:
    event = EventEnvelope.create(
        event_type=topic,
        tenant_id=tenant_id,
        user_id=user_id,
        payload=redact_secrets(payload),
    )
    try:
        await publish_event(topic, event, bootstrap=bootstrap)
    except Exception as exc:  # noqa: BLE001
        logger.warning("kafka publish failed topic=%s err=%s", topic, exc)


# Re-export topic constants used by service
MCP_TOPICS = KafkaTopics
