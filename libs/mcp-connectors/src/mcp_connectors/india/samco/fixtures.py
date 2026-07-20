"""Sample mock fixtures for samco — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/samco/profile": {
        "client_id": "SAMC0001",
        "name": "Demo",
        "provider": "samco"
    },
    "GET /api/samco/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/samco/holdings": {
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
    "GET /api/samco/positions": {
        "data": []
    },
    "GET /api/samco/orders": {
        "data": []
    },
    "GET /api/samco/trades": {
        "data": []
    },
    "GET /api/samco/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/samco/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/samco/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
