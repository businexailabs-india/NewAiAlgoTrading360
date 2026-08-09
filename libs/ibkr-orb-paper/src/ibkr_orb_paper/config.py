from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# TWS paper=7497, IB Gateway paper=4002
ALLOWED_PAPER_PORTS: frozenset[int] = frozenset({7497, 4002})


class RunMode(str, Enum):
    SIGNAL = "signal"
    DRY_RUN = "dry-run"
    PAPER = "paper"


class Settings(BaseSettings):
    """All strategy/risk/IBKR values from environment. Never hardcode credentials."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    dry_run: bool = True
    enable_paper_orders: str = "NO"  # must be exactly YES for paper submission

    ibkr_host: str = "127.0.0.1"
    ibkr_port: int = 7497
    ibkr_client_id: int = 17
    ibkr_paper_account_id: str = ""
    ibkr_base_currency: str = "USD"

    symbol: str = "SPY"
    security_type: str = "STK"
    exchange: str = "SMART"
    primary_exchange: str = "ARCA"
    currency: str = "USD"
    market_timezone: str = "America/New_York"

    bar_size: str = "15 mins"
    opening_range_minutes: int = 30
    ema_period: int = 50
    atr_period: int = 14
    volume_lookback: int = 20
    volume_multiplier: float = 1.20
    reward_risk_ratio: float = 1.50
    atr_stop_multiple: float = 1.0
    use_structural_stop: bool = True
    min_stop_distance_pct: float = 0.001
    limit_entry_offset_ticks: int = 1
    entry_timeout_seconds: int = 900
    min_tick: float = 0.01

    starting_equity: float = 2400.0
    max_capital_deployment_pct: float = 0.90
    risk_per_trade_pct: float = 0.0025
    max_trades_per_day: int = 2
    daily_loss_limit_pct: float = 0.0075
    weekly_loss_limit_pct: float = 0.02
    drawdown_reduce_risk_pct: float = 0.05
    drawdown_pause_pct: float = 0.10
    max_data_age_seconds: int = 30
    position_size_update: Literal["monthly", "daily"] = "monthly"
    allow_shorts: bool = False

    estimated_commission_per_share: float = 0.005
    estimated_slippage_per_share: float = 0.01

    sqlite_path: str = "data/ibkr_orb_paper.db"
    strategy_id: str = "ORB_REGIME_LONG_V1"
    kill_switch: bool = False

    @field_validator("enable_paper_orders", mode="before")
    @classmethod
    def _norm_flag(cls, v: object) -> str:
        return str(v or "NO").strip().upper()

    @property
    def paper_orders_flag_ok(self) -> bool:
        return self.enable_paper_orders == "YES"

    @property
    def is_paper_port(self) -> bool:
        return self.ibkr_port in ALLOWED_PAPER_PORTS

    def banner_mode(self, run_mode: RunMode) -> str:
        if run_mode == RunMode.SIGNAL:
            return "SIGNAL-ONLY MODE — no orders will be built or submitted"
        if run_mode == RunMode.DRY_RUN or self.dry_run:
            return "DRY-RUN MODE — brackets validated and persisted; no IBKR submit"
        if run_mode == RunMode.PAPER and self.can_submit_paper_orders():
            return "PAPER-ORDER MODE — submitting only to verified DU paper account"
        return "SAFE FALLBACK — paper submission blocked; operating as dry-run/signal"

    def can_submit_paper_orders(self) -> bool:
        """Hard gate: never True unless every mandatory check passes (account still verified at runtime)."""
        if self.dry_run:
            return False
        if not self.paper_orders_flag_ok:
            return False
        if not self.ibkr_paper_account_id.strip():
            return False
        if not self.ibkr_paper_account_id.strip().upper().startswith("DU"):
            return False
        if self.ibkr_paper_account_id.strip().upper().startswith("U") and not self.ibkr_paper_account_id.strip().upper().startswith("DU"):
            return False
        if not self.is_paper_port:
            return False
        return True

    def assert_not_live_account_id(self, account_id: str) -> None:
        aid = (account_id or "").strip().upper()
        if not aid:
            raise ValueError("Empty IBKR account ID — refusing to trade")
        if aid.startswith("U") and not aid.startswith("DU"):
            raise ValueError(f"Live account rejected ({aid[:2]}…): paper trading only")
        if not aid.startswith("DU"):
            raise ValueError("Non-paper account rejected: must begin with DU")
        configured = self.ibkr_paper_account_id.strip().upper()
        if not configured:
            raise ValueError("IBKR_PAPER_ACCOUNT_ID is not configured")
        if aid != configured:
            raise ValueError("Connected account does not match IBKR_PAPER_ACCOUNT_ID")


def load_settings() -> Settings:
    return Settings()
