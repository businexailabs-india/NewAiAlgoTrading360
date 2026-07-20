"""GlobalDataFeedsProvider — Phase-2 market data readiness adapter."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.base.rate_limits import RateLimitConfig
from mcp_connectors.india.phase2 import Phase2BrokerProvider
from mcp_connectors.market_data.globaldatafeeds.auth import AUTH_FLOW
from mcp_connectors.market_data.globaldatafeeds.errors import ERROR_MAP
from mcp_connectors.market_data.globaldatafeeds.fixtures import MOCK_FIXTURES
from mcp_connectors.market_data.globaldatafeeds.rate_limits import RATE_LIMIT


class GlobalDataFeedsProvider(Phase2BrokerProvider):
    provider_id = "globaldatafeeds"
    provider_name = "GlobalDataFeeds"
    provider_type = "market_data"
    country = "IN"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["GLOBALDATAFEEDS_API_KEY"]
    env_base_url_key: ClassVar[str] = "GLOBALDATAFEEDS_BASE_URL"
    env_allow_live_key: ClassVar[str] = "GLOBALDATAFEEDS_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit: ClassVar[RateLimitConfig] = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/md/globaldatafeeds/profile",
        "margins": "/md/globaldatafeeds/margins",
        "holdings": "/md/globaldatafeeds/holdings",
        "positions": "/md/globaldatafeeds/positions",
        "orders": "/md/globaldatafeeds/orders",
        "trades": "/md/globaldatafeeds/trades",
        "quotes": "/md/globaldatafeeds/quotes",
        "preview": "/md/globaldatafeeds/preview",
        "refresh": "/md/globaldatafeeds/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)

    async def preview_order(self, order_request):
        return {
            "preview": False,
            "accepted": False,
            "reason": "market_data_provider",
            "provider_id": self.provider_id,
        }
