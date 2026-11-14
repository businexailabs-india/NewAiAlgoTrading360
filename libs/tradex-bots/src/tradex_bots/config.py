"""Typed, validated configuration. Nothing here enables live trading."""

from __future__ import annotations

import os
from datetime import time
from enum import Enum

from pydantic import BaseModel, Field, model_validator

PLATFORM_VERSION = "1.0.0"

BOT_01 = "BOT_01_VWAP_EMA_VOLUME"
BOT_02 = "BOT_02_OPENING_RANGE_BREAKOUT"
BOT_03 = "BOT_03_EMA_CROSSOVER"
BOT_04 = "BOT_04_RSI_MEAN_REVERSION"
BOT_05 = "BOT_05_SUPERTREND_ADX"
BOT_06 = "BOT_06_VWAP_PULLBACK_VOLUME"
ALL_BOT_IDS = (BOT_01, BOT_02, BOT_03, BOT_04, BOT_05, BOT_06)


class ExecutionMode(str, Enum):
    BACKTEST = "BACKTEST"
    PAPER = "PAPER"
    LIVE = "LIVE"


class CommonParams(BaseModel):
    """Parameters shared by every bot (session, liquidity, execution hygiene). All are research parameters."""

    candle_minutes: int = 5
    session_open: time = time(9, 15)
    session_close: time = time(15, 30)
    entry_window_start: time = time(9, 35)  # compared against the signal candle's CLOSE time
    entry_window_end: time = time(14, 30)  # inclusive; no new entries after this
    forced_squareoff: time = time(15, 15)
    entry_grace_seconds: int = 30  # execution latency allowance after the signal candle's close

    reward_risk: float = 2.0
    min_stop_pct: float = 0.005  # floor on stop distance as a fraction of price (all bots)
    max_stop_pct: float = 0.015  # reject trades needing a wider stop
    atr_period: int = 14
    volume_lookback: int = 20
    volume_scope: str = "continuous"  # "continuous" | "session"
    warmup_bars: int = 100  # EMA/ATR/RSI seed influence is negligible after this many bars

    min_price: float = 50.0
    min_avg_candle_turnover_inr: float = 1_000_000.0
    max_spread_bps: float = 10.0
    max_entry_deviation_pct: float = 0.5  # skip if next price ran away from the signal close
    stale_data_seconds: int = 20

    max_entries_per_symbol_per_day: int = 1
    cooldown_minutes_after_exit: int = 0
    cooldown_minutes_after_loss: int = 0

    @model_validator(mode="after")
    def _sanity(self) -> "CommonParams":
        if self.volume_scope not in ("continuous", "session"):
            raise ValueError("volume_scope must be 'continuous' or 'session'")
        if self.min_stop_pct > self.max_stop_pct:
            raise ValueError("min_stop_pct must be <= max_stop_pct")
        if self.entry_window_start >= self.entry_window_end:
            raise ValueError("entry window start must precede end")
        if self.entry_window_end > self.forced_squareoff:
            raise ValueError("entries must end before forced square-off")
        return self


class RiskConfig(BaseModel):
    """Account-level limits for a Rs 20,000 account. Rs 100 is a TOTAL (fee-inclusive) loss budget."""

    capital_inr: float = 20_000.0
    risk_per_trade_inr: float = 100.0
    daily_loss_cutoff_inr: float = 200.0
    max_exposure_inr: float = 18_000.0
    max_entries_per_day: int = 2
    max_open_positions: int = 1
    max_order_quantity: int = 5_000
    fee_reserve_inr: float = 50.0  # cash held back from sizing for charges
    min_net_reward_inr: float = 20.0
    max_cost_to_reward_ratio: float = 0.35  # round-trip costs / gross reward at target
    reject_if_projected_daily_breach: bool = True
    post_fill_risk_tolerance: float = 1.25  # flatten if risk at ACTUAL fill exceeds budget x this
    # Controlled-live caps (applied only in LIVE mode)
    live_max_exposure_inr: float = 5_000.0
    live_symbol_allowlist: list[str] = Field(default_factory=list)  # live starts with ONE stock
    max_live_enabled_bots: int = 1

    @model_validator(mode="after")
    def _sanity(self) -> "RiskConfig":
        if self.max_exposure_inr > self.capital_inr:
            raise ValueError("max_exposure_inr cannot exceed capital (no leverage in v1)")
        if self.risk_per_trade_inr <= 0 or self.daily_loss_cutoff_inr < self.risk_per_trade_inr:
            raise ValueError("invalid risk budget")
        return self


class ProtectionMode(str, Enum):
    SOFTWARE_EXIT_CONTROLLER = "SOFTWARE_EXIT_CONTROLLER"  # one broker SL order + reconciled software target
    SUPER_ORDER = "SUPER_ORDER"  # Dhan linked entry+target+SL (adapter-level, unverified against sandbox)


class EngineConfig(BaseModel):
    """Account scope + risk. `account_id` is the single authoritative risk ledger for that account."""

    risk: RiskConfig = Field(default_factory=RiskConfig)
    slippage_scenario: str = "base"
    protection_mode: ProtectionMode = ProtectionMode.SOFTWARE_EXIT_CONTROLLER
    tenant_id: str = "default-tenant"
    account_id: str = "default-account"


def live_trading_env_enabled() -> bool:
    """Live is OFF unless the operator explicitly sets this env var. Necessary, never sufficient."""
    return os.getenv("TRADEX_LIVE_ENABLED", "false").strip().lower() in ("1", "true", "yes", "on")
