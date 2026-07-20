"""Mock fixtures for TrueData Market Data."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /md/truedata/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0
            }
        }
    },
    "GET /md/truedata/history": {
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
    "GET /md/truedata/option-chain": {
        "symbol": "NIFTY",
        "chain": []
    },
    "POST /md/truedata/session/refresh": {
        "status": "refreshed"
    },
    "GET /md/truedata/profile": {
        "provider_id": "truedata",
        "type": "market_data"
    },
    "GET /md/truedata/margins": {
        "note": "market_data_provider_has_no_margins"
    },
    "GET /md/truedata/holdings": {
        "data": []
    },
    "GET /md/truedata/positions": {
        "data": []
    },
    "GET /md/truedata/orders": {
        "data": []
    },
    "GET /md/truedata/trades": {
        "data": []
    }
}
