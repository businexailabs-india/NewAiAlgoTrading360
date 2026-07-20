"""Rate-limit configuration for Upstox API."""

from __future__ import annotations

from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="upstox",
    requests_per_second=10,
    requests_per_minute=480,
    orders_per_second=5,
    orders_per_minute=150,
    burst=20,
    quote_batch_max=50,
    notes="Phase-2 conservative defaults — tune after broker certification",
)
