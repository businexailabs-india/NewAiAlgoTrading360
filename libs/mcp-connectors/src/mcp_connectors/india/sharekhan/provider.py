"""SharekhanMCPProvider — Phase-2 readiness adapter for Sharekhan API Placeholder."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.sharekhan.auth import AUTH_FLOW
from mcp_connectors.india.sharekhan.errors import ERROR_MAP
from mcp_connectors.india.sharekhan.fixtures import MOCK_FIXTURES
from mcp_connectors.india.sharekhan.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class SharekhanMCPProvider(Phase2BrokerProvider):
    provider_id = "sharekhan"
    provider_name = "Sharekhan API Placeholder"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["SHAREKHAN_API_KEY_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "SHAREKHAN_BASE_URL"
    env_allow_live_key: ClassVar[str] = "SHAREKHAN_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/sharekhan/profile",
        "margins": "/api/sharekhan/margins",
        "holdings": "/api/sharekhan/holdings",
        "positions": "/api/sharekhan/positions",
        "orders": "/api/sharekhan/orders",
        "trades": "/api/sharekhan/trades",
        "quotes": "/api/sharekhan/quotes",
        "preview": "/api/sharekhan/orders/preview",
        "refresh": "/api/sharekhan/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
