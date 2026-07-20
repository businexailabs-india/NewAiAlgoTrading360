from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="paper_trading",
    requests_per_second=50,
    orders_per_second=20,
    burst=100,
    notes="simulated provider",
)
