"""BOT_03_EMA_CROSSOVER - EMA(9) crosses above EMA(21) (long-only)."""

from __future__ import annotations

import pandas as pd
from pydantic import model_validator

from tradex_bots.bots.base import BotStrategy, Features
from tradex_bots.config import BOT_03, CommonParams
from tradex_bots.indicators_ext import trend_15m
from tradex_bots.models import ExitReason


class Bot03Params(CommonParams):
    ema_fast: int = 9
    ema_slow: int = 21
    volume_multiple: float = 1.0  # "exceeds the preceding 20-candle average"
    use_trend_filter_15m: bool = True
    min_atr_pct: float = 0.001  # ATR/close acceptable band
    max_atr_pct: float = 0.010
    atr_stop_multiple: float = 0.8
    exit_on_ema_bearish_cross: bool = True
    max_entries_per_symbol_per_day: int = 1

    @model_validator(mode="after")
    def _b3(self) -> "Bot03Params":
        if self.ema_fast >= self.ema_slow:
            raise ValueError("ema_fast must be < ema_slow")
        return self


class Bot03EmaCrossover(BotStrategy):
    bot_id = BOT_03
    name = "EMA 9/21 Crossover"
    strategy_type = "EMA_CROSSOVER"
    ParamsModel = Bot03Params
    min_history = 2

    def base_feature_args(self):
        a = super().base_feature_args()
        a.update(ema_fast=self.p.ema_fast, ema_slow=self.p.ema_slow)
        return a

    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        p: Bot03Params = self.p  # type: ignore[assignment]
        df = df.copy()
        df["trend15_bull"] = trend_15m(df, p.ema_fast, p.ema_slow)
        return df

    def conditions(self, f: Features, i: int, checks, values) -> None:
        p: Bot03Params = self.p  # type: ignore[assignment]
        crossed = bool(f["ema_fast"][i] > f["ema_slow"][i]) and bool(f["ema_fast"][i - 1] <= f["ema_slow"][i - 1])
        atr_pct = f["atr"][i] / f["close"][i]
        t15 = f["trend15_bull"][i]
        checks.update(
            {
                "ema_cross_up": crossed,
                "prev_ema_fast_le_slow": bool(f["ema_fast"][i - 1] <= f["ema_slow"][i - 1]),
                "close_above_vwap": bool(f["close"][i] > f["vwap"][i]),
                "trend_15m_bullish": (not p.use_trend_filter_15m) or bool(t15 == 1.0),
                "volume_above_average": bool(values["volume_ratio"] > p.volume_multiple),
                "atr_within_limits": bool(p.min_atr_pct <= atr_pct <= p.max_atr_pct),
            }
        )
        values.update(ema_fast=float(f["ema_fast"][i]), ema_slow=float(f["ema_slow"][i]), atr_pct=float(atr_pct))

    def raw_levels(self, f, i, entry):
        p: Bot03Params = self.p  # type: ignore[assignment]
        d = max(p.min_stop_pct * entry, p.atr_stop_multiple * f["atr"][i])
        return entry - d, None, "ok"

    def exit_signal(self, f, i):
        p: Bot03Params = self.p  # type: ignore[assignment]
        if p.exit_on_ema_bearish_cross and f["ema_fast"][i] < f["ema_slow"][i]:
            return ExitReason.EMA_BEARISH_CROSS
        return None
