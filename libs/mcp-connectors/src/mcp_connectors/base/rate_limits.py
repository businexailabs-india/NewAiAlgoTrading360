"""Per-provider rate-limit configuration (advisory + OMS throttling hints)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RateLimitConfig(BaseModel):
    provider_id: str
    requests_per_second: float = 10.0
    requests_per_minute: int = 300
    orders_per_second: float = 5.0
    orders_per_minute: int = 120
    burst: int = 20
    quote_batch_max: int = 50
    historical_concurrency: int = 2
    websocket_subscriptions_max: int = 200
    notes: str = ""
    headers: dict[str, str] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return self.model_dump(mode="json")


# Sensible Indian-broker defaults (conservative until certified)
DEFAULT_BROKER_LIMITS = RateLimitConfig(
    provider_id="default_broker",
    requests_per_second=8,
    requests_per_minute=200,
    orders_per_second=3,
    orders_per_minute=60,
    burst=15,
    quote_batch_max=40,
)

DEFAULT_MARKET_DATA_LIMITS = RateLimitConfig(
    provider_id="default_market_data",
    requests_per_second=20,
    requests_per_minute=600,
    orders_per_second=0,
    orders_per_minute=0,
    burst=40,
    quote_batch_max=100,
    websocket_subscriptions_max=500,
)
