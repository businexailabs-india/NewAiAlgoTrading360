"""Sample mock fixtures for icici_breeze — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/icici_breeze/profile": {
        "client_id": "ICIC0001",
        "name": "Demo",
        "provider": "icici_breeze"
    },
    "GET /api/icici_breeze/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/icici_breeze/holdings": {
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
    "GET /api/icici_breeze/positions": {
        "data": []
    },
    "GET /api/icici_breeze/orders": {
        "data": []
    },
    "GET /api/icici_breeze/trades": {
        "data": []
    },
    "GET /api/icici_breeze/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/icici_breeze/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/icici_breeze/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
