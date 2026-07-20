"""Mock fixtures for NSE Direct Market Data Placeholder."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /md/nse_direct/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0
            }
        }
    },
    "GET /md/nse_direct/history": {
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
    "GET /md/nse_direct/option-chain": {
        "symbol": "NIFTY",
        "chain": []
    },
    "POST /md/nse_direct/session/refresh": {
        "status": "refreshed"
    },
    "GET /md/nse_direct/profile": {
        "provider_id": "nse_direct",
        "type": "market_data"
    },
    "GET /md/nse_direct/margins": {
        "note": "market_data_provider_has_no_margins"
    },
    "GET /md/nse_direct/holdings": {
        "data": []
    },
    "GET /md/nse_direct/positions": {
        "data": []
    },
    "GET /md/nse_direct/orders": {
        "data": []
    },
    "GET /md/nse_direct/trades": {
        "data": []
    }
}
