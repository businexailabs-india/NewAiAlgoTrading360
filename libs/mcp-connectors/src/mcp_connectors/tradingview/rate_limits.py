from __future__ import annotations

from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="tradingview",
    requests_per_second=10,
    requests_per_minute=60,
    orders_per_second=0,
    orders_per_minute=0,
    burst=20,
    notes="TradingView webhook/signal preview limits (paper/signal only)",
)
