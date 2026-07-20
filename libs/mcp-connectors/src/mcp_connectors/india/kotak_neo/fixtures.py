"""Sample mock fixtures for kotak_neo — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/kotak_neo/profile": {
        "client_id": "KOTA0001",
        "name": "Demo",
        "provider": "kotak_neo"
    },
    "GET /api/kotak_neo/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/kotak_neo/holdings": {
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
    "GET /api/kotak_neo/positions": {
        "data": []
    },
    "GET /api/kotak_neo/orders": {
        "data": []
    },
    "GET /api/kotak_neo/trades": {
        "data": []
    },
    "GET /api/kotak_neo/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/kotak_neo/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/kotak_neo/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
