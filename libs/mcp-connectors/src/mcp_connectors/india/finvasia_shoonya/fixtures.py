"""Sample mock fixtures for finvasia_shoonya — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /api/finvasia_shoonya/profile": {
        "client_id": "FINV0001",
        "name": "Demo",
        "provider": "finvasia_shoonya"
    },
    "GET /api/finvasia_shoonya/margins": {
        "available": 100000.0,
        "utilized": 2500.0,
        "currency": "INR"
    },
    "GET /api/finvasia_shoonya/holdings": {
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
    "GET /api/finvasia_shoonya/positions": {
        "data": []
    },
    "GET /api/finvasia_shoonya/orders": {
        "data": []
    },
    "GET /api/finvasia_shoonya/trades": {
        "data": []
    },
    "GET /api/finvasia_shoonya/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0,
                "bid": 2549.0,
                "ask": 2551.0
            }
        }
    },
    "POST /api/finvasia_shoonya/orders/preview": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /api/finvasia_shoonya/session/refresh": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
