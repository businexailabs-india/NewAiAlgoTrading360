"""IIFLMCPProvider — Phase-2 readiness adapter for IIFL Trading API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.iifl.auth import AUTH_FLOW
from mcp_connectors.india.iifl.errors import ERROR_MAP
from mcp_connectors.india.iifl.fixtures import MOCK_FIXTURES
from mcp_connectors.india.iifl.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class IIFLMCPProvider(Phase2BrokerProvider):
    provider_id = "iifl"
    provider_name = "IIFL Trading API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["IIFL_APP_KEY", "IIFL_APP_SECRET"]
    env_base_url_key: ClassVar[str] = "IIFL_BASE_URL"
    env_allow_live_key: ClassVar[str] = "IIFL_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/iifl/profile",
        "margins": "/api/iifl/margins",
        "holdings": "/api/iifl/holdings",
        "positions": "/api/iifl/positions",
        "orders": "/api/iifl/orders",
        "trades": "/api/iifl/trades",
        "quotes": "/api/iifl/quotes",
        "preview": "/api/iifl/orders/preview",
        "refresh": "/api/iifl/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
