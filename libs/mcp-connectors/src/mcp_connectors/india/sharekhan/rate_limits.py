"""Rate-limit configuration for Sharekhan API Placeholder."""

from __future__ import annotations

from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="sharekhan",
    requests_per_second=3,
    requests_per_minute=144,
    orders_per_second=1,
    orders_per_minute=30,
    burst=10,
    quote_batch_max=50,
    notes="Phase-2 conservative defaults — tune after broker certification",
)
