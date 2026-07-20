"""MotilalOswalMCPProvider — Phase-2 readiness adapter for Motilal Oswal MO API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.motilal_oswal.auth import AUTH_FLOW
from mcp_connectors.india.motilal_oswal.errors import ERROR_MAP
from mcp_connectors.india.motilal_oswal.fixtures import MOCK_FIXTURES
from mcp_connectors.india.motilal_oswal.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class MotilalOswalMCPProvider(Phase2BrokerProvider):
    provider_id = "motilal_oswal"
    provider_name = "Motilal Oswal MO API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["MOTILAL_API_KEY", "MOTILAL_CLIENT_CODE"]
    env_base_url_key: ClassVar[str] = "MOTILAL_BASE_URL"
    env_allow_live_key: ClassVar[str] = "MOTILAL_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/motilal_oswal/profile",
        "margins": "/api/motilal_oswal/margins",
        "holdings": "/api/motilal_oswal/holdings",
        "positions": "/api/motilal_oswal/positions",
        "orders": "/api/motilal_oswal/orders",
        "trades": "/api/motilal_oswal/trades",
        "quotes": "/api/motilal_oswal/quotes",
        "preview": "/api/motilal_oswal/orders/preview",
        "refresh": "/api/motilal_oswal/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
