"""Sample mock fixtures for sharekhan — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/sharekhan/profile": {
        "client_id": "SHAR0001",
        "name": "Demo",
        "provider": "sharekhan"
    },
    "GET /api/sharekhan/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/sharekhan/holdings": {
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
    "GET /api/sharekhan/positions": {
        "data": []
    },
    "GET /api/sharekhan/orders": {
        "data": []
    },
    "GET /api/sharekhan/trades": {
        "data": []
    },
    "GET /api/sharekhan/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/sharekhan/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/sharekhan/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
