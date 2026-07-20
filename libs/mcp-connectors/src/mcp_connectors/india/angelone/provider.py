"""AngelOneMCPProvider — Phase-2 readiness adapter for Angel One SmartAPI."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.angelone.auth import AUTH_FLOW
from mcp_connectors.india.angelone.errors import ERROR_MAP
from mcp_connectors.india.angelone.fixtures import MOCK_FIXTURES
from mcp_connectors.india.angelone.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class AngelOneMCPProvider(Phase2BrokerProvider):
    provider_id = "angelone"
    provider_name = "Angel One SmartAPI"
    provider_type = "broker"
    country = "IN"
    symbol_style = "angelone"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["ANGELONE_API_KEY", "ANGELONE_CLIENT_CODE", "ANGELONE_TOTP_SECRET_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "ANGELONE_BASE_URL"
    env_allow_live_key: ClassVar[str] = "ANGELONE_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/rest/secure/angelbroking/user/v1/getProfile",
        "margins": "/rest/secure/angelbroking/user/v1/getRMS",
        "holdings": "/rest/secure/angelbroking/portfolio/v1/getHolding",
        "positions": "/rest/secure/angelbroking/order/v1/getPosition",
        "orders": "/rest/secure/angelbroking/order/v1/getOrderBook",
        "trades": "/rest/secure/angelbroking/order/v1/getTradeBook",
        "quotes": "/rest/secure/angelbroking/market/v1/quote",
        "preview": "/rest/secure/angelbroking/order/v1/placeOrder",
        "refresh": "/rest/auth/angelbroking/jwt/v1/generateTokens",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
