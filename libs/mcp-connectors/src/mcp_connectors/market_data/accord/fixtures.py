"""Mock fixtures for Accord Fintech ACE Datafeed."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /md/accord/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0
            }
        }
    },
    "GET /md/accord/history": {
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
    "GET /md/accord/option-chain": {
        "symbol": "NIFTY",
        "chain": []
    },
    "POST /md/accord/session/refresh": {
        "status": "refreshed"
    },
    "GET /md/accord/profile": {
        "provider_id": "accord",
        "type": "market_data"
    },
    "GET /md/accord/margins": {
        "note": "market_data_provider_has_no_margins"
    },
    "GET /md/accord/holdings": {
        "data": []
    },
    "GET /md/accord/positions": {
        "data": []
    },
    "GET /md/accord/orders": {
        "data": []
    },
    "GET /md/accord/trades": {
        "data": []
    }
}
