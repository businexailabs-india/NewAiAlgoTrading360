"""Sample mock fixtures for zerodha — used when live HTTP is disabled."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /user/profile": {
        "user_id": "AB1234",
        "user_name": "Demo",
        "email": "d***@example.com",
        "exchanges": [
            "NSE",
            "BSE"
        ]
    },
    "GET /user/margins": {
        "equity": {
            "available": {
                "live_balance": 150000.0
            },
            "utilised": {
                "debits": 10000.0
            }
        }
    },
    "GET /portfolio/holdings": {
        "data": [
            {
                "tradingsymbol": "RELIANCE",
                "exchange": "NSE",
                "quantity": 5,
                "average_price": 2500.0,
                "last_price": 2550.0
            }
        ]
    },
    "GET /portfolio/positions": {
        "data": []
    },
    "GET /orders": {
        "data": []
    },
    "GET /trades": {
        "data": []
    },
    "GET /quote": {
        "data": {
            "NSE:RELIANCE": {
                "last_price": 2550.0,
                "volume": 100000
            }
        }
    },
    "POST /margins/orders": {
        "status": "preview_ok",
        "margin": 5000.0
    },
    "POST /session/token": {
        "status": "refreshed",
        "expires_in": 86400
    }
}
