"""Sample mock fixtures for groww — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/groww/profile": {
        "client_id": "GROW0001",
        "name": "Demo",
        "provider": "groww"
    },
    "GET /api/groww/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/groww/holdings": {
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
    "GET /api/groww/positions": {
        "data": []
    },
    "GET /api/groww/orders": {
        "data": []
    },
    "GET /api/groww/trades": {
        "data": []
    },
    "GET /api/groww/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/groww/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/groww/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
