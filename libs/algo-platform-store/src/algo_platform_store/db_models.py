"""SQLAlchemy models for Postgres persistence (Phase 1 optional; runtime defaults to memory)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class StrategyRow(Base):
    __tablename__ = "strategies"

    strategy_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    strategy_name: Mapped[str] = mapped_column(String(256))
    strategy_type: Mapped[str] = mapped_column(String(64))
    config_json: Mapped[str] = mapped_column(Text)
    live_trading_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    paper_trading_required: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PaperAccountRow(Base):
    __tablename__ = "paper_accounts"

    account_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    starting_balance: Mapped[float] = mapped_column(Float, default=1_000_000.0)
    cash_balance: Mapped[float] = mapped_column(Float, default=1_000_000.0)
    kill_switch_active: Mapped[bool] = mapped_column(Boolean, default=False)
