"""ZerodhaMCPProvider — Phase-2 readiness adapter for Zerodha Kite Connect."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.zerodha.auth import AUTH_FLOW
from mcp_connectors.india.zerodha.errors import ERROR_MAP
from mcp_connectors.india.zerodha.fixtures import MOCK_FIXTURES
from mcp_connectors.india.zerodha.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class ZerodhaMCPProvider(Phase2BrokerProvider):
    provider_id = "zerodha"
    provider_name = "Zerodha Kite Connect"
    provider_type = "broker"
    country = "IN"
    symbol_style = "kite"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["ZERODHA_API_KEY", "ZERODHA_API_SECRET", "ZERODHA_ACCESS_TOKEN_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "ZERODHA_BASE_URL"
    env_allow_live_key: ClassVar[str] = "ZERODHA_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/user/profile",
        "margins": "/user/margins",
        "holdings": "/portfolio/holdings",
        "positions": "/portfolio/positions",
        "orders": "/orders",
        "trades": "/trades",
        "quotes": "/quote",
        "preview": "/margins/orders",
        "refresh": "/session/token",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
