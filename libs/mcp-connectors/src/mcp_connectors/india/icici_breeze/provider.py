"""ICICIBreezeMCPProvider — Phase-2 readiness adapter for ICICI Direct Breeze API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.icici_breeze.auth import AUTH_FLOW
from mcp_connectors.india.icici_breeze.errors import ERROR_MAP
from mcp_connectors.india.icici_breeze.fixtures import MOCK_FIXTURES
from mcp_connectors.india.icici_breeze.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class ICICIBreezeMCPProvider(Phase2BrokerProvider):
    provider_id = "icici_breeze"
    provider_name = "ICICI Direct Breeze API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["ICICI_BREEZE_API_KEY", "ICICI_BREEZE_API_SECRET", "ICICI_BREEZE_SESSION_TOKEN_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "ICICI_BREEZE_BASE_URL"
    env_allow_live_key: ClassVar[str] = "ICICI_BREEZE_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/icici_breeze/profile",
        "margins": "/api/icici_breeze/margins",
        "holdings": "/api/icici_breeze/holdings",
        "positions": "/api/icici_breeze/positions",
        "orders": "/api/icici_breeze/orders",
        "trades": "/api/icici_breeze/trades",
        "quotes": "/api/icici_breeze/quotes",
        "preview": "/api/icici_breeze/orders/preview",
        "refresh": "/api/icici_breeze/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
