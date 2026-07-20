"""Sample mock fixtures for hdfc_sky — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/hdfc_sky/profile": {
        "client_id": "HDFC0001",
        "name": "Demo",
        "provider": "hdfc_sky"
    },
    "GET /api/hdfc_sky/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/hdfc_sky/holdings": {
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
    "GET /api/hdfc_sky/positions": {
        "data": []
    },
    "GET /api/hdfc_sky/orders": {
        "data": []
    },
    "GET /api/hdfc_sky/trades": {
        "data": []
    },
    "GET /api/hdfc_sky/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/hdfc_sky/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/hdfc_sky/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
