"""Sample mock fixtures for upstox — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /v2/user/profile": {
        "data": {
            "user_id": "UP123",
            "user_name": "Demo",
            "exchanges": [
                "NSE",
                "BSE"
            ]
        }
    },
    "GET /v2/user/get-funds-and-margin": {
        "data": {
            "equity": {
                "available_margin": 110000.0,
                "used_margin": 8000.0
            }
        }
    },
    "GET /v2/portfolio/long-term-holdings": {
        "data": [
            {
                "trading_symbol": "RELIANCE",
                "exchange": "NSE",
                "quantity": 4,
                "average_price": 2500.0,
                "last_price": 2550.0
            }
        ]
    },
    "GET /v2/portfolio/short-term-positions": {
        "data": []
    },
    "GET /v2/order/retrieve-all": {
        "data": []
    },
    "GET /v2/order/trades/get-trades-for-day": {
        "data": []
    },
    "GET /v2/market-quote/quotes": {
        "data": {
            "NSE_EQ|RELIANCE": {
                "last_price": 2550.0
            }
        }
    },
    "POST /v2/order/place": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /v2/login/authorization/token": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
