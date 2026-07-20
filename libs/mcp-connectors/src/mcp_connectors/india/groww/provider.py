"""GrowwMCPProvider — Phase-2 readiness adapter for Groww API Placeholder."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.groww.auth import AUTH_FLOW
from mcp_connectors.india.groww.errors import ERROR_MAP
from mcp_connectors.india.groww.fixtures import MOCK_FIXTURES
from mcp_connectors.india.groww.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class GrowwMCPProvider(Phase2BrokerProvider):
    provider_id = "groww"
    provider_name = "Groww API Placeholder"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["GROWW_API_KEY_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "GROWW_BASE_URL"
    env_allow_live_key: ClassVar[str] = "GROWW_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/groww/profile",
        "margins": "/api/groww/margins",
        "holdings": "/api/groww/holdings",
        "positions": "/api/groww/positions",
        "orders": "/api/groww/orders",
        "trades": "/api/groww/trades",
        "quotes": "/api/groww/quotes",
        "preview": "/api/groww/orders/preview",
        "refresh": "/api/groww/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
