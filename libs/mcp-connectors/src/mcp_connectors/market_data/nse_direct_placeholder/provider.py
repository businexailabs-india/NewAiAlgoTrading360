"""NSEDirectProvider — Phase-2 market data readiness adapter."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.base.rate_limits import RateLimitConfig
from mcp_connectors.india.phase2 import Phase2BrokerProvider
from mcp_connectors.market_data.nse_direct_placeholder.auth import AUTH_FLOW
from mcp_connectors.market_data.nse_direct_placeholder.errors import ERROR_MAP
from mcp_connectors.market_data.nse_direct_placeholder.fixtures import MOCK_FIXTURES
from mcp_connectors.market_data.nse_direct_placeholder.rate_limits import RATE_LIMIT


class NSEDirectProvider(Phase2BrokerProvider):
    provider_id = "nse_direct"
    provider_name = "NSE Direct Market Data Placeholder"
    provider_type = "market_data"
    country = "IN"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["NSE_CONTRACT_ID_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "NSE_DIRECT_BASE_URL"
    env_allow_live_key: ClassVar[str] = "NSE_DIRECT_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit: ClassVar[RateLimitConfig] = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/md/nse_direct/profile",
        "margins": "/md/nse_direct/margins",
        "holdings": "/md/nse_direct/holdings",
        "positions": "/md/nse_direct/positions",
        "orders": "/md/nse_direct/orders",
        "trades": "/md/nse_direct/trades",
        "quotes": "/md/nse_direct/quotes",
        "preview": "/md/nse_direct/preview",
        "refresh": "/md/nse_direct/session/refresh",
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
