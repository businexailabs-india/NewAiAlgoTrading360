"""SYNTHETIC candle generator for tests and demos ONLY.

Output is random data. Any backtest on it says nothing about real-market profitability and must never be
presented as evidence. Real validation requires actual exchange/broker historical data.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

import numpy as np
import pandas as pd

from tradex_bots.timeutil import IST

BARS_PER_DAY = 75


def synth_candles(
    symbol: str, days: int, *, start_day: date = date(2025, 1, 6), price0: float = 500.0, seed: int = 1,
    drift: float = 0.0, vol: float = 0.0015, base_volume: float = 60_000.0, gap_sd: float = 0.002,
    vol_spike_prob: float = 0.06,
) -> pd.DataFrame:
    rng = np.random.RandomState(seed)
    rows = []
    price = price0
    d = start_day
    n_days = 0
    while n_days < days:
        if d.weekday() < 5:
            price *= 1 + rng.normal(0, gap_sd)
            t0 = datetime.combine(d, time(9, 15), tzinfo=IST)
            for k in range(BARS_PER_DAY):
                o = price
                r = rng.normal(drift, vol)
                c = o * (1 + r)
                wick = abs(rng.normal(0, vol * 0.6))
                h = max(o, c) * (1 + wick)
                l = min(o, c) * (1 - abs(rng.normal(0, vol * 0.6)))
                u = 1.6 if k < 6 or k > 68 else 1.0
                v = base_volume * u * float(np.exp(rng.normal(0, 0.35)))
                if rng.rand() < vol_spike_prob:
                    v *= rng.uniform(1.5, 3.0)
                rows.append({"symbol": symbol, "start": t0 + timedelta(minutes=5 * k), "open": round(o, 2),
                             "high": round(h, 2), "low": round(l, 2), "close": round(c, 2),
                             "volume": float(int(v)), "turnover": np.nan})
                price = c
            n_days += 1
        d += timedelta(days=1)
    df = pd.DataFrame(rows)
    df["start"] = pd.to_datetime(df["start"])
    # keep OHLC valid after rounding
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"] = df[["open", "low", "close"]].min(axis=1)
    return df
