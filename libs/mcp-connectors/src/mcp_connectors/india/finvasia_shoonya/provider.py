"""FinvasiaShoonyaMCPProvider — Phase-2 readiness adapter for Finvasia Shoonya API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.finvasia_shoonya.auth import AUTH_FLOW
from mcp_connectors.india.finvasia_shoonya.errors import ERROR_MAP
from mcp_connectors.india.finvasia_shoonya.fixtures import MOCK_FIXTURES
from mcp_connectors.india.finvasia_shoonya.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class FinvasiaShoonyaMCPProvider(Phase2BrokerProvider):
    provider_id = "finvasia_shoonya"
    provider_name = "Finvasia Shoonya API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["SHOONYA_USER_ID", "SHOONYA_VENDOR_CODE", "SHOONYA_API_SECRET"]
    env_base_url_key: ClassVar[str] = "SHOONYA_BASE_URL"
    env_allow_live_key: ClassVar[str] = "SHOONYA_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/finvasia_shoonya/profile",
        "margins": "/api/finvasia_shoonya/margins",
        "holdings": "/api/finvasia_shoonya/holdings",
        "positions": "/api/finvasia_shoonya/positions",
        "orders": "/api/finvasia_shoonya/orders",
        "trades": "/api/finvasia_shoonya/trades",
        "quotes": "/api/finvasia_shoonya/quotes",
        "preview": "/api/finvasia_shoonya/orders/preview",
        "refresh": "/api/finvasia_shoonya/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
