"""Rate-limit configuration for IIFL Trading API."""

from __future__ import annotations

from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="iifl",
    requests_per_second=5,
    requests_per_minute=240,
    orders_per_second=2,
    orders_per_minute=60,
    burst=10,
    quote_batch_max=50,
    notes="Phase-2 conservative defaults — tune after broker certification",
)
