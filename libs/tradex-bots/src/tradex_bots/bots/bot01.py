"""BOT_01_VWAP_EMA_VOLUME - VWAP + EMA + volume momentum (long-only)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from pydantic import model_validator

from tradex_bots.bots.base import BotStrategy, Features
from tradex_bots.config import BOT_01, CommonParams
from tradex_bots.models import ExitReason


class Bot01Params(CommonParams):
    ema_fast: int = 9
    ema_slow: int = 21
    ema_slope_candles: int = 3  # EMA fast strictly increasing across this many completed candles
    volume_multiple: float = 1.3
    rsi_period: int = 14
    rsi_filter_enabled: bool = True
    rsi_min: float = 50.0
    rsi_max: float = 70.0
    atr_stop_multiple: float = 0.8
    exit_on_ema_bearish_cross: bool = True
    exit_on_vwap_breakdown: bool = False  # optional; to be tested, not assumed beneficial
    max_entries_per_symbol_per_day: int = 2

    @model_validator(mode="after")
    def _b1(self) -> "Bot01Params":
        if self.ema_fast >= self.ema_slow:
            raise ValueError("ema_fast must be < ema_slow")
        if self.ema_slope_candles < 2:
            raise ValueError("ema_slope_candles must be >= 2")
        return self


class Bot01VwapEmaVolume(BotStrategy):
    bot_id = BOT_01
    name = "VWAP + EMA + Volume Momentum"
    strategy_type = "VWAP_EMA_VOLUME_MOMENTUM"
    ParamsModel = Bot01Params
    required_columns = ["rsi"]

    def base_feature_args(self):
        a = super().base_feature_args()
        a.update(ema_fast=self.p.ema_fast, ema_slow=self.p.ema_slow, rsi_period=self.p.rsi_period)
        return a

    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def conditions(self, f: Features, i: int, checks, values) -> None:
        p: Bot01Params = self.p  # type: ignore[assignment]
        k = p.ema_slope_candles
        ef = f["ema_fast"][i - k + 1 : i + 1]
        vol_ratio = values["volume_ratio"]
        checks.update(
            {
                "close_above_vwap": bool(f["close"][i] > f["vwap"][i]),
                "ema_fast_above_slow": bool(f["ema_fast"][i] > f["ema_slow"][i]),
                "ema_fast_rising": bool(np.all(np.diff(ef) > 0)),
                "volume_surge": bool(vol_ratio >= p.volume_multiple),
                "close_above_prev_high": bool(f["close"][i] > f["prev_high"][i]),
                "rsi_in_range": (not p.rsi_filter_enabled) or bool(p.rsi_min <= f["rsi"][i] <= p.rsi_max),
            }
        )
        values.update(ema_fast=float(f["ema_fast"][i]), ema_slow=float(f["ema_slow"][i]),
                      rsi=float(f["rsi"][i]))

    def raw_levels(self, f, i, entry):
        p: Bot01Params = self.p  # type: ignore[assignment]
        d = max(p.min_stop_pct * entry, p.atr_stop_multiple * f["atr"][i])
        return entry - d, None, "ok"

    def exit_signal(self, f, i):
        p: Bot01Params = self.p  # type: ignore[assignment]
        if p.exit_on_ema_bearish_cross and f["ema_fast"][i] < f["ema_slow"][i]:
            return ExitReason.EMA_BEARISH_CROSS
        if p.exit_on_vwap_breakdown and f["close"][i] < f["vwap"][i]:
            return ExitReason.VWAP_BREAKDOWN
        return None
