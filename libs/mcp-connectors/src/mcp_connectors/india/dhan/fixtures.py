"""Mock DhanHQ API responses for local/demo/tests — no real network."""

from __future__ import annotations

from typing import Any

MOCK_FIXTURES: dict[str, Any] = {
    "GET /v2/profile": {
        "dhanClientId": "1112656215",
        "tokenValidity": "2026-12-31 23:59:59",
        "activeSegment": "EQ, FNO, CURRENCY, COMMODITY",
        "ddpi": "Active",
        "mtf": "Active",
        "dataPlan": "Advanced",
    },
    "GET /v2/fundlimit": {
        "dhanClientId": "1112656215",
        "availabelBalance": 125000.0,
        "sodLimit": 150000.0,
        "collateralAmount": 10000.0,
        "receiveableAmount": 0.0,
        "utilizedAmount": 25000.0,
        "blockedPayoutAmount": 0.0,
        "withdrawableBalance": 100000.0,
    },
    "GET /v2/holdings": {
        "data": [
            {
                "tradingSymbol": "RELIANCE",
                "securityId": "2885",
                "isin": "INE002A01018",
                "exchange": "NSE",
                "totalQty": 10,
                "dpQty": 10,
                "t1Qty": 0,
                "availableQty": 10,
                "collateralQty": 0,
                "avgCostPrice": 2500.0,
                "lastTradedPrice": 2550.0,
            },
            {
                "tradingSymbol": "TCS",
                "securityId": "11536",
                "isin": "INE467B01029",
                "exchange": "NSE",
                "totalQty": 5,
                "dpQty": 5,
                "availableQty": 5,
                "avgCostPrice": 3600.0,
                "lastTradedPrice": 3650.0,
            },
        ]
    },
    "GET /v2/positions": {
        "data": [
            {
                "tradingSymbol": "NIFTY24JUL25000CE",
                "securityId": "12345",
                "exchangeSegment": "NSE_FNO",
                "productType": "INTRADAY",
                "positionType": "LONG",
                "buyQty": 50,
                "sellQty": 0,
                "netQty": 50,
                "costPrice": 120.5,
                "netPrice": 120.5,
                "realizedProfit": 0.0,
                "unrealizedProfit": 450.0,
                "lastTradedPrice": 129.5,
            }
        ]
    },
    "GET /v2/orders": {
        "data": [
            {
                "orderId": "1122334455",
                "exchangeOrderId": "110000001",
                "correlationId": "preview-rel-1",
                "orderStatus": "TRADED",
                "transactionType": "BUY",
                "exchangeSegment": "NSE_EQ",
                "productType": "CNC",
                "orderType": "MARKET",
                "tradingSymbol": "RELIANCE",
                "securityId": "2885",
                "quantity": 1,
                "filledQty": 1,
                "price": 0.0,
                "createTime": "2026-07-18 10:15:00",
                "updateTime": "2026-07-18 10:15:01",
            },
            {
                "orderId": "1122334466",
                "orderStatus": "PENDING",
                "transactionType": "SELL",
                "exchangeSegment": "NSE_EQ",
                "productType": "INTRADAY",
                "orderType": "LIMIT",
                "tradingSymbol": "TCS",
                "securityId": "11536",
                "quantity": 2,
                "filledQty": 0,
                "price": 3700.0,
                "createTime": "2026-07-19 09:20:00",
            },
        ]
    },
    "GET /v2/trades": {
        "data": [
            {
                "orderId": "1122334455",
                "exchangeOrderId": "110000001",
                "exchangeTradeId": "99001",
                "transactionType": "BUY",
                "exchangeSegment": "NSE_EQ",
                "productType": "CNC",
                "tradingSymbol": "RELIANCE",
                "securityId": "2885",
                "tradedQuantity": 1,
                "tradedPrice": 2548.5,
                "createTime": "2026-07-18 10:15:01",
            }
        ]
    },
    "GET /v2/marketfeed/ltp": {
        "data": {
            "NSE_EQ": {
                "2885": {"last_price": 2550.0},
                "11536": {"last_price": 3650.0},
            }
        }
    },
    "POST /v2/orders": {
        "orderId": "9988776655",
        "orderStatus": "TRANSIT",
        "correlationId": "golive-sim-1",
        "note": "Mock HTTP fixture for gated live simulation (not a real broker fill)",
    },
    "PUT /v2/orders": {
        "orderId": "9988776655",
        "orderStatus": "PENDING",
        "note": "Mock modify response",
    },
    "DELETE /v2/orders": {
        "orderId": "9988776655",
        "orderStatus": "CANCELLED",
        "note": "Mock cancel response",
    },
    "POST /v2/RenewToken": {
        "accessToken": "[REDACTED]",
        "expiryTime": "2026-12-31 23:59:59",
    },
}

# Security-id lookup used by quote placeholder (mock)
DHAN_SYMBOL_SECURITY_IDS: dict[str, str] = {
    "RELIANCE": "2885",
    "TCS": "11536",
    "INFY": "1594",
    "NIFTY": "13",
}
