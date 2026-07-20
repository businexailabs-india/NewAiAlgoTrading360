"""Mock fixtures for BSE Direct Market Data Placeholder."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /md/bse_direct/quotes": {
        "data": {
            "RELIANCE": {
                "ltp": 2550.0
            }
        }
    },
    "GET /md/bse_direct/history": {
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
    "GET /md/bse_direct/option-chain": {
        "symbol": "NIFTY",
        "chain": []
    },
    "POST /md/bse_direct/session/refresh": {
        "status": "refreshed"
    },
    "GET /md/bse_direct/profile": {
        "provider_id": "bse_direct",
        "type": "market_data"
    },
    "GET /md/bse_direct/margins": {
        "note": "market_data_provider_has_no_margins"
    },
    "GET /md/bse_direct/holdings": {
        "data": []
    },
    "GET /md/bse_direct/positions": {
        "data": []
    },
    "GET /md/bse_direct/orders": {
        "data": []
    },
    "GET /md/bse_direct/trades": {
        "data": []
    }
}
