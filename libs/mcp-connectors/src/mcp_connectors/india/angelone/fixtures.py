"""Sample mock fixtures for angelone — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /rest/secure/angelbroking/user/v1/getProfile": {
        "data": {
            "clientcode": "A12345",
            "name": "Demo",
            "exchanges": "NSE,BSE,NFO"
        }
    },
    "GET /rest/secure/angelbroking/user/v1/getRMS": {
        "data": {
            "availablecash": "120000.00",
            "utilisedpayout": "5000.00"
        }
    },
    "GET /rest/secure/angelbroking/portfolio/v1/getHolding": {
        "data": [
            {
                "tradingsymbol": "RELIANCE-EQ",
                "exchange": "NSE",
                "quantity": 8,
                "averageprice": 2500.0,
                "ltp": 2550.0
            }
        ]
    },
    "GET /rest/secure/angelbroking/order/v1/getPosition": {
        "data": []
    },
    "GET /rest/secure/angelbroking/order/v1/getOrderBook": {
        "data": []
    },
    "GET /rest/secure/angelbroking/order/v1/getTradeBook": {
        "data": []
    },
    "GET /rest/secure/angelbroking/market/v1/quote": {
        "data": {
            "fetched": [
                {
                    "symbol": "RELIANCE",
                    "ltp": 2550.0
                }
            ]
        }
    },
    "POST /rest/secure/angelbroking/order/v1/placeOrder": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /rest/auth/angelbroking/jwt/v1/generateTokens": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
