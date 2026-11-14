"""Common machinery for all bots. One implementation serves backtest, paper and live.

Contract: callers pass COMPLETED candles only. `evaluate_at(f, i)` reads rows <= i exclusively (no look-ahead);
`evaluate_latest` additionally drops any candle whose end lies in the future relative to `now`.
"""

from __future__ import annotations

import hashlib
import json
import math
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, ClassVar

import numpy as np
import pandas as pd

from tradex_bots.config import CommonParams
from tradex_bots.indicators import candles_to_frame
from tradex_bots.indicators_ext import compute_base_features
from tradex_bots.instruments import round_to_tick
from tradex_bots.models import Candle, ExitReason, SignalDecision, TradeLevels
from tradex_bots.timeutil import to_ist

# (id(frame), len, args) -> (frame, (base_features, method)); see BotStrategy.features.
# Callers must not mutate a frame in place after evaluating on it.
_BASE_CACHE: dict[tuple, tuple] = {}

BASE_REQUIRED = ["close", "vwap", "ema_fast", "ema_slow", "atr", "vol_avg_prev", "prev_high"]


class Features:
    """Numpy-backed view of the feature frame for fast scalar access in event loops."""

    def __init__(self, df: pd.DataFrame, vwap_method: str):
        self.df = df
        self.n = len(df)
        self.vwap_method = vwap_method
        self.a: dict[str, np.ndarray] = {}
        for c in df.columns:
            if c in ("symbol", "start", "session"):
                continue
            col = df[c]
            self.a[c] = col.to_numpy(dtype=float, na_value=np.nan) if col.dtype != object else col.to_numpy()
        self.start = list(pd.DatetimeIndex(df["start"]).to_pydatetime()) if self.n else []
        self.session = list(df["session"]) if self.n else []
        self.symbol = str(df["symbol"].iloc[0]) if self.n else ""
        gap_ok = np.zeros(self.n, dtype=bool)
        for k in range(1, self.n):
            gap_ok[k] = self.session[k] == self.session[k - 1] and (
                self.start[k] - self.start[k - 1] == timedelta(minutes=5)
            )
        self.gap_ok = gap_ok

    def __getitem__(self, col: str) -> np.ndarray:
        return self.a[col]

    def contiguous(self, i: int, k: int) -> bool:
        """True if the last k candles ending at i are same-session and exactly adjacent."""
        if i - k + 2 < 1:
            return False
        return bool(self.gap_ok[i - k + 2 : i + 1].all())


