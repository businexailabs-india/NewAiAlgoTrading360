"""HDFCSkyMCPProvider — Phase-2 readiness adapter for HDFC Sky API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.hdfc_sky.auth import AUTH_FLOW
from mcp_connectors.india.hdfc_sky.errors import ERROR_MAP
from mcp_connectors.india.hdfc_sky.fixtures import MOCK_FIXTURES
from mcp_connectors.india.hdfc_sky.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class HDFCSkyMCPProvider(Phase2BrokerProvider):
    provider_id = "hdfc_sky"
    provider_name = "HDFC Sky API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["HDFC_SKY_API_KEY", "HDFC_SKY_CLIENT_ID"]
    env_base_url_key: ClassVar[str] = "HDFC_SKY_BASE_URL"
    env_allow_live_key: ClassVar[str] = "HDFC_SKY_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/hdfc_sky/profile",
        "margins": "/api/hdfc_sky/margins",
        "holdings": "/api/hdfc_sky/holdings",
        "positions": "/api/hdfc_sky/positions",
        "orders": "/api/hdfc_sky/orders",
        "trades": "/api/hdfc_sky/trades",
        "quotes": "/api/hdfc_sky/quotes",
        "preview": "/api/hdfc_sky/orders/preview",
        "refresh": "/api/hdfc_sky/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
