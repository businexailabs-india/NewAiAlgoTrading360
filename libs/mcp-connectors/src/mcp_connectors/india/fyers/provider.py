"""FyersMCPProvider — Phase-2 readiness adapter for Fyers API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.fyers.auth import AUTH_FLOW
from mcp_connectors.india.fyers.errors import ERROR_MAP
from mcp_connectors.india.fyers.fixtures import MOCK_FIXTURES
from mcp_connectors.india.fyers.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class FyersMCPProvider(Phase2BrokerProvider):
    provider_id = "fyers"
    provider_name = "Fyers API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["FYERS_APP_ID", "FYERS_APP_SECRET", "FYERS_ACCESS_TOKEN_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "FYERS_BASE_URL"
    env_allow_live_key: ClassVar[str] = "FYERS_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/fyers/profile",
        "margins": "/api/fyers/margins",
        "holdings": "/api/fyers/holdings",
        "positions": "/api/fyers/positions",
        "orders": "/api/fyers/orders",
        "trades": "/api/fyers/trades",
        "quotes": "/api/fyers/quotes",
        "preview": "/api/fyers/orders/preview",
        "refresh": "/api/fyers/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
