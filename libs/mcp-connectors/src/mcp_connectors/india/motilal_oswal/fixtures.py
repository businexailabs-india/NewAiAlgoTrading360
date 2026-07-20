"""Sample mock fixtures for motilal_oswal — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/motilal_oswal/profile": {
        "client_id": "MOTI0001",
        "name": "Demo",
        "provider": "motilal_oswal"
    },
    "GET /api/motilal_oswal/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/motilal_oswal/holdings": {
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
    "GET /api/motilal_oswal/positions": {
        "data": []
    },
    "GET /api/motilal_oswal/orders": {
        "data": []
    },
    "GET /api/motilal_oswal/trades": {
        "data": []
    },
    "GET /api/motilal_oswal/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/motilal_oswal/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/motilal_oswal/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
