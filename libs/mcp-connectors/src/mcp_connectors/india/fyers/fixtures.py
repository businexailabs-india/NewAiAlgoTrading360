"""Sample mock fixtures for fyers — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/fyers/profile": {
        "client_id": "FYER0001",
        "name": "Demo",
        "provider": "fyers"
    },
    "GET /api/fyers/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/fyers/holdings": {
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
    "GET /api/fyers/positions": {
        "data": []
    },
    "GET /api/fyers/orders": {
        "data": []
    },
    "GET /api/fyers/trades": {
        "data": []
    },
    "GET /api/fyers/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/fyers/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/fyers/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
