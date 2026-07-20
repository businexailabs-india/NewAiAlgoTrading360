"""Sample mock fixtures for paytm_money — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/paytm_money/profile": {
        "client_id": "PAYT0001",
        "name": "Demo",
        "provider": "paytm_money"
    },
    "GET /api/paytm_money/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/paytm_money/holdings": {
        "data": [
            {
                "symbol": "RELIANCE",
                "exchange": "NSE",
                "quantity": 2,
                "average_price": 2500.0,
                "last_price": 2550.0
            }
        ]
    },
    "GET /api/paytm_money/positions": {
        "data": []
    },
    "GET /api/paytm_money/orders": {
        "data": []
    },
    "GET /api/paytm_money/trades": {
        "data": []
    },
    "GET /api/paytm_money/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/paytm_money/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/paytm_money/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
