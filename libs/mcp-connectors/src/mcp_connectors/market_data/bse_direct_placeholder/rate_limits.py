from mcp_connectors.base.rate_limits import RateLimitConfig

RATE_LIMIT = RateLimitConfig(
    provider_id="bse_direct",
    requests_per_second=20,
    requests_per_minute=600,
    orders_per_second=0,
    orders_per_minute=0,
    burst=40,
    quote_batch_max=100,
    websocket_subscriptions_max=500,
    notes="market data phase-2 defaults",
)
