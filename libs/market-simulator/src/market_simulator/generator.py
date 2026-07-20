"""Mock OHLC generator for Indian sample symbols and market regimes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

import numpy as np

from schemas.market import Candle, MarketQuote, MarketRegime

SAMPLE_SYMBOLS = [
    "RELIANCE",
    "TCS",
    "HDFCBANK",
    "ICICIBANK",
    "INFY",
    "SBIN",
    "NIFTY",
    "BANKNIFTY",
]

_BASE_PRICES = {
    "RELIANCE": 2550.0,
    "TCS": 3800.0,
    "HDFCBANK": 1650.0,
    "ICICIBANK": 1100.0,
    "INFY": 1550.0,
    "SBIN": 780.0,
    "NIFTY": 24500.0,
    "BANKNIFTY": 52000.0,
}

_TF_MINUTES = {"1m": 1, "5m": 5, "15m": 15, "1d": 1440}


class MockMarketDataFeed:
    def __init__(self, seed: int = 42):
        self._rng = np.random.default_rng(seed)
        self._cache: dict[tuple[str, str, str], list[Candle]] = {}

    def generate_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        n: int = 200,
        regime: MarketRegime | str = MarketRegime.TRENDING,
        start: datetime | None = None,
    ) -> list[Candle]:
        symbol = symbol.upper()
        if symbol not in SAMPLE_SYMBOLS:
            raise ValueError(f"Unsupported symbol {symbol}. Use one of {SAMPLE_SYMBOLS}")
        if timeframe not in _TF_MINUTES:
            raise ValueError(f"Unsupported timeframe {timeframe}")
        regime_e = MarketRegime(regime) if isinstance(regime, str) else regime
        key = (symbol, timeframe, regime_e.value, str(n))
        if key in self._cache:
            return list(self._cache[key])

        minutes = _TF_MINUTES[timeframe]
        start = start or datetime(2026, 1, 2, 9, 15, tzinfo=timezone.utc)
        price = float(_BASE_PRICES[symbol])
        candles: list[Candle] = []

        for i in range(n):
            drift, vol = self._regime_params(regime_e, i, n)
            ret = float(self._rng.normal(drift, vol))
            if regime_e == MarketRegime.GAP_UP and i == 0:
                ret += 0.02
            if regime_e == MarketRegime.GAP_DOWN and i == 0:
                ret -= 0.02
            o = price
            c = max(0.01, o * (1 + ret))
            wick = abs(float(self._rng.normal(0, vol)))
            h = max(o, c) * (1 + wick)
            l = min(o, c) * (1 - wick)
            vol_qty = float(abs(self._rng.normal(1_000_000, 200_000)))
            ts = start + timedelta(minutes=minutes * i)
            candles.append(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    ts=ts,
                    open=round(o, 2),
                    high=round(h, 2),
                    low=round(l, 2),
                    close=round(c, 2),
                    volume=round(vol_qty, 0),
                    regime=regime_e,
                )
            )
            price = c

        self._cache[key] = candles
        return list(candles)

    def _regime_params(self, regime: MarketRegime, i: int, n: int) -> tuple[float, float]:
        if regime == MarketRegime.TRENDING:
            return (0.0008, 0.004)
        if regime == MarketRegime.SIDEWAYS:
            return (0.00005 * ((-1) ** i), 0.002)
        if regime == MarketRegime.VOLATILE:
            return (0.0002, 0.012)
        if regime == MarketRegime.GAP_UP:
            return (0.0004, 0.005)
        if regime == MarketRegime.GAP_DOWN:
            return (-0.0004, 0.005)
        return (0.0002, 0.005)

    def get_quote(self, symbol: str, stale: bool = False) -> MarketQuote:
        candles = self.generate_candles(symbol, "5m", n=50, regime=MarketRegime.TRENDING)
        last = candles[-1]
        return MarketQuote(
            symbol=symbol.upper(),
            ltp=last.close,
            bid=round(last.close * 0.999, 2),
            ask=round(last.close * 1.001, 2),
            volume=last.volume,
            ts=last.ts,
            stale=stale,
        )

    def replay(
        self,
        symbols: Iterable[str] | None = None,
        timeframe: str = "5m",
        regime: MarketRegime | str = MarketRegime.TRENDING,
        n: int = 100,
    ) -> dict[str, list[Candle]]:
        out: dict[str, list[Candle]] = {}
        for s in symbols or SAMPLE_SYMBOLS:
            out[s.upper()] = self.generate_candles(s, timeframe, n=n, regime=regime)
        return out
