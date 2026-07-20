"""Sample mock fixtures for alice_blue — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/alice_blue/profile": {
        "client_id": "ALIC0001",
        "name": "Demo",
        "provider": "alice_blue"
    },
    "GET /api/alice_blue/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/alice_blue/holdings": {
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
    "GET /api/alice_blue/positions": {
        "data": []
    },
    "GET /api/alice_blue/orders": {
        "data": []
    },
    "GET /api/alice_blue/trades": {
        "data": []
    },
    "GET /api/alice_blue/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/alice_blue/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/alice_blue/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
