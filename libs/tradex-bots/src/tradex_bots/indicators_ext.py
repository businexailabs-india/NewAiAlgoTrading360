"""Additional causal indicators: ADX, Bollinger, Supertrend, 15-minute trend, opening range, swing lows.

Every value at row i depends only on rows <= i (the 15-minute trend uses only 15-minute bars that were
COMPLETE at the end of the 5-minute row).
"""

from __future__ import annotations

from datetime import time

import numpy as np
import pandas as pd

from tradex_bots.indicators import (
    atr_wilder,
    ema,
    rsi_wilder,
    session_vwap,
    true_range,
    volume_average_previous,
)
from tradex_bots.timeutil import IST


def compute_base_features(
    df: pd.DataFrame, *, atr_period: int = 14, volume_lookback: int = 20, volume_scope: str = "continuous",
    ema_fast: int = 9, ema_slow: int = 21, rsi_period: int = 14,
) -> tuple[pd.DataFrame, str]:
    """Columns shared by all bots. Returns (features, vwap_method)."""
    out = df.copy().reset_index(drop=True)
    out["vwap"], method = session_vwap(out)
    out["ema_fast"] = ema(out["close"], ema_fast)
    out["ema_slow"] = ema(out["close"], ema_slow)
    out["atr"] = atr_wilder(out, atr_period)
    out["rsi"] = rsi_wilder(out["close"], rsi_period)
    out["vol_avg_prev"] = volume_average_previous(out, volume_lookback, volume_scope)
    out["prev_high"] = out["high"].shift(1)
    out["avg_turnover"] = (
        (out["close"] * out["volume"]).shift(1).rolling(volume_lookback, min_periods=1).mean()
    )
    out["session"] = out["start"].dt.tz_convert(IST).dt.date
    out["bar_index"] = np.arange(len(out))
    return out, method


