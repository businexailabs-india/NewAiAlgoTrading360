"""KotakNeoMCPProvider — Phase-2 readiness adapter for Kotak Neo API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.kotak_neo.auth import AUTH_FLOW
from mcp_connectors.india.kotak_neo.errors import ERROR_MAP
from mcp_connectors.india.kotak_neo.fixtures import MOCK_FIXTURES
from mcp_connectors.india.kotak_neo.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class KotakNeoMCPProvider(Phase2BrokerProvider):
    provider_id = "kotak_neo"
    provider_name = "Kotak Neo API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["KOTAK_NEO_CONSUMER_KEY", "KOTAK_NEO_CONSUMER_SECRET"]
    env_base_url_key: ClassVar[str] = "KOTAK_NEO_BASE_URL"
    env_allow_live_key: ClassVar[str] = "KOTAK_NEO_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/kotak_neo/profile",
        "margins": "/api/kotak_neo/margins",
        "holdings": "/api/kotak_neo/holdings",
        "positions": "/api/kotak_neo/positions",
        "orders": "/api/kotak_neo/orders",
        "trades": "/api/kotak_neo/trades",
        "quotes": "/api/kotak_neo/quotes",
        "preview": "/api/kotak_neo/orders/preview",
        "refresh": "/api/kotak_neo/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
