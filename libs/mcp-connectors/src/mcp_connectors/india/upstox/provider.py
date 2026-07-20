"""UpstoxMCPProvider — Phase-2 readiness adapter for Upstox API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.upstox.auth import AUTH_FLOW
from mcp_connectors.india.upstox.errors import ERROR_MAP
from mcp_connectors.india.upstox.fixtures import MOCK_FIXTURES
from mcp_connectors.india.upstox.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class UpstoxMCPProvider(Phase2BrokerProvider):
    provider_id = "upstox"
    provider_name = "Upstox API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["UPSTOX_CLIENT_ID", "UPSTOX_CLIENT_SECRET", "UPSTOX_ACCESS_TOKEN_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "UPSTOX_BASE_URL"
    env_allow_live_key: ClassVar[str] = "UPSTOX_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/v2/user/profile",
        "margins": "/v2/user/get-funds-and-margin",
        "holdings": "/v2/portfolio/long-term-holdings",
        "positions": "/v2/portfolio/short-term-positions",
        "orders": "/v2/order/retrieve-all",
        "trades": "/v2/order/trades/get-trades-for-day",
        "quotes": "/v2/market-quote/quotes",
        "preview": "/v2/order/place",
        "refresh": "/v2/login/authorization/token",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
