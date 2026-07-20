"""PaytmMoneyMCPProvider — Phase-2 readiness adapter for Paytm Money API Placeholder."""

from __future__ import annotations

from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.india.paytm_money.auth import AUTH_FLOW
from mcp_connectors.india.paytm_money.errors import ERROR_MAP
from mcp_connectors.india.paytm_money.fixtures import MOCK_FIXTURES
from mcp_connectors.india.paytm_money.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class PaytmMoneyMCPProvider(Phase2BrokerProvider):
    provider_id = "paytm_money"
    provider_name = "Paytm Money API Placeholder"
    provider_type = "broker"
    country = "IN"
    symbol_style = "plain"
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = ["PAYTM_MONEY_API_KEY_OPTIONAL"]
    env_base_url_key: ClassVar[str] = "PAYTM_MONEY_BASE_URL"
    env_allow_live_key: ClassVar[str] = "PAYTM_MONEY_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/api/paytm_money/profile",
        "margins": "/api/paytm_money/margins",
        "holdings": "/api/paytm_money/holdings",
        "positions": "/api/paytm_money/positions",
        "orders": "/api/paytm_money/orders",
        "trades": "/api/paytm_money/trades",
        "quotes": "/api/paytm_money/quotes",
        "preview": "/api/paytm_money/orders/preview",
        "refresh": "/api/paytm_money/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
