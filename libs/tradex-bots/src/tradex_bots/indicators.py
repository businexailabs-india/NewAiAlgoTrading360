"""Causal indicators. Every value at row i depends only on rows <= i.

VWAP methodology
----------------
* If a candle carries ``turnover`` (sum of price*qty from real ticks, or ATP*cum_volume deltas) the session
  VWAP is cumulative(turnover) / cumulative(volume): the ACTUAL volume-weighted trade price.
* Otherwise (historical OHLCV) a typical-price approximation is used: (H+L+C)/3 weighted by volume.
  This approximation differs from true VWAP; the backtest report records which method was used per run.
* The VWAP resets at every IST session date.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from tradex_bots.models import Candle
from tradex_bots.timeutil import IST

VWAP_ACTUAL = "actual_trade_turnover"
VWAP_TYPICAL = "typical_price_approximation"


def candles_to_frame(candles: list[Candle]) -> pd.DataFrame:
    rows = [
        {
            "symbol": c.symbol,
            "start": c.start.astimezone(IST),
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume,
            "turnover": np.nan if c.turnover is None else c.turnover,
        }
        for c in candles
    ]
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(
            columns=["symbol", "start", "open", "high", "low", "close", "volume", "turnover"]
        )
    df["start"] = pd.to_datetime(df["start"])
    return df.reset_index(drop=True)


def session_vwap(df: pd.DataFrame) -> tuple[pd.Series, str]:
    """Session-reset VWAP. Returns (series, method)."""
    session = df["start"].dt.tz_convert(IST).dt.date
    typical_turnover = (df["high"] + df["low"] + df["close"]) / 3.0 * df["volume"]
    has_actual = df["turnover"].notna() if "turnover" in df else pd.Series(False, index=df.index)
    turnover = df["turnover"].where(has_actual, typical_turnover) if "turnover" in df else typical_turnover
    cum_turnover = turnover.groupby(session).cumsum()
    cum_volume = df["volume"].groupby(session).cumsum()
    vwap = cum_turnover / cum_volume.replace(0, np.nan)
    # Zero cumulative volume at the session start: fall back to the candle close (documented edge case).
    vwap = vwap.fillna(df["close"].where(cum_volume == 0))
    method = VWAP_ACTUAL if bool(has_actual.all()) and len(df) else VWAP_TYPICAL
    return vwap, method


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()], axis=1
    ).max(axis=1)
    tr.iloc[0:1] = (df["high"] - df["low"]).iloc[0:1]
    return tr


def atr_wilder(df: pd.DataFrame, period: int) -> pd.Series:
    return true_range(df).ewm(alpha=1.0 / period, adjust=False).mean()


def rsi_wilder(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100.0 - 100.0 / (1.0 + rs)
    rsi = rsi.where(avg_loss != 0, 100.0)
    rsi = rsi.where(~((avg_gain == 0) & (avg_loss == 0)), 50.0)
    rsi.iloc[0:1] = np.nan
    return rsi


def volume_average_previous(df: pd.DataFrame, lookback: int, scope: str) -> pd.Series:
    """Average volume of the PREVIOUS `lookback` completed candles (current candle excluded)."""
    if scope == "session":
        session = df["start"].dt.tz_convert(IST).dt.date
        return df.groupby(session)["volume"].transform(
            lambda s: s.shift(1).rolling(lookback, min_periods=lookback).mean()
        )
    return df["volume"].shift(1).rolling(lookback, min_periods=lookback).mean()