class BotStrategy(ABC):
    bot_id: ClassVar[str]
    name: ClassVar[str]
    strategy_type: ClassVar[str]
    version: ClassVar[str] = "1.0.0"
    ParamsModel: ClassVar[type[CommonParams]] = CommonParams
    required_columns: ClassVar[list[str]] = []
    contiguity_bars: ClassVar[int] = 3
    min_history: ClassVar[int] = 0

    def __init__(self, params: CommonParams | dict | None = None):
        if params is None:
            params = self.ParamsModel()
        elif isinstance(params, dict):
            params = self.ParamsModel(**params)
        self.p = params

    # ------------------------------------------------------------------ identity
    @property
    def config_hash(self) -> str:
        blob = json.dumps(self.p.model_dump(mode="json"), sort_keys=True, default=str)
        return hashlib.sha256(f"{self.bot_id}:{self.version}:{blob}".encode()).hexdigest()[:16]

    def describe(self) -> dict[str, Any]:
        return {"bot_id": self.bot_id, "name": self.name, "strategy_type": self.strategy_type,
                "version": self.version, "config_hash": self.config_hash,
                "params": self.p.model_dump(mode="json")}

    # ------------------------------------------------------------------ features
    def base_feature_args(self) -> dict[str, Any]:
        return {"atr_period": self.p.atr_period, "volume_lookback": self.p.volume_lookback,
                "volume_scope": self.p.volume_scope}

    @abstractmethod
    def extra_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return df with bot-specific columns added (strictly causal)."""

    def features(self, df: pd.DataFrame) -> Features:
        # Base features depend only on (frame, args). A runner shares one frame object per symbol
        # across bots, so memoise by frame identity. The cache keeps a reference to the frame so
        # its id cannot be reused while cached; it holds only the most recent entries.
        args = self.base_feature_args()
        key = (id(df), len(df), tuple(sorted(args.items())))
        hit = _BASE_CACHE.get(key)
        if hit is None or hit[0] is not df:
            if len(_BASE_CACHE) >= 32:
                _BASE_CACHE.pop(next(iter(_BASE_CACHE)))
            hit = (df, compute_base_features(df, **args))
            _BASE_CACHE[key] = hit
        base, method = hit[1]
        full = self.extra_features(base.copy(deep=False))
        return Features(full, method)

    # ------------------------------------------------------------------ entry
    @abstractmethod
    def conditions(self, f: Features, i: int, checks: dict[str, bool], values: dict[str, float]) -> None:
        """Populate bot-specific entry checks (all must be True)."""

    def evaluate_at(self, f: Features, i: int) -> SignalDecision:
        p = self.p
        start = f.start[i]
        end = start + timedelta(minutes=p.candle_minutes)
        close_t = to_ist(end).time()
        checks: dict[str, bool] = {"entry_window": p.entry_window_start <= close_t <= p.entry_window_end}
        values: dict[str, float] = {}
        cols = BASE_REQUIRED + self.required_columns
        ready = i >= max(p.warmup_bars, self.min_history) and not any(math.isnan(f[c][i]) for c in cols)
        checks["history_ready"] = bool(ready)
        if not ready:
            return SignalDecision(self.bot_id, f.symbol, start, end, False, checks, values)
        checks["contiguous_candles"] = f.contiguous(i, self.contiguity_bars)
        checks["min_price"] = bool(f["close"][i] >= p.min_price)
        checks["liquidity_turnover"] = bool(f["avg_turnover"][i] >= p.min_avg_candle_turnover_inr)
        values.update({"close": float(f["close"][i]), "vwap": float(f["vwap"][i]),
                       "atr": float(f["atr"][i]), "volume_ratio": float(f["volume"][i] / f["vol_avg_prev"][i])
                       if f["vol_avg_prev"][i] > 0 else 0.0})
        self.conditions(f, i, checks, values)
        return SignalDecision(self.bot_id, f.symbol, start, end, all(checks.values()), checks, values)

    def evaluate_latest(self, candles: list[Candle], now: datetime,
                        frame: pd.DataFrame | None = None) -> tuple[SignalDecision | None, Features | None]:
        """Evaluate the most recent COMPLETED candle at `now`."""
        now = to_ist(now)
        completed = [c for c in candles if c.end <= now]
        if not completed:
            return None, None
        # `frame` (optional) lets a runner convert candles once per symbol and share it across bots
        use = frame if frame is not None and len(frame) == len(completed) else candles_to_frame(completed)
        f = self.features(use)
        d = self.evaluate_at(f, f.n - 1)
        stale = (now - completed[-1].end) > timedelta(minutes=self.p.candle_minutes)
        d.checks["fresh_candle"] = not stale
        d.signal = d.signal and not stale
        return d, f

    # ------------------------------------------------------------------ levels
    @abstractmethod
    def raw_levels(self, f: Features, i: int, entry: float) -> tuple[float | None, float | None, str]:
        """(raw_stop, raw_target_or_None, reason). Return stop None to reject."""

    def build_levels(self, f: Features, i: int, entry_price: float, tick: float) -> tuple[TradeLevels | None, str]:
        p = self.p
        entry = round_to_tick(entry_price, tick, "nearest")
        stop_raw, target_raw, reason = self.raw_levels(f, i, entry)
        if stop_raw is None:
            return None, reason
        if entry <= 0 or stop_raw >= entry:
            return None, "stop_not_below_entry"
        d = max(entry - stop_raw, p.min_stop_pct * entry)  # never tighter than the floor
        if d > p.max_stop_pct * entry + 1e-9:
            return None, "stop_distance_exceeds_max_pct"
        stop = round_to_tick(entry - d, tick, "down")
        d_eff = round(entry - stop, 4)
        if stop <= 0 or d_eff <= 0:
            return None, "invalid_stop"
        target_raw = entry + p.reward_risk * d_eff if target_raw is None else target_raw
        target = round_to_tick(target_raw, tick, "up")
        if target < entry + tick - 1e-9:
            return None, "target_not_above_entry"
        return TradeLevels(entry, d_eff, stop, target), "ok"

    # ------------------------------------------------------------------ exits on completed candles
    def exit_signal(self, f: Features, i: int) -> ExitReason | None:
        return None

    def is_squareoff_time(self, ts: datetime) -> bool:
        return to_ist(ts).time() >= self.p.forced_squareoff

    def entry_window_open(self, ts: datetime) -> bool:
        t = to_ist(ts).time()
        return self.p.entry_window_start <= t <= self.p.entry_window_end


class GuardState:
    """Per-bot, per-symbol entry caps and cooldowns (enforced identically in backtest/paper/live)."""

    def __init__(self) -> None:
        self.entries: dict[tuple[str, str, object], int] = {}
        self.last_exit: dict[tuple[str, str], tuple[datetime, float]] = {}

    def can_enter(self, bot: BotStrategy, symbol: str, now: datetime) -> tuple[bool, str]:
        p = self.p_of(bot)
        day = to_ist(now).date()
        if self.entries.get((bot.bot_id, symbol, day), 0) >= p.max_entries_per_symbol_per_day:
            return False, "max_entries_per_symbol_per_day"
        le = self.last_exit.get((bot.bot_id, symbol))
        if le:
            ts, net = le
            wait = max(p.cooldown_minutes_after_exit, p.cooldown_minutes_after_loss if net < 0 else 0)
            if wait and to_ist(now) < to_ist(ts) + timedelta(minutes=wait):
                return False, "cooldown_active"
        return True, "ok"

    @staticmethod
    def p_of(bot: BotStrategy) -> CommonParams:
        return bot.p

    def record_entry(self, bot_id: str, symbol: str, now: datetime) -> None:
        k = (bot_id, symbol, to_ist(now).date())
        self.entries[k] = self.entries.get(k, 0) + 1

    def record_exit(self, bot_id: str, symbol: str, ts: datetime, net_pnl: float) -> None:
        self.last_exit[(bot_id, symbol)] = (ts, net_pnl)
