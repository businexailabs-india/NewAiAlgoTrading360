"""BOT_02_OPENING_RANGE_BREAKOUT - 09:15-09:30 opening range breakout (long-only)."""

from __future__ import annotations

from datetime import time

import pandas as pd

from tradex_bots.bots.base import BotStrategy, Features
from tradex_bots.config import BOT_02, CommonParams
from tradex_bots.indicators_ext import opening_range


class Bot02Params(CommonParams):
    entry_window_end: time = time(11, 30)
    or_end: time = time(9, 30)
    volume_multiple: float = 1.5
    or_width_min_atr: float = 0.5  # opening-range width must be at least this many ATRs ...
    or_width_max_atr: float = 3.0  # ... and at most this many
    max_extension_atr: float = 1.0  # (close - OR high) must not exceed this many ATRs
    structural_buffer_atr: float = 0.25  # buffer below the structural level
    noise_atr_multiple: float = 0.8  # stop must be at least this many ATRs away (market noise floor)
    max_entries_per_symbol_per_day: int = 1


class Bot02OpeningRangeBreakout(BotStrategy):
    bot_id = BOT_02
    name = "Opening Range Breakout"
    strategy_type = "OPENING_RANGE_BREAKOUT"
    ParamsModel = Bot02Params
    required_columns = ["or_high", "or_low", "or_width"]

    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        p: Bot02Params = self.p  # type: ignore[assignment]
        return pd.concat([df, opening_range(df, or_end=p.or_end, session_open=p.session_open)], axis=1)

    def conditions(self, f: Features, i: int, checks, values) -> None:
        p: Bot02Params = self.p  # type: ignore[assignment]
        atr = f["atr"][i]
        width, hi = f["or_width"][i], f["or_high"][i]
        ext = (f["close"][i] - hi) / atr if atr > 0 else float("inf")
        checks.update(
            {
                "opening_range_complete": bool(f["or_complete"][i]),
                "close_above_or_high": bool(f["close"][i] > hi),
                "close_above_vwap": bool(f["close"][i] > f["vwap"][i]),
                "volume_surge": bool(values["volume_ratio"] >= p.volume_multiple),
                "or_width_in_atr_limits": bool(p.or_width_min_atr <= width / atr <= p.or_width_max_atr)
                if atr > 0 else False,
                "not_overextended": bool(ext <= p.max_extension_atr),
            }
        )
        values.update(or_high=float(hi), or_low=float(f["or_low"][i]), or_width=float(width),
                      extension_atr=float(ext))

    def raw_levels(self, f, i, entry):
        """Tighter structural stop (OR midpoint - buffer) is used ONLY if it is outside expected noise
        (>= noise_atr_multiple x ATR from entry). Otherwise fall back to the wider OR-low stop; if that is
        also inside the noise floor the trade is rejected."""
        p: Bot02Params = self.p  # type: ignore[assignment]
        atr = f["atr"][i]
        buf = p.structural_buffer_atr * atr
        noise = p.noise_atr_multiple * atr
        mid = (f["or_high"][i] + f["or_low"][i]) / 2.0
        for cand in (mid - buf, f["or_low"][i] - buf):
            if entry - cand >= noise:
                return cand, None, "ok"
        return None, None, "structural_stop_inside_noise"
