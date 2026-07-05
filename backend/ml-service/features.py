"""Feature engineering from OHLCV bars."""
from __future__ import annotations

import numpy as np
import pandas as pd


def bars_to_frame(bars: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(bars)
    if df.empty:
        return df
    df = df.sort_values("date").reset_index(drop=True)
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna(subset=["close"])


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) < 30:
        return pd.DataFrame()

    close = df["close"]
    volume = df["volume"] if "volume" in df.columns else pd.Series(0, index=df.index)

    feat = pd.DataFrame(index=df.index)
    feat["return_1d"] = close.pct_change()
    feat["return_5d"] = close.pct_change(5)
    feat["return_20d"] = close.pct_change(20)
    feat["rsi_14"] = rsi(close, 14)
    feat["sma_20"] = close.rolling(20).mean()
    feat["sma_50"] = close.rolling(50).mean()
    feat["price_sma20"] = close / feat["sma_20"] - 1
    feat["price_sma50"] = close / feat["sma_50"] - 1
    feat["volatility_20"] = close.pct_change().rolling(20).std()
    feat["volume_ratio"] = volume / volume.rolling(20).mean().replace(0, np.nan)

    ema12 = ema(close, 12)
    ema26 = ema(close, 26)
    macd = ema12 - ema26
    signal = ema(macd, 9)
    feat["macd"] = macd
    feat["macd_signal"] = signal
    feat["macd_hist"] = macd - signal

    std20 = close.rolling(20).std()
    mid = close.rolling(20).mean()
    upper = mid + 2 * std20
    lower = mid - 2 * std20
    feat["bb_pct_b"] = (close - lower) / (upper - lower).replace(0, np.nan)

    # Extended features
    feat["atr_14"] = (df["high"] - df["low"]).rolling(14).mean() / close
    feat["high_low_ratio"] = (df["high"] - df["low"]) / close.replace(0, np.nan)
    feat["momentum_10"] = close.pct_change(10)
    feat["rsi_slope"] = feat["rsi_14"].diff(3)
    feat["macd_cross"] = (feat["macd"] > feat["macd_signal"]).astype(int)

    return feat.replace([np.inf, -np.inf], np.nan).dropna()


def build_dataset(bars: list[dict], horizon_days: int = 7) -> tuple[pd.DataFrame, pd.Series]:
    df = bars_to_frame(bars)
    features = build_features(df)
    if features.empty or len(features) <= horizon_days + 5:
        return pd.DataFrame(), pd.Series(dtype=int)

    close = df.loc[features.index, "close"]
    future = close.shift(-horizon_days)
    target = (future > close).astype(int)
    target = target.loc[features.index]

    valid = target.notna()
    X = features.loc[valid]
    y = target.loc[valid].astype(int)
    return X, y
