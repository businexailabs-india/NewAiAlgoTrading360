from __future__ import annotations

import math
from datetime import time
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from ibkr_orb_paper.domain.models import Bar, IndicatorSnapshot


def bars_to_dataframe(bars: list[Bar]) -> pd.DataFrame:
    if not bars:
        return pd.DataFrame(columns=["ts", "open", "high", "low", "close", "volume", "complete"])
    rows = [
        {
            "ts": b.ts,
            "open": b.open,
            "high": b.high,
            "low": b.low,
            "close": b.close,
            "volume": b.volume,
            "complete": b.complete,
        }
        for b in bars
    ]
    df = pd.DataFrame(rows).sort_values("ts").reset_index(drop=True)
    return df


def only_completed(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    if "complete" in df.columns:
        return df[df["complete"]].copy().reset_index(drop=True)
    return df.copy()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def ema_slope(ema_series: pd.Series, lookback: int = 3) -> float:
    if len(ema_series) < lookback + 1:
        return 0.0
    a = float(ema_series.iloc[-1])
    b = float(ema_series.iloc[-1 - lookback])
    return a - b


def session_vwap(df: pd.DataFrame, market_timezone: str = "America/New_York") -> pd.Series:
    """Session VWAP using typical price * volume / cum volume. Resets each session. No look-ahead."""
    if df.empty:
        return pd.Series(dtype=float)
    tz = ZoneInfo(market_timezone)
    dates = []
    for ts in df["ts"]:
        t = ts if getattr(ts, "tzinfo", None) else ts.replace(tzinfo=tz)
        if getattr(t, "tzinfo", None):
            t = t.astimezone(tz)
        dates.append(t.date())
    session = pd.Series(dates, index=df.index)
    tp = (df["high"] + df["low"] + df["close"]) / 3.0
    vol = df["volume"].astype(float)
    pv = tp * vol
    cum_pv = pv.groupby(session).cumsum()
    cum_v = vol.groupby(session).cumsum().replace(0, np.nan)
    return cum_pv / cum_v


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    if df.empty:
        return pd.Series(dtype=float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    close = df["close"].astype(float)
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(window=period, min_periods=period).mean()


def average_volume(volume: pd.Series, lookback: int) -> float:
    completed = volume.dropna()
    if len(completed) < 1:
        return 0.0
    window = completed.iloc[-lookback:] if len(completed) >= lookback else completed
    return float(window.mean())


def opening_range(
    df: pd.DataFrame,
    *,
    opening_range_minutes: int,
    bar_minutes: int,
    market_timezone: str,
    session_open: time = time(9, 30),
) -> tuple[float, float, bool]:
    """
    Opening range from first N minutes of RTH.
    Uses only completed bars whose close time is within the OR window.
    """
    if df.empty:
        return 0.0, 0.0, False
    tz = ZoneInfo(market_timezone)
    bars_needed = max(1, math.ceil(opening_range_minutes / max(1, bar_minutes)))
    # Filter to session date of last bar
    last_ts = df["ts"].iloc[-1]
    if getattr(last_ts, "tzinfo", None) is None:
        last_ts = last_ts.replace(tzinfo=tz)
    else:
        last_ts = last_ts.astimezone(tz)
    session_date = last_ts.date()
    or_end_minute = session_open.hour * 60 + session_open.minute + opening_range_minutes

    session_bars: list[int] = []
    for i, ts in enumerate(df["ts"]):
        t = ts
        if getattr(t, "tzinfo", None) is None:
            t = t.replace(tzinfo=tz)
        else:
            t = t.astimezone(tz)
        if t.date() != session_date:
            continue
        # bar close time must be > session open and <= OR end
        mins = t.hour * 60 + t.minute
        open_mins = session_open.hour * 60 + session_open.minute
        if open_mins < mins <= or_end_minute:
            session_bars.append(i)

    if len(session_bars) < bars_needed:
        # also accept first N session bars after open if timestamps are bar ends
        after_open = []
        for i, ts in enumerate(df["ts"]):
            t = ts.astimezone(tz) if getattr(ts, "tzinfo", None) else ts.replace(tzinfo=tz)
            if t.date() != session_date:
                continue
            mins = t.hour * 60 + t.minute
            open_mins = session_open.hour * 60 + session_open.minute
            if mins > open_mins:
                after_open.append(i)
        session_bars = after_open[:bars_needed]

    complete = len(session_bars) >= bars_needed
    if not session_bars:
        return 0.0, 0.0, False
    use = session_bars[:bars_needed]
    hi = float(df.loc[use, "high"].max())
    lo = float(df.loc[use, "low"].min())
    return hi, lo, complete


def parse_bar_minutes(bar_size: str) -> int:
    s = bar_size.strip().lower()
    if "min" in s:
        return int("".join(ch for ch in s if ch.isdigit()) or "15")
    if "hour" in s:
        return int("".join(ch for ch in s if ch.isdigit()) or "1") * 60
    return 15


class IndicatorService:
    def compute(
        self,
        bars: list[Bar],
        *,
        ema_period: int,
        atr_period: int,
        volume_lookback: int,
        opening_range_minutes: int,
        bar_size: str,
        market_timezone: str,
    ) -> IndicatorSnapshot | None:
        df = only_completed(bars_to_dataframe(bars))
        if len(df) < max(ema_period, atr_period, volume_lookback) + 2:
            return None
        ema_s = ema(df["close"].astype(float), ema_period)
        atr_s = atr(df, atr_period)
        vwap_s = session_vwap(df, market_timezone=market_timezone)
        bar_mins = parse_bar_minutes(bar_size)
        or_hi, or_lo, or_done = opening_range(
            df,
            opening_range_minutes=opening_range_minutes,
            bar_minutes=bar_mins,
            market_timezone=market_timezone,
        )
        if pd.isna(ema_s.iloc[-1]) or pd.isna(atr_s.iloc[-1]) or pd.isna(vwap_s.iloc[-1]):
            return None
        prior_vol = df["volume"].astype(float).iloc[:-1]
        return IndicatorSnapshot(
            ema=float(ema_s.iloc[-1]),
            ema_slope=ema_slope(ema_s),
            vwap=float(vwap_s.iloc[-1]),
            atr=float(atr_s.iloc[-1]),
            avg_volume=average_volume(prior_vol, volume_lookback),
            opening_range_high=or_hi,
            opening_range_low=or_lo,
            opening_range_complete=or_done,
        )

    def compute_with_prior_avg_volume(
        self,
        bars: list[Bar],
        *,
        ema_period: int,
        atr_period: int,
        volume_lookback: int,
        opening_range_minutes: int,
        bar_size: str,
        market_timezone: str,
    ) -> IndicatorSnapshot | None:
        snap = self.compute(
            bars,
            ema_period=ema_period,
            atr_period=atr_period,
            volume_lookback=volume_lookback,
            opening_range_minutes=opening_range_minutes,
            bar_size=bar_size,
            market_timezone=market_timezone,
        )
        if snap is None:
            return None
        df = only_completed(bars_to_dataframe(bars))
        prior = df["volume"].astype(float).iloc[:-1]
        avg = average_volume(prior, volume_lookback)
        return IndicatorSnapshot(
            ema=snap.ema,
            ema_slope=snap.ema_slope,
            vwap=snap.vwap,
            atr=snap.atr,
            avg_volume=avg,
            opening_range_high=snap.opening_range_high,
            opening_range_low=snap.opening_range_low,
            opening_range_complete=snap.opening_range_complete,
        )


def round_to_tick(price: float, min_tick: float, mode: str = "nearest") -> float:
    if min_tick <= 0:
        return price
    steps = price / min_tick
    if mode == "down":
        return math.floor(steps) * min_tick
    if mode == "up":
        return math.ceil(steps) * min_tick
    return round(steps) * min_tick
