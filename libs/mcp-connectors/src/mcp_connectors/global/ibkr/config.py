"""IBKR connection config from environment — never hardcode host/port/account."""

from __future__ import annotations

import os
from typing import Any, Literal

from pydantic import BaseModel, Field


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


class IBKRConnectionConfig(BaseModel):
    """Runtime config for TWS API / IB Gateway. Values come from env or connect() overrides."""

    host: str = Field(default_factory=lambda: _env("IBKR_HOST", "127.0.0.1"))
    port: int = Field(default_factory=lambda: _env_int("IBKR_PORT", 7497))  # 7497 paper TWS default
    client_id: int = Field(default_factory=lambda: _env_int("IBKR_CLIENT_ID", 1001))
    account_id: str = Field(default_factory=lambda: _env("IBKR_ACCOUNT_ID", ""))
    mode: Literal["paper", "live"] = Field(
        default_factory=lambda: "paper" if _env("IBKR_MODE", "paper").lower() != "live" else "live"
    )
    live_trading_enabled: bool = Field(
        default_factory=lambda: _env_bool("IBKR_LIVE_TRADING_ENABLED", False)
    )
    connect_timeout_seconds: float = Field(
        default_factory=lambda: float(_env("IBKR_CONNECT_TIMEOUT_SECONDS", "15") or "15")
    )
    connection_mode: Literal["tws_api", "ib_gateway", "mock"] = Field(
        default_factory=lambda: _env("IBKR_CONNECTION_MODE", "mock") or "mock"  # type: ignore[return-value]
    )
    use_mock: bool = True

    def masked_dict(self) -> dict[str, Any]:
        acct = self.account_id or ""
        masked = ("*" * max(0, len(acct) - 4)) + acct[-4:] if acct else ""
        return {
            "host": self.host,
            "port": self.port,
            "client_id": self.client_id,
            "account_id_masked": masked,
            "mode": self.mode,
            "live_trading_enabled": False if self.mode == "paper" else self.live_trading_enabled,
            "connect_timeout_seconds": self.connect_timeout_seconds,
            "connection_mode": self.connection_mode,
            "use_mock": self.use_mock,
        }

    @classmethod
    def from_env_and_overrides(cls, overrides: dict[str, Any] | None = None) -> IBKRConnectionConfig:
        cfg = cls()
        o = dict(overrides or {})
        if "host" in o and o["host"]:
            cfg.host = str(o["host"])
        if "port" in o and o["port"] is not None:
            cfg.port = int(o["port"])
        if "client_id" in o and o["client_id"] is not None:
            cfg.client_id = int(o["client_id"])
        if "account_id" in o:
            cfg.account_id = str(o.get("account_id") or "")
        if "mode" in o and str(o["mode"]).lower() in ("paper", "live"):
            cfg.mode = str(o["mode"]).lower()  # type: ignore[assignment]
        if "use_mock" in o:
            cfg.use_mock = bool(o["use_mock"])
        elif "demo" in o:
            cfg.use_mock = bool(o["demo"])
        elif _env("IBKR_USE_MOCK", "true").lower() in ("0", "false", "no", "off"):
            cfg.use_mock = False
        if "connection_mode" in o and o["connection_mode"]:
            cfg.connection_mode = str(o["connection_mode"])  # type: ignore[assignment]
        if cfg.use_mock:
            cfg.connection_mode = "mock"
        # Paper is always the secure default unless explicitly live + flagged
        if cfg.mode != "live" or not cfg.live_trading_enabled:
            cfg.mode = "paper"
            cfg.live_trading_enabled = False
        return cfg


# Well-known IB paper/live ports (documentation only — runtime still uses env)
IBKR_PAPER_TWS_PORT = 7497
IBKR_LIVE_TWS_PORT = 7496
IBKR_PAPER_GATEWAY_PORT = 4002
IBKR_LIVE_GATEWAY_PORT = 4001
