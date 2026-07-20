"""Mock fixtures for GlobalDataFeeds."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /md/globaldatafeeds/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0
            }
        }
    },
    "GET /md/globaldatafeeds/history": {
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
    "GET /md/globaldatafeeds/option-chain": {
        "symbol": "NIFTY",
        "chain": []
    },
    "POST /md/globaldatafeeds/session/refresh": {
        "status": "refreshed"
    },
    "GET /md/globaldatafeeds/profile": {
        "provider_id": "globaldatafeeds",
        "type": "market_data"
    },
    "GET /md/globaldatafeeds/margins": {
        "note": "market_data_provider_has_no_margins"
    },
    "GET /md/globaldatafeeds/holdings": {
        "data": []
    },
    "GET /md/globaldatafeeds/positions": {
        "data": []
    },
    "GET /md/globaldatafeeds/orders": {
        "data": []
    },
    "GET /md/globaldatafeeds/trades": {
        "data": []
    }
}
