"""Simple signal generators for MVP paper tests."""

from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd

from schemas.market import Candle

Signal = Literal["BUY", "SELL", "HOLD"]


def candles_to_df(candles: list[Candle]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "ts": c.ts,
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
                "volume": c.volume,
            }
            for c in candles
        ]
    )


def ma_crossover_signals(df: pd.DataFrame, short: int = 9, long: int = 21) -> list[Signal]:
    s = df["close"].rolling(short).mean()
    l = df["close"].rolling(long).mean()
    out: list[Signal] = []
    for i in range(len(df)):
        if i == 0 or np.isnan(s.iloc[i]) or np.isnan(l.iloc[i]) or np.isnan(s.iloc[i - 1]):
            out.append("HOLD")
            continue
        if s.iloc[i - 1] <= l.iloc[i - 1] and s.iloc[i] > l.iloc[i]:
            out.append("BUY")
        elif s.iloc[i - 1] >= l.iloc[i - 1] and s.iloc[i] < l.iloc[i]:
            out.append("SELL")
        else:
            out.append("HOLD")
    return out


def rsi_signals(df: pd.DataFrame, period: int = 14, oversold: float = 30, exit_level: float = 50) -> list[Signal]:
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    out: list[Signal] = []
    for i in range(len(df)):
        v = rsi.iloc[i]
        if np.isnan(v):
            out.append("HOLD")
        elif v < oversold:
            out.append("BUY")
        elif v > exit_level:
            out.append("SELL")
        else:
            out.append("HOLD")
    return out


def vwap_signals(df: pd.DataFrame, tolerance: float = 0.001, reject_stale: bool = False) -> list[Signal]:
    if reject_stale and len(df) < 10:
        return ["HOLD"] * len(df)
    tp = (df["high"] + df["low"] + df["close"]) / 3.0
    vwap = (tp * df["volume"]).cumsum() / df["volume"].cumsum().replace(0, np.nan)
    out: list[Signal] = []
    for i in range(len(df)):
        if np.isnan(vwap.iloc[i]):
            out.append("HOLD")
            continue
        if df["close"].iloc[i] > vwap.iloc[i] * (1 + tolerance) and df["volume"].iloc[i] > df["volume"].mean():
            out.append("BUY")
        elif df["close"].iloc[i] < vwap.iloc[i]:
            out.append("SELL")
        else:
            out.append("HOLD")
    return out


def orb_signals(df: pd.DataFrame, range_bars: int = 3, buffer: float = 0.001) -> list[Signal]:
    out: list[Signal] = ["HOLD"] * len(df)
    if len(df) <= range_bars:
        return out
    hi = df["high"].iloc[:range_bars].max()
    fake_guard = hi * (1 + buffer * 0.5)
    for i in range(range_bars, len(df)):
        if df["close"].iloc[i] > hi * (1 + buffer):
            # false breakout: immediate reverse next bar
            if i + 1 < len(df) and df["close"].iloc[i + 1] < fake_guard:
                out[i] = "HOLD"
            else:
                out[i] = "BUY"
        elif df["close"].iloc[i] < hi * (1 - buffer):
            out[i] = "SELL"
    return out


def generate_signals(strategy_type: str, df: pd.DataFrame, params: dict) -> list[Signal]:
    t = strategy_type.lower()
    tid = str(params.get("template_id") or "")
    if "vwap" in t or "vwap" in tid:
        return vwap_signals(df, float(params.get("vwap_tolerance", 0.001)), reject_stale=True)
    if "breakout" in t or "orb" in t or "opening" in t:
        mins = int(params.get("opening_range_minutes", 15))
        bars = max(1, mins // 5)
        return orb_signals(df, bars, float(params.get("breakout_buffer", 0.001)))
    if "rsi" in t or ("mean_reversion" in t and "bollinger" not in t):
        return rsi_signals(
            df,
            int(params.get("rsi_period", 14)),
            float(params.get("oversold_level", 30)),
            float(params.get("exit_level", 50)),
        )
    if "ma" in t or "crossover" in t or t == "trend_following" or params.get("short_period"):
        return ma_crossover_signals(
            df, int(params.get("short_period", 9)), int(params.get("long_period", 21))
        )
    return ma_crossover_signals(df, 9, 21)
