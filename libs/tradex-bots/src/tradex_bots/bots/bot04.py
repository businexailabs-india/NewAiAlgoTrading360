"""BOT_04_RSI_MEAN_REVERSION - long-only RSI recovery in range-bound conditions."""

from __future__ import annotations

import numpy as np
import pandas as pd

from tradex_bots.bots.base import BotStrategy, Features
from tradex_bots.config import BOT_04, CommonParams
from tradex_bots.indicators_ext import adx_wilder, bollinger, rolling_swing_low


class Bot04Params(CommonParams):
    rsi_period: int = 14
    rsi_oversold: float = 30.0
    adx_period: int = 14
    adx_max: float = 20.0
    bb_period: int = 20
    bb_mult: float = 2.0
    bb_tolerance_pct: float = 0.003  # "near" the lower band
    swing_lookback: int = 6
    stop_atr_buffer: float = 0.3
    target_rr: float = 1.5
    max_directional_move_atr: float = 4.0  # reject if price fell more than this many ATRs over 6 candles
    cooldown_minutes_after_loss: int = 30
    max_entries_per_symbol_per_day: int = 2


class Bot04RsiMeanReversion(BotStrategy):
    bot_id = BOT_04
    name = "RSI Mean Reversion"
    strategy_type = "RSI_MEAN_REVERSION"
    ParamsModel = Bot04Params
    required_columns = ["rsi", "adx", "bb_lower", "swing_low"]
    min_history = 8

    def base_feature_args(self):
        a = super().base_feature_args()
        a.update(rsi_period=self.p.rsi_period)
        return a

    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        p: Bot04Params = self.p  # type: ignore[assignment]
        out = pd.concat([df, adx_wilder(df, p.adx_period), bollinger(df["close"], p.bb_period, p.bb_mult)], axis=1)
        out["swing_low"] = rolling_swing_low(out, p.swing_lookback)
        out["near_lower_band"] = (out["low"] <= out["bb_lower"] * (1 + p.bb_tolerance_pct)).astype(float)
        out.loc[out["bb_lower"].isna(), "near_lower_band"] = np.nan
        return out

    def conditions(self, f: Features, i: int, checks, values) -> None:
        p: Bot04Params = self.p  # type: ignore[assignment]
        atr = f["atr"][i]
        drop_atr = (f["close"][i - 6] - f["close"][i]) / atr if atr > 0 and i >= 6 else 0.0
        near = bool(f["near_lower_band"][i] == 1.0 or f["near_lower_band"][i - 1] == 1.0)
        checks.update(
            {
                "rsi_was_oversold": bool(f["rsi"][i - 1] < p.rsi_oversold),
                "rsi_crossed_back_above": bool(f["rsi"][i] >= p.rsi_oversold),
                "adx_low": bool(f["adx"][i] < p.adx_max),
                "near_or_below_lower_band": near,
                "bullish_recovery": bool(f["close"][i] > f["open"][i] and f["close"][i] > f["close"][i - 1]),
                "no_extreme_downside_momentum": bool(drop_atr <= p.max_directional_move_atr),
            }
        )
        values.update(rsi=float(f["rsi"][i]), adx=float(f["adx"][i]), bb_lower=float(f["bb_lower"][i]),
                      drop_atr=float(drop_atr))

    def raw_levels(self, f, i, entry):
        """Stop below the recent swing low with an ATR buffer. Target = lower of session VWAP or 1.5R, and it
        must lie above entry, otherwise the setup is rejected."""
        p: Bot04Params = self.p  # type: ignore[assignment]
        stop = f["swing_low"][i] - p.stop_atr_buffer * f["atr"][i]
        if stop >= entry:
            return None, None, "swing_stop_not_below_entry"
        d = max(entry - stop, p.min_stop_pct * entry)
        target = min(f["vwap"][i], entry + p.target_rr * d)
        if target <= entry:
            return None, None, "target_not_above_entry"
        return stop, float(target), "ok"
