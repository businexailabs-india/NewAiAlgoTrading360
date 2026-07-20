"""Mock fixtures for Mock Market Data Provider."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /md/mock_market_data/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0
            }
        }
    },
    "GET /md/mock_market_data/history": {
        "data": [
            {
                "close": 100
            },
            {
                "close": 101
            },
            {
                "close": 102
            },
            {
                "close": 103
            },
            {
                "close": 104
            },
            {
                "close": 105
            },
            {
                "close": 106
            },
            {
                "close": 107
            },
            {
                "close": 108
            },
            {
                "close": 109
            }
        ]
    },
    "GET /md/mock_market_data/option-chain": {
        "symbol": "NIFTY",
        "chain": []
    },
    "POST /md/mock_market_data/session/refresh": {
        "status": "refreshed"
    },
    "GET /md/mock_market_data/profile": {
        "provider_id": "mock_market_data",
        "type": "market_data"
    },
    "GET /md/mock_market_data/margins": {
        "note": "market_data_provider_has_no_margins"
    },
    "GET /md/mock_market_data/holdings": {
        "data": []
    },
    "GET /md/mock_market_data/positions": {
        "data": []
    },
    "GET /md/mock_market_data/orders": {
        "data": []
    },
    "GET /md/mock_market_data/trades": {
        "data": []
    }
}
