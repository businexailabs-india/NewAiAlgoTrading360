"""SamcoMCPProvider — Phase-2 readiness adapter for Samco StockNote API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.samco.auth import AUTH_FLOW
from mcp_connectors.india.samco.errors import ERROR_MAP
from mcp_connectors.india.samco.fixtures import MOCK_FIXTURES
from mcp_connectors.india.samco.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class SamcoMCPProvider(Phase2BrokerProvider):
    provider_id = "samco"
    provider_name = "Samco StockNote API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["SAMCO_USER_ID", "SAMCO_API_KEY"]
    env_base_url_key: ClassVar[str] = "SAMCO_BASE_URL"
    env_allow_live_key: ClassVar[str] = "SAMCO_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/samco/profile",
        "margins": "/api/samco/margins",
        "holdings": "/api/samco/holdings",
        "positions": "/api/samco/positions",
        "orders": "/api/samco/orders",
        "trades": "/api/samco/trades",
        "quotes": "/api/samco/quotes",
        "preview": "/api/samco/orders/preview",
        "refresh": "/api/samco/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