def adx_wilder(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Wilder ADX with +DI / -DI."""
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)
    alpha = 1.0 / period
    atr = true_range(df).ewm(alpha=alpha, adjust=False).mean()
    plus_di = 100.0 * plus_dm.ewm(alpha=alpha, adjust=False).mean() / atr.replace(0, np.nan)
    minus_di = 100.0 * minus_dm.ewm(alpha=alpha, adjust=False).mean() / atr.replace(0, np.nan)
    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = dx.ewm(alpha=alpha, adjust=False).mean()
    return pd.DataFrame({"plus_di": plus_di, "minus_di": minus_di, "adx": adx})


def bollinger(close: pd.Series, period: int = 20, mult: float = 2.0) -> pd.DataFrame:
    mid = close.rolling(period, min_periods=period).mean()
    sd = close.rolling(period, min_periods=period).std(ddof=0)
    return pd.DataFrame({"bb_mid": mid, "bb_upper": mid + mult * sd, "bb_lower": mid - mult * sd})


def supertrend(df: pd.DataFrame, period: int = 10, mult: float = 3.0) -> pd.DataFrame:
    """Supertrend line and direction (+1 bullish / -1 bearish). Recursive but strictly causal."""
    n = len(df)
    atr = atr_wilder(df, period).to_numpy()
    hl2 = ((df["high"] + df["low"]) / 2.0).to_numpy()
    close = df["close"].to_numpy()
    ub = hl2 + mult * atr
    lb = hl2 - mult * atr
    fub = np.full(n, np.nan)
    flb = np.full(n, np.nan)
    direction = np.zeros(n, dtype=int)
    st = np.full(n, np.nan)
    for i in range(n):
        if i == 0 or np.isnan(fub[i - 1]):
            fub[i], flb[i], direction[i] = ub[i], lb[i], 1
        else:
            fub[i] = ub[i] if (ub[i] < fub[i - 1] or close[i - 1] > fub[i - 1]) else fub[i - 1]
            flb[i] = lb[i] if (lb[i] > flb[i - 1] or close[i - 1] < flb[i - 1]) else flb[i - 1]
            if direction[i - 1] == -1 and close[i] > fub[i]:
                direction[i] = 1
            elif direction[i - 1] == 1 and close[i] < flb[i]:
                direction[i] = -1
            else:
                direction[i] = direction[i - 1]
        st[i] = flb[i] if direction[i] == 1 else fub[i]
    return pd.DataFrame({"st_line": st, "st_dir": direction}, index=df.index)


def trend_15m(df: pd.DataFrame, fast: int = 9, slow: int = 21) -> pd.Series:
    """Bullish flag from the latest COMPLETED 15-minute bar: EMA(fast) > EMA(slow) and close > EMA(slow).
    NaN until `slow` 15-minute bars exist."""
    local = df["start"].dt.tz_convert(IST)
    minutes_from_open = local.dt.hour * 60 + local.dt.minute - (9 * 60 + 15)
    bucket = (minutes_from_open // 15).astype(int)
    key = pd.DataFrame({"session": local.dt.date, "bucket": bucket})
    g = df.groupby([key["session"], key["bucket"]], sort=True)
    bars = g.agg(start=("start", "first"), last_start=("start", "last"), close=("close", "last"),
                 n=("close", "size")).reset_index(drop=True)
    bars = bars[bars["n"] == 3].copy()  # only complete 15-minute bars (3 x 5-minute)
    if bars.empty:
        return pd.Series(np.nan, index=df.index)
    bars["end"] = bars["last_start"] + pd.Timedelta(minutes=5)
    bars["e_fast"], bars["e_slow"] = ema(bars["close"], fast), ema(bars["close"], slow)
    bars["bull"] = ((bars["e_fast"] > bars["e_slow"]) & (bars["close"] > bars["e_slow"])).astype(float)
    bars.loc[bars.index[: slow - 1], "bull"] = np.nan
    left = pd.DataFrame({"end": df["start"] + pd.Timedelta(minutes=5)}).reset_index()
    merged = pd.merge_asof(left.sort_values("end"), bars[["end", "bull"]].sort_values("end"),
                           on="end", direction="backward")
    return merged.sort_values("index").set_index("index")["bull"].reindex(df.index)


def opening_range(df: pd.DataFrame, or_end: time = time(9, 30), session_open: time = time(9, 15)) -> pd.DataFrame:
    """Per-session opening range high/low/width. Values appear only on rows that start at/after `or_end`
    (i.e. after the range is complete) and only if ALL range candles are present."""
    local = df["start"].dt.tz_convert(IST)
    tod = local.dt.time
    in_range = (tod >= session_open) & (tod < or_end)
    sess = local.dt.date
    exp = int(((or_end.hour * 60 + or_end.minute) - (session_open.hour * 60 + session_open.minute)) / 5)
    hi = df["high"].where(in_range).groupby(sess).transform("max")
    lo = df["low"].where(in_range).groupby(sess).transform("min")
    cnt = in_range.astype(int).groupby(sess).transform("sum")
    complete = (tod >= or_end) & (cnt == exp)
    out = pd.DataFrame(index=df.index)
    out["or_high"] = hi.where(complete)
    out["or_low"] = lo.where(complete)
    out["or_width"] = out["or_high"] - out["or_low"]
    out["or_complete"] = complete
    return out


def rolling_swing_low(df: pd.DataFrame, n: int) -> pd.Series:
    """Lowest low of the last n candles (current included) within the same session."""
    sess = df["start"].dt.tz_convert(IST).dt.date
    return df["low"].groupby(sess).transform(lambda s: s.rolling(n, min_periods=1).min())


def vwap_slope(df: pd.DataFrame, vwap: pd.Series, k: int) -> pd.Series:
    """Fractional change of session VWAP over k candles (same session only)."""
    sess = df["start"].dt.tz_convert(IST).dt.date
    prev = vwap.groupby(sess).shift(k)
    return (vwap - prev) / prev
