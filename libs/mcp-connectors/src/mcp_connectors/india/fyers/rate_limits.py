"""Rate-limit configuration for Fyers API."""

from __future__ import annotations

from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="fyers",
    requests_per_second=8,
    requests_per_minute=384,
    orders_per_second=3,
    orders_per_minute=90,
    burst=16,
    quote_batch_max=50,
    notes="Phase-2 conservative defaults — tune after broker certification",
)
