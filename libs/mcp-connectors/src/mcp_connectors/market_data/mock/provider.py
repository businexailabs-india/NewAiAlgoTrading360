"""MockMarketDataProvider — full deterministic market data for tests."""

from __future__ import annotations

from typing import Any

from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.market_data._shared import PlaceholderMarketDataProvider


class MockMarketDataProvider(PlaceholderMarketDataProvider):
    provider_id = "mock_market_data"
    provider_name = "Mock Market Data Provider"
    provider_type = "market_data"
    country = "IN"

    def __init__(self, config: ProviderConfig | None = None, **kwargs: Any):
        super().__init__(config=config, **kwargs)
        self._connected = True
        self._mode = "mock"

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        self._connected = True
        self._mode = "mock"
        return {"ok": True, "status": "connected", "mode": "mock", "provider_id": self.provider_id}

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {
            "quotes": {
                self.normalize_symbol(s): {
                    "ltp": 100.0 + (hash(s) % 50),
                    "bid": 99.5,
                    "ask": 100.5,
                    "volume": 100000,
                    "provider_id": self.provider_id,
                }
                for s in symbols
            }
        }

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        spot = 25000.0 if "NIFTY" in symbol.upper() else 100.0
        chain = []
        for i in range(-2, 3):
            strike = spot + i * 50
            chain.append(
                {
                    "strike": strike,
                    "ce": {"ltp": max(1.0, 20 - abs(i) * 5), "iv": 0.15, "delta": 0.5 - i * 0.1},
                    "pe": {"ltp": max(1.0, 20 - abs(i) * 5), "iv": 0.16, "delta": -0.5 + i * 0.1},
                }
            )
        return {"symbol": symbol, "expiry": expiry, "spot": spot, "chain": chain, "greeks": True}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        return [{"symbol": symbol, "timeframe": timeframe, "close": 100 + i, "volume": 1000 + i} for i in range(100)]

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        self._subscribed.update(symbols)
        return {
            "ok": True,
            "subscribed": list(self._subscribed),
            "ticks": [{"symbol": s, "ltp": 100.0, "ts": 0} for s in symbols],
        }
