"""AliceBlueMCPProvider — Phase-2 readiness adapter for Alice Blue API."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.alice_blue.auth import AUTH_FLOW
from mcp_connectors.india.alice_blue.errors import ERROR_MAP
from mcp_connectors.india.alice_blue.fixtures import MOCK_FIXTURES
from mcp_connectors.india.alice_blue.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class AliceBlueMCPProvider(Phase2BrokerProvider):
    provider_id = "alice_blue"
    provider_name = "Alice Blue API"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["ALICE_BLUE_USER_ID", "ALICE_BLUE_API_KEY"]
    env_base_url_key: ClassVar[str] = "ALICE_BLUE_BASE_URL"
    env_allow_live_key: ClassVar[str] = "ALICE_BLUE_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/alice_blue/profile",
        "margins": "/api/alice_blue/margins",
        "holdings": "/api/alice_blue/holdings",
        "positions": "/api/alice_blue/positions",
        "orders": "/api/alice_blue/orders",
        "trades": "/api/alice_blue/trades",
        "quotes": "/api/alice_blue/quotes",
        "preview": "/api/alice_blue/orders/preview",
        "refresh": "/api/alice_blue/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
