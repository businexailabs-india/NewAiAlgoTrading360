"""BOT_06_VWAP_PULLBACK_VOLUME - trend pullback to VWAP, reclaimed on volume (long-only)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from tradex_bots.bots.base import BotStrategy, Features
from tradex_bots.config import BOT_06, CommonParams
from tradex_bots.indicators_ext import vwap_slope


class Bot06Params(CommonParams):
    ema_fast: int = 9
    ema_slow: int = 21
    trend_lookback: int = 12  # candles before the pullback window that define the established trend
    trend_above_vwap_ratio: float = 0.75
    pullback_window: int = 6
    pullback_tol_atr: float = 0.5  # pullback must come within this many ATRs of VWAP (and not break it by more)
    reclaim_tol_atr: float = 0.25
    volume_multiple: float = 1.2
    vwap_slope_candles: int = 6
    max_vwap_decline_pct: float = 0.001  # reject if VWAP fell more than this over the slope window
    stop_atr_buffer: float = 0.3
    cooldown_minutes_after_exit: int = 15
    max_entries_per_symbol_per_day: int = 2


class Bot06VwapPullbackVolume(BotStrategy):
    bot_id = BOT_06
    name = "VWAP Pullback + Volume"
    strategy_type = "VWAP_PULLBACK_VOLUME"
    ParamsModel = Bot06Params
    required_columns = ["vwap_slope", "pb_low"]
    min_history = 20

    def base_feature_args(self):
        a = super().base_feature_args()
        a.update(ema_fast=self.p.ema_fast, ema_slow=self.p.ema_slow)
        return a

    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        p: Bot06Params = self.p  # type: ignore[assignment]
        out = df.copy()
        out["vwap_slope"] = vwap_slope(out, out["vwap"], p.vwap_slope_candles)
        out["pb_low"] = out["low"].rolling(p.pullback_window + 1, min_periods=1).min()
        return out

    def conditions(self, f: Features, i: int, checks, values) -> None:
        p: Bot06Params = self.p  # type: ignore[assignment]
        atr = f["atr"][i]
        w, tl = p.pullback_window, p.trend_lookback
        # established trend: closes above VWAP in the lookback that precedes the pullback window
        lo, hi = max(0, i - w - tl), max(0, i - w)
        seg = slice(lo, hi)
        above_ratio = float(np.mean(f["close"][seg] > f["vwap"][seg])) if hi > lo else 0.0
        # pullback window (candles before the current one)
        pw = slice(i - w, i)
        dist_low = (f["low"][pw] - f["vwap"][pw]) / atr
        dist_close = (f["close"][pw] - f["vwap"][pw]) / atr
        touched = bool(np.min(dist_low) <= p.pullback_tol_atr)
        not_broken = bool(np.min(dist_close) >= -p.pullback_tol_atr)
        reclaim = bool(
            f["close"][i] > f["vwap"][i] and f["close"][i] > f["open"][i]
            and f["close"][i - 1] <= f["vwap"][i - 1] + p.reclaim_tol_atr * atr
        )
        slope = f["vwap_slope"][i]
        checks.update(
            {
                "ema_fast_above_slow": bool(f["ema_fast"][i] > f["ema_slow"][i]),
                "established_uptrend_above_vwap": above_ratio >= p.trend_above_vwap_ratio,
                "pullback_to_vwap": touched and not_broken,
                "bullish_vwap_reclaim": reclaim,
                "volume_confirms": bool(values["volume_ratio"] >= p.volume_multiple),
                "vwap_not_sharply_declining": bool(slope >= -p.max_vwap_decline_pct),
            }
        )
        values.update(trend_above_ratio=above_ratio, vwap_slope=float(slope))

    def raw_levels(self, f, i, entry):
        p: Bot06Params = self.p  # type: ignore[assignment]
        stop = float(f["pb_low"][i]) - p.stop_atr_buffer * f["atr"][i]
        if stop >= entry:
            return None, None, "pullback_stop_not_below_entry"
        return stop, None, "ok"
