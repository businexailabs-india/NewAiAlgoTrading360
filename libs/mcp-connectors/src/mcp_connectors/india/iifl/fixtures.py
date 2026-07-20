"""Sample mock fixtures for iifl — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/iifl/profile": {
        "client_id": "IIFL0001",
        "name": "Demo",
        "provider": "iifl"
    },
    "GET /api/iifl/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/iifl/holdings": {
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
    "GET /api/iifl/positions": {
        "data": []
    },
    "GET /api/iifl/orders": {
        "data": []
    },
    "GET /api/iifl/trades": {
        "data": []
    },
    "GET /api/iifl/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/iifl/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/iifl/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
