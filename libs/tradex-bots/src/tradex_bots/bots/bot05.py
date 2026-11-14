"""BOT_05_SUPERTREND_ADX - Supertrend flip to bullish confirmed by ADX and EMA(21) (long-only)."""

from __future__ import annotations

import pandas as pd

from tradex_bots.bots.base import BotStrategy, Features
from tradex_bots.config import BOT_05, CommonParams
from tradex_bots.indicators_ext import adx_wilder, supertrend
from tradex_bots.models import ExitReason


class Bot05Params(CommonParams):
    st_period: int = 10
    st_multiplier: float = 3.0
    adx_period: int = 14
    adx_min: float = 25.0
    min_stop_atr: float = 0.5  # validated stop must be at least this many ATRs below entry
    max_entries_per_symbol_per_day: int = 1
    # NOTE: a separately backtested trailing-exit policy is NOT implemented; target is fixed at reward_risk R.


class Bot05SupertrendAdx(BotStrategy):
    bot_id = BOT_05
    name = "Supertrend + ADX"
    strategy_type = "SUPERTREND_ADX"
    ParamsModel = Bot05Params
    required_columns = ["st_line", "st_dir", "adx"]
    min_history = 3

    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        p: Bot05Params = self.p  # type: ignore[assignment]
        return pd.concat([df, supertrend(df, p.st_period, p.st_multiplier), adx_wilder(df, p.adx_period)], axis=1)

    def conditions(self, f: Features, i: int, checks, values) -> None:
        p: Bot05Params = self.p  # type: ignore[assignment]
        checks.update(
            {
                "supertrend_flipped_bullish": bool(f["st_dir"][i] == 1 and f["st_dir"][i - 1] == -1),
                "adx_strong": bool(f["adx"][i] > p.adx_min),
                "close_above_ema21": bool(f["close"][i] > f["ema_slow"][i]),
                "bullish_confirmation": bool(f["close"][i] > f["st_line"][i] and f["close"][i] > f["open"][i]),
            }
        )
        values.update(st_line=float(f["st_line"][i]), adx=float(f["adx"][i]), ema_slow=float(f["ema_slow"][i]))

    def raw_levels(self, f, i, entry):
        p: Bot05Params = self.p  # type: ignore[assignment]
        stop = float(f["st_line"][i])
        if stop >= entry:
            return None, None, "supertrend_stop_not_below_entry"
        if entry - stop < p.min_stop_atr * f["atr"][i]:
            return None, None, "supertrend_stop_inside_noise"
        return stop, None, "ok"

    def exit_signal(self, f, i):
        return ExitReason.SUPERTREND_REVERSAL if f["st_dir"][i] == -1 else None
