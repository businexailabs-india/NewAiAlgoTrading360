"""Generate Phase-2 readiness modules for each Indian provider."""
from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[1]
INDIA = ROOT / "libs" / "mcp-connectors" / "src" / "mcp_connectors" / "india"
MD = ROOT / "libs" / "mcp-connectors" / "src" / "mcp_connectors" / "market_data"


def w(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dedent(content).lstrip("\n"), encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


BROKERS = [
    ("dhan", "DhanMCPProvider", "Dhan / DhanHQ", "API_KEY_TOKEN", "dhan",
     ["DHAN_CLIENT_ID", "DHAN_ACCESS_TOKEN", "DHAN_API_KEY_OPTIONAL"], "DHAN_BASE_URL", "DHAN_ALLOW_LIVE_HTTP", 10, 5),
    ("zerodha", "ZerodhaMCPProvider", "Zerodha Kite Connect", "OAUTH2", "kite",
     ["ZERODHA_API_KEY", "ZERODHA_API_SECRET", "ZERODHA_ACCESS_TOKEN_OPTIONAL"], "ZERODHA_BASE_URL", "ZERODHA_ALLOW_LIVE_HTTP", 8, 3),
    ("angelone", "AngelOneMCPProvider", "Angel One SmartAPI", "LOGIN_TOTP", "angelone",
     ["ANGELONE_API_KEY", "ANGELONE_CLIENT_CODE", "ANGELONE_TOTP_SECRET_OPTIONAL"], "ANGELONE_BASE_URL", "ANGELONE_ALLOW_LIVE_HTTP", 8, 3),
    ("upstox", "UpstoxMCPProvider", "Upstox API", "OAUTH2", "plain",
     ["UPSTOX_CLIENT_ID", "UPSTOX_CLIENT_SECRET", "UPSTOX_ACCESS_TOKEN_OPTIONAL"], "UPSTOX_BASE_URL", "UPSTOX_ALLOW_LIVE_HTTP", 10, 5),
    ("fyers", "FyersMCPProvider", "Fyers API", "OAUTH2", "plain",
     ["FYERS_APP_ID", "FYERS_APP_SECRET", "FYERS_ACCESS_TOKEN_OPTIONAL"], "FYERS_BASE_URL", "FYERS_ALLOW_LIVE_HTTP", 8, 3),
    ("icici_breeze", "ICICIBreezeMCPProvider", "ICICI Direct Breeze API", "SESSION_TOKEN", "plain",
     ["ICICI_BREEZE_API_KEY", "ICICI_BREEZE_API_SECRET", "ICICI_BREEZE_SESSION_TOKEN_OPTIONAL"], "ICICI_BREEZE_BASE_URL", "ICICI_BREEZE_ALLOW_LIVE_HTTP", 5, 2),
    ("kotak_neo", "KotakNeoMCPProvider", "Kotak Neo API", "OAUTH2", "plain",
     ["KOTAK_NEO_CONSUMER_KEY", "KOTAK_NEO_CONSUMER_SECRET"], "KOTAK_NEO_BASE_URL", "KOTAK_NEO_ALLOW_LIVE_HTTP", 5, 2),
    ("alice_blue", "AliceBlueMCPProvider", "Alice Blue API", "API_KEY_TOKEN", "plain",
     ["ALICE_BLUE_USER_ID", "ALICE_BLUE_API_KEY"], "ALICE_BLUE_BASE_URL", "ALICE_BLUE_ALLOW_LIVE_HTTP", 5, 2),
    ("finvasia_shoonya", "FinvasiaShoonyaMCPProvider", "Finvasia Shoonya API", "VENDOR_LOGIN", "plain",
     ["SHOONYA_USER_ID", "SHOONYA_VENDOR_CODE", "SHOONYA_API_SECRET"], "SHOONYA_BASE_URL", "SHOONYA_ALLOW_LIVE_HTTP", 8, 3),
    ("iifl", "IIFLMCPProvider", "IIFL Trading API", "API_KEY_TOKEN", "plain",
     ["IIFL_APP_KEY", "IIFL_APP_SECRET"], "IIFL_BASE_URL", "IIFL_ALLOW_LIVE_HTTP", 5, 2),
    ("motilal_oswal", "MotilalOswalMCPProvider", "Motilal Oswal MO API", "API_KEY_TOKEN", "plain",
     ["MOTILAL_API_KEY", "MOTILAL_CLIENT_CODE"], "MOTILAL_BASE_URL", "MOTILAL_ALLOW_LIVE_HTTP", 5, 2),
    ("hdfc_sky", "HDFCSkyMCPProvider", "HDFC Sky API", "API_KEY_TOKEN", "plain",
     ["HDFC_SKY_API_KEY", "HDFC_SKY_CLIENT_ID"], "HDFC_SKY_BASE_URL", "HDFC_SKY_ALLOW_LIVE_HTTP", 5, 2),
    ("groww", "GrowwMCPProvider", "Groww API Placeholder", "API_KEY_TOKEN", "plain",
     ["GROWW_API_KEY_OPTIONAL"], "GROWW_BASE_URL", "GROWW_ALLOW_LIVE_HTTP", 3, 1),
    ("paytm_money", "PaytmMoneyMCPProvider", "Paytm Money API Placeholder", "API_KEY_TOKEN", "plain",
     ["PAYTM_MONEY_API_KEY_OPTIONAL"], "PAYTM_MONEY_BASE_URL", "PAYTM_MONEY_ALLOW_LIVE_HTTP", 3, 1),
    ("samco", "SamcoMCPProvider", "Samco StockNote API", "LOGIN_TOTP", "plain",
     ["SAMCO_USER_ID", "SAMCO_API_KEY"], "SAMCO_BASE_URL", "SAMCO_ALLOW_LIVE_HTTP", 5, 2),
    ("sharekhan", "SharekhanMCPProvider", "Sharekhan API Placeholder", "API_KEY_TOKEN", "plain",
     ["SHAREKHAN_API_KEY_OPTIONAL"], "SHAREKHAN_BASE_URL", "SHAREKHAN_ALLOW_LIVE_HTTP", 3, 1),
]

PATHS = {
    "dhan": {
        "profile": "/v2/profile", "margins": "/v2/fundlimit", "holdings": "/v2/holdings",
        "positions": "/v2/positions", "orders": "/v2/orders", "trades": "/v2/trades",
        "quotes": "/v2/marketfeed/ltp", "preview": "/v2/orders", "refresh": "/v2/RenewToken",
    },
    "zerodha": {
        "profile": "/user/profile", "margins": "/user/margins", "holdings": "/portfolio/holdings",
        "positions": "/portfolio/positions", "orders": "/orders", "trades": "/trades",
        "quotes": "/quote", "preview": "/margins/orders", "refresh": "/session/token",
    },
    "angelone": {
        "profile": "/rest/secure/angelbroking/user/v1/getProfile",
        "margins": "/rest/secure/angelbroking/user/v1/getRMS",
        "holdings": "/rest/secure/angelbroking/portfolio/v1/getHolding",
        "positions": "/rest/secure/angelbroking/order/v1/getPosition",
        "orders": "/rest/secure/angelbroking/order/v1/getOrderBook",
        "trades": "/rest/secure/angelbroking/order/v1/getTradeBook",
        "quotes": "/rest/secure/angelbroking/market/v1/quote",
        "preview": "/rest/secure/angelbroking/order/v1/placeOrder",
        "refresh": "/rest/auth/angelbroking/jwt/v1/generateTokens",
    },
    "upstox": {
        "profile": "/v2/user/profile", "margins": "/v2/user/get-funds-and-margin",
        "holdings": "/v2/portfolio/long-term-holdings", "positions": "/v2/portfolio/short-term-positions",
        "orders": "/v2/order/retrieve-all", "trades": "/v2/order/trades/get-trades-for-day",
        "quotes": "/v2/market-quote/quotes", "preview": "/v2/order/place", "refresh": "/v2/login/authorization/token",
    },
}


def default_paths(pid: str) -> dict[str, str]:
    if pid in PATHS:
        return PATHS[pid]
    return {
        "profile": f"/api/{pid}/profile",
        "margins": f"/api/{pid}/margins",
        "holdings": f"/api/{pid}/holdings",
        "positions": f"/api/{pid}/positions",
        "orders": f"/api/{pid}/orders",
        "trades": f"/api/{pid}/trades",
        "quotes": f"/api/{pid}/quotes",
        "preview": f"/api/{pid}/orders/preview",
        "refresh": f"/api/{pid}/session/refresh",
    }


ERROR_MAPS = {
    "dhan": {"DH-901": "AUTH_FAILED", "DH-905": "TOKEN_EXPIRED", "429": "RATE_LIMITED", "DH-101": "INVALID_REQUEST"},
    "zerodha": {"TokenException": "TOKEN_EXPIRED", "InputException": "INVALID_REQUEST", "NetworkException": "UPSTREAM_UNAVAILABLE", "429": "RATE_LIMITED"},
    "angelone": {"AG8001": "AUTH_FAILED", "AB1007": "TOKEN_EXPIRED", "AB1000": "RATE_LIMITED", "AB1001": "INVALID_REQUEST"},
    "upstox": {"UDAPI100010": "AUTH_FAILED", "UDAPI100050": "RATE_LIMITED", "UDAPI100012": "INVALID_REQUEST"},
}


def sample_payloads(pid: str) -> dict[str, dict]:
    if pid == "zerodha":
        return {
            "profile": {"user_id": "AB1234", "user_name": "Demo", "email": "d***@example.com", "exchanges": ["NSE", "BSE"]},
            "margins": {"equity": {"available": {"live_balance": 150000.0}, "utilised": {"debits": 10000.0}}},
            "holdings": {"data": [{"tradingsymbol": "RELIANCE", "exchange": "NSE", "quantity": 5, "average_price": 2500.0, "last_price": 2550.0}]},
            "quotes": {"data": {"NSE:RELIANCE": {"last_price": 2550.0, "volume": 100000}}},
        }
    if pid == "angelone":
        return {
            "profile": {"data": {"clientcode": "A12345", "name": "Demo", "exchanges": "NSE,BSE,NFO"}},
            "margins": {"data": {"availablecash": "120000.00", "utilisedpayout": "5000.00"}},
            "holdings": {"data": [{"tradingsymbol": "RELIANCE-EQ", "exchange": "NSE", "quantity": 8, "averageprice": 2500.0, "ltp": 2550.0}]},
            "quotes": {"data": {"fetched": [{"symbol": "RELIANCE", "ltp": 2550.0}]}},
        }
    if pid == "upstox":
        return {
            "profile": {"data": {"user_id": "UP123", "user_name": "Demo", "exchanges": ["NSE", "BSE"]}},
            "margins": {"data": {"equity": {"available_margin": 110000.0, "used_margin": 8000.0}}},
            "holdings": {"data": [{"trading_symbol": "RELIANCE", "exchange": "NSE", "quantity": 4, "average_price": 2500.0, "last_price": 2550.0}]},
            "quotes": {"data": {"NSE_EQ|RELIANCE": {"last_price": 2550.0}}},
        }
    if pid == "dhan":
        return {
            "profile": {"dhanClientId": "1112656215", "tokenValidity": "2026-12-31", "activeSegment": "EQ, FNO, COMMODITY"},
            "margins": {"availabelBalance": 125000.0, "sodLimit": 150000.0, "utilizedAmount": 25000.0},
            "holdings": {"data": [{"tradingSymbol": "RELIANCE", "exchange": "NSE", "totalQty": 10, "avgCostPrice": 2500.0, "lastTradedPrice": 2550.0}]},
            "quotes": {"data": {"RELIANCE": {"ltp": 2550.0}}},
        }
    return {
        "profile": {"client_id": f"{pid.upper()[:4]}0001", "name": "Demo", "provider": pid},
        "margins": {"available": 100000.0, "utilized": 2500.0, "currency": "INR"},
        "holdings": {"data": [{"symbol": "RELIANCE", "exchange": "NSE", "quantity": 2, "average_price": 2500.0, "last_price": 2550.0}]},
        "quotes": {"data": {"RELIANCE": {"ltp": 2550.0, "bid": 2549.0, "ask": 2551.0}}},
    }


def write_fixtures(pid: str, paths: dict[str, str]) -> None:
    samples = sample_payloads(pid)
    fixtures = {
        f"GET {paths['profile']}": samples["profile"],
        f"GET {paths['margins']}": samples["margins"],
        f"GET {paths['holdings']}": samples["holdings"],
        f"GET {paths['positions']}": {"data": []},
        f"GET {paths['orders']}": {"data": []},
        f"GET {paths['trades']}": {"data": []},
        f"GET {paths['quotes']}": samples["quotes"],
        f"POST {paths['preview']}": {"status": "preview_ok", "margin": 5000.0},
        f"POST {paths['refresh']}": {"status": "refreshed", "expires_in": 86400},
    }
    body = (
        f'"""Sample mock fixtures for {pid} — used when live HTTP is disabled."""\n\n'
        "from __future__ import annotations\n\n"
        "from typing import Any\n\n"
        f"MOCK_FIXTURES: dict[str, Any] = {json.dumps(fixtures, indent=4)}\n"
    )
    w(INDIA / pid / "fixtures.py", body)


def stub_name(cls: str) -> str:
    return cls.replace("MCPProvider", "").replace("Provider", "")


def gen_broker(pid, cls, name, auth_flow, style, env_keys, base_url_key, allow_key, rps, ops):
    pkg = INDIA / pid
    paths = default_paths(pid)
    write_fixtures(pid, paths)
    err = ERROR_MAPS.get(pid, {"401": "AUTH_FAILED", "429": "RATE_LIMITED", "400": "INVALID_REQUEST"})
    err_literal = ",\n        ".join(f'"{k}": ProviderErrorCode.{v}' for k, v in err.items())
    env_list = ", ".join(f'"{k}"' for k in env_keys)
    paths_literal = ",\n            ".join(f'"{k}": "{v}"' for k, v in paths.items())
    prefix = stub_name(cls)

    w(pkg / "errors.py", f'''
    """Error mapping for {name}."""

    from __future__ import annotations

    from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

    ERROR_MAP: dict[str, ProviderErrorCode] = {{
        {err_literal},
    }}


    def map_error(raw_code: str | None = None, message: str = "", http_status: int | None = None):
        return map_provider_error(
            "{pid}",
            raw_code=raw_code,
            message=message,
            http_status=http_status,
            mapping=ERROR_MAP,
        )
    ''')

    w(pkg / "rate_limits.py", f'''
    """Rate-limit configuration for {name}."""

    from __future__ import annotations

    from mcp_connectors.base.rate_limits import RateLimitConfig

    RATE_LIMIT = RateLimitConfig(
        provider_id="{pid}",
        requests_per_second={rps},
        requests_per_minute={int(rps * 60 * 0.8)},
        orders_per_second={ops},
        orders_per_minute={int(ops * 60 * 0.5)},
        burst={max(10, rps * 2)},
        quote_batch_max=50,
        notes="Phase-2 conservative defaults — tune after broker certification",
    )
    ''')

    w(pkg / "auth.py", f'''
    """Auth refresh flow placeholders for {name}."""

    from __future__ import annotations

    from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh

    AUTH_FLOW = AuthFlowType.{auth_flow}


    async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False) -> AuthRefreshResult:
        return await placeholder_refresh(
            "{pid}",
            AUTH_FLOW,
            credentials_present=credentials_present,
            refresh_token_present=refresh_token_present,
        )
    ''')

    w(pkg / "dtos.py", f'''
    """Adapter-specific request/response DTOs for {name}."""

    from __future__ import annotations

    from typing import Any

    from pydantic import BaseModel, Field

    from mcp_connectors.base.dtos import (
        AccountProfileDTO,
        ConnectRequestDTO,
        ConnectResponseDTO,
        HistoricalRequestDTO,
        HoldingDTO,
        MarginsDTO,
        OrderPreviewRequestDTO,
        OrderPreviewResponseDTO,
        QuoteRequestDTO,
        QuoteResponseDTO,
    )


    class {prefix}ConnectRequest(ConnectRequestDTO):
        """Connect payload for {pid}."""


    class {prefix}OrderStub(BaseModel):
        """Broker-native order payload stub (not executed in Phase 2)."""

        exchange: str = "NSE"
        symbol: str
        transaction_type: str = "BUY"
        quantity: int
        order_type: str = "MARKET"
        product: str = "CNC"
        price: float | None = None
        trigger_price: float | None = None
        validity: str = "DAY"
        tag: str | None = None
        extras: dict[str, Any] = Field(default_factory=dict)
    ''')

    if pid == "dhan":
        return

    w(pkg / "provider.py", f'''
    """{cls} — Phase-2 readiness adapter for {name}."""

    from __future__ import annotations

    from typing import Any, ClassVar

    from mcp_connectors.base.auth_refresh import AuthFlowType
    from mcp_connectors.base.errors import ProviderErrorCode
    from mcp_connectors.base.models import ProviderConfig
    from mcp_connectors.india.{pid}.auth import AUTH_FLOW
    from mcp_connectors.india.{pid}.errors import ERROR_MAP
    from mcp_connectors.india.{pid}.fixtures import MOCK_FIXTURES
    from mcp_connectors.india.{pid}.rate_limits import RATE_LIMIT
    from mcp_connectors.india.phase2 import Phase2BrokerProvider


    class {cls}(Phase2BrokerProvider):
        provider_id = "{pid}"
        provider_name = "{name}"
        provider_type = "broker"
        country = "IN"
        symbol_style = "{style}"
        auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
        env_credential_keys: ClassVar[list[str]] = [{env_list}]
        env_base_url_key: ClassVar[str] = "{base_url_key}"
        env_allow_live_key: ClassVar[str] = "{allow_key}"
        error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
        rate_limit = RATE_LIMIT
        mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
        api_paths: ClassVar[dict[str, str]] = {{
            {paths_literal},
        }}

        def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
            super().__init__(config=config, **kwargs)
    ''')

    w(pkg / "__init__.py", f'''
    from mcp_connectors.india.{pid}.provider import {cls}

    __all__ = ["{cls}"]
    ''')


def gen_sim_sidecars(folder: str, pid: str):
    pkg = INDIA / folder
    w(pkg / "errors.py", f'''
    from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

    ERROR_MAP = {{"REJECT": ProviderErrorCode.ORDER_REJECTED, "429": ProviderErrorCode.RATE_LIMITED}}


    def map_error(raw_code=None, message="", http_status=None):
        return map_provider_error("{pid}", raw_code=raw_code, message=message, http_status=http_status, mapping=ERROR_MAP)
    ''')
    w(pkg / "rate_limits.py", f'''
    from mcp_connectors.base.rate_limits import RateLimitConfig

    RATE_LIMIT = RateLimitConfig(
        provider_id="{pid}",
        requests_per_second=50,
        orders_per_second=20,
        burst=100,
        notes="simulated provider",
    )
    ''')
    w(pkg / "auth.py", f'''
    from mcp_connectors.base.auth_refresh import AuthFlowType, placeholder_refresh

    AUTH_FLOW = AuthFlowType.NONE


    async def refresh_auth(credentials_present: bool = True, refresh_token_present: bool = False):
        return await placeholder_refresh("{pid}", AUTH_FLOW, credentials_present=True)
    ''')
    w(pkg / "fixtures.py", f'''
    MOCK_FIXTURES = {{"GET /sim/{pid}/profile": {{"client_id": "{pid}", "mode": "sim"}}}}
    ''')
    w(pkg / "dtos.py", '''
    from mcp_connectors.base.dtos import (  # noqa: F401
        AccountProfileDTO,
        ConnectRequestDTO,
        MarginsDTO,
        OrderPreviewRequestDTO,
        QuoteResponseDTO,
    )
    ''')


MARKET = [
    ("truedata", "truedata", "TrueDataProvider", "TrueData Market Data", ["TRUEDATA_API_KEY"], "TRUEDATA_BASE_URL", "TRUEDATA_ALLOW_LIVE_HTTP"),
    ("globaldatafeeds", "globaldatafeeds", "GlobalDataFeedsProvider", "GlobalDataFeeds", ["GLOBALDATAFEEDS_API_KEY"], "GLOBALDATAFEEDS_BASE_URL", "GLOBALDATAFEEDS_ALLOW_LIVE_HTTP"),
    ("accord", "accord", "AccordProvider", "Accord Fintech ACE Datafeed", ["ACCORD_API_KEY_OPTIONAL"], "ACCORD_BASE_URL", "ACCORD_ALLOW_LIVE_HTTP"),
    ("bse_direct_placeholder", "bse_direct", "BSEDirectProvider", "BSE Direct Market Data Placeholder", ["BSE_CONTRACT_ID_OPTIONAL"], "BSE_DIRECT_BASE_URL", "BSE_DIRECT_ALLOW_LIVE_HTTP"),
    ("nse_direct_placeholder", "nse_direct", "NSEDirectProvider", "NSE Direct Market Data Placeholder", ["NSE_CONTRACT_ID_OPTIONAL"], "NSE_DIRECT_BASE_URL", "NSE_DIRECT_ALLOW_LIVE_HTTP"),
]


def gen_md(folder, pid, cls, name, env_keys, base_url, allow, rewrite_provider=True):
    pkg = MD / folder
    env_list = ", ".join(f'"{k}"' for k in env_keys)
    fixtures = {
        f"GET /md/{pid}/quotes": {"data": {"RELIANCE": {"ltp": 2550.0}}},
        f"GET /md/{pid}/history": {"data": [{"close": 100 + i} for i in range(10)]},
        f"GET /md/{pid}/option-chain": {"symbol": "NIFTY", "chain": []},
        f"POST /md/{pid}/session/refresh": {"status": "refreshed"},
        f"GET /md/{pid}/profile": {"provider_id": pid, "type": "market_data"},
        f"GET /md/{pid}/margins": {"note": "market_data_provider_has_no_margins"},
        f"GET /md/{pid}/holdings": {"data": []},
        f"GET /md/{pid}/positions": {"data": []},
        f"GET /md/{pid}/orders": {"data": []},
        f"GET /md/{pid}/trades": {"data": []},
    }
    w(pkg / "fixtures.py", (
        f'"""Mock fixtures for {name}."""\n\n'
        "from __future__ import annotations\n\nfrom typing import Any\n\n"
        f"MOCK_FIXTURES: dict[str, Any] = {json.dumps(fixtures, indent=4)}\n"
    ))
    w(pkg / "errors.py", f'''
    from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

    ERROR_MAP = {{"401": ProviderErrorCode.AUTH_FAILED, "429": ProviderErrorCode.RATE_LIMITED}}


    def map_error(raw_code=None, message="", http_status=None):
        return map_provider_error("{pid}", raw_code=raw_code, message=message, http_status=http_status, mapping=ERROR_MAP)
    ''')
    w(pkg / "rate_limits.py", f'''
    from mcp_connectors.base.rate_limits import RateLimitConfig

    RATE_LIMIT = RateLimitConfig(
        provider_id="{pid}",
        requests_per_second=20,
        requests_per_minute=600,
        orders_per_second=0,
        orders_per_minute=0,
        burst=40,
        quote_batch_max=100,
        websocket_subscriptions_max=500,
        notes="market data phase-2 defaults",
    )
    ''')
    w(pkg / "auth.py", f'''
    from mcp_connectors.base.auth_refresh import AuthFlowType, placeholder_refresh

    AUTH_FLOW = AuthFlowType.API_KEY_TOKEN


    async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False):
        return await placeholder_refresh("{pid}", AUTH_FLOW, credentials_present=credentials_present)
    ''')
    w(pkg / "dtos.py", '''
    from mcp_connectors.base.dtos import HistoricalRequestDTO, QuoteRequestDTO, QuoteResponseDTO
    ''')
    if not rewrite_provider:
        return
    w(pkg / "provider.py", f'''
    """{cls} — Phase-2 market data readiness adapter."""

    from __future__ import annotations

    from typing import Any, ClassVar

    from mcp_connectors.base.auth_refresh import AuthFlowType
    from mcp_connectors.base.errors import ProviderErrorCode
    from mcp_connectors.base.models import ProviderConfig
    from mcp_connectors.base.rate_limits import RateLimitConfig
    from mcp_connectors.india.phase2 import Phase2BrokerProvider
    from mcp_connectors.market_data.{folder}.auth import AUTH_FLOW
    from mcp_connectors.market_data.{folder}.errors import ERROR_MAP
    from mcp_connectors.market_data.{folder}.fixtures import MOCK_FIXTURES
    from mcp_connectors.market_data.{folder}.rate_limits import RATE_LIMIT


    class {cls}(Phase2BrokerProvider):
        provider_id = "{pid}"
        provider_name = "{name}"
        provider_type = "market_data"
        country = "IN"
        auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
        env_credential_keys: ClassVar[list[str]] = [{env_list}]
        env_base_url_key: ClassVar[str] = "{base_url}"
        env_allow_live_key: ClassVar[str] = "{allow}"
        error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
        rate_limit: ClassVar[RateLimitConfig] = RATE_LIMIT
        mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
        api_paths: ClassVar[dict[str, str]] = {{
            "profile": "/md/{pid}/profile",
            "margins": "/md/{pid}/margins",
            "holdings": "/md/{pid}/holdings",
            "positions": "/md/{pid}/positions",
            "orders": "/md/{pid}/orders",
            "trades": "/md/{pid}/trades",
            "quotes": "/md/{pid}/quotes",
            "preview": "/md/{pid}/preview",
            "refresh": "/md/{pid}/session/refresh",
        }}

        def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
            super().__init__(config=config, **kwargs)

        async def preview_order(self, order_request):
            return {{
                "preview": False,
                "accepted": False,
                "reason": "market_data_provider",
                "provider_id": self.provider_id,
            }}
    ''')
    w(pkg / "__init__.py", f'''
    from mcp_connectors.market_data.{folder}.provider import {cls}

    __all__ = ["{cls}"]
    ''')


def main():
    for row in BROKERS:
        gen_broker(*row)
    gen_sim_sidecars("paper_trading", "paper_trading")
    gen_sim_sidecars("mock", "mock_trading")
    for row in MARKET:
        gen_md(*row, rewrite_provider=True)
    gen_md("mock", "mock_market_data", "MockMarketDataProvider", "Mock Market Data Provider", [], "MOCK_MD_BASE_URL", "MOCK_MD_ALLOW_LIVE_HTTP", rewrite_provider=False)
    print("done")


if __name__ == "__main__":
    main()
