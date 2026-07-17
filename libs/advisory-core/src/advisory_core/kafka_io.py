"""Lightweight Kafka producer/consumer helpers with inbox/outbox support."""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

from advisory_core.events import EventEnvelope

logger = logging.getLogger("advisory.kafka")


class InMemoryEventBus:
    """Test/dev bus used when Kafka is unavailable."""

    def __init__(self) -> None:
        self.topics: dict[str, list[EventEnvelope]] = {}
        self.handlers: dict[str, list[Callable[[EventEnvelope], Awaitable[None]]]] = {}

    async def publish(self, topic: str, event: EventEnvelope) -> None:
        self.topics.setdefault(topic, []).append(event)
        for handler in self.handlers.get(topic, []):
            await handler(event)

    def subscribe(self, topic: str, handler: Callable[[EventEnvelope], Awaitable[None]]) -> None:
        self.handlers.setdefault(topic, []).append(handler)


_bus = InMemoryEventBus()


def get_event_bus() -> InMemoryEventBus:
    return _bus


async def publish_event(topic: str, event: EventEnvelope, bootstrap: str | None = None) -> None:
    """Publish to Kafka when aiokafka is available; otherwise in-memory bus."""
    if not bootstrap or bootstrap.startswith("memory://"):
        await get_event_bus().publish(topic, event)
        return
    try:
        from aiokafka import AIOKafkaProducer

        producer = AIOKafkaProducer(bootstrap_servers=bootstrap)
        await producer.start()
        try:
            await producer.send_and_wait(
                topic,
                json.dumps(event.model_dump(mode="json")).encode("utf-8"),
                key=event.idempotency_key.encode("utf-8"),
            )
        finally:
            await producer.stop()
    except Exception as exc:  # pragma: no cover - network path
        logger.warning("kafka_publish_fallback_memory error=%s", exc)
        await get_event_bus().publish(topic, event)


async def consume_loop(
    topic: str,
    handler: Callable[[EventEnvelope], Awaitable[None]],
    bootstrap: str | None = None,
    group_id: str = "advisory",
) -> None:
    if not bootstrap or bootstrap.startswith("memory://"):
        get_event_bus().subscribe(topic, handler)
        return
    try:
        from aiokafka import AIOKafkaConsumer

        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=bootstrap,
            group_id=group_id,
            enable_auto_commit=True,
            auto_offset_reset="earliest",
        )
        await consumer.start()
        try:
            async for msg in consumer:
                data = json.loads(msg.value.decode("utf-8"))
                await handler(EventEnvelope.model_validate(data))
        finally:
            await consumer.stop()
    except Exception as exc:  # pragma: no cover
        logger.error("kafka_consume_failed error=%s", exc)
        raise
