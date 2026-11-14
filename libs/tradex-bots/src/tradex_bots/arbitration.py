"""Capital reservations + deterministic multi-bot signal arbitration.

No AI scores are used: ordering is a fixed bot priority list, then symbol (alphabetical). All decisions,
including rejections and their reasons, are persisted to `bot_signals`.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from uuid import uuid4

from tradex_bots.bots.base import BotStrategy
from tradex_bots.config import ALL_BOT_IDS, EngineConfig, ExecutionMode
from tradex_bots.models import SignalDecision
from tradex_bots.store import Store
from tradex_bots.timeutil import now_ist


class CapitalAllocator:
    """Account-level capital reservation to prevent double allocation across bots."""

    def __init__(self, store: Store, cfg: EngineConfig, mode: ExecutionMode):
        self.store, self.cfg, self.mode = store, cfg, mode

    def _scope(self) -> tuple:
        return (self.cfg.tenant_id, self.cfg.account_id, self.mode.value)

    def active_reserved(self) -> float:
        r = self.store.one(
            "SELECT COALESCE(SUM(amount),0) s FROM capital_reservations "
            "WHERE tenant_id=? AND account_id=? AND mode=? AND status='ACTIVE'", self._scope())
        return float(r["s"])

    def available_after_reservations(self, funds: float) -> float:
        return max(0.0, funds - self.active_reserved())

    def reserve(self, bot_id: str, symbol: str, amount: float, funds: float, open_notional: float = 0.0,
                intent_id: str | None = None) -> str | None:
        """Atomically reserve `amount`; returns reservation_id or None if it would over-allocate."""
        risk = self.cfg.risk
        cap = risk.live_max_exposure_inr if self.mode == ExecutionMode.LIVE else risk.max_exposure_inr
        cap = min(cap, risk.max_exposure_inr)
        with self.store.tx() as c:
            s = c.execute(
                "SELECT COALESCE(SUM(amount),0) s FROM capital_reservations "
                "WHERE tenant_id=? AND account_id=? AND mode=? AND status='ACTIVE'", self._scope()).fetchone()["s"]
            if s + open_notional + amount > cap + 1e-9:
                return None
            if s + amount > funds - risk.fee_reserve_inr + 1e-9:
                return None
            rid = str(uuid4())
            c.execute(
                "INSERT INTO capital_reservations(reservation_id,tenant_id,account_id,mode,bot_id,symbol,amount,"
                "status,intent_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (rid, *self._scope(), bot_id, symbol, amount, "ACTIVE", intent_id, now_ist().isoformat()))
            return rid

    def settle(self, reservation_id: str, status: str = "RELEASED") -> None:
        """status: RELEASED (order rejected/cancelled) or CONSUMED (filled; funds now reflect the cash use)."""
        self.store.execute(
            "UPDATE capital_reservations SET status=?, released_at=? WHERE reservation_id=? AND status='ACTIVE'",
            (status, now_ist().isoformat(), reservation_id))

    def attach_intent(self, reservation_id: str, intent_id: str) -> None:
        self.store.execute("UPDATE capital_reservations SET intent_id=? WHERE reservation_id=?",
                           (intent_id, reservation_id))


@dataclass
class Candidate:
    bot: BotStrategy
    decision: SignalDecision


@dataclass
class ArbitrationResult:
    candidate: Candidate
    accepted: bool
    reasons: list[str] = field(default_factory=list)


class SignalArbiter:
    def __init__(self, store: Store, cfg: EngineConfig, mode: ExecutionMode,
                 live_enabled_bots: set[str] | None = None, priority: tuple[str, ...] = ALL_BOT_IDS):
        self.store, self.cfg, self.mode = store, cfg, mode
        self.live_enabled = set(live_enabled_bots or set())
        self.priority = {b: n for n, b in enumerate(priority)}

    def record_signal(self, d: SignalDecision, bot: BotStrategy, status: str, reasons: list[str]) -> bool:
        """Persist a decision. Returns False if this (account, mode, bot, symbol, candle) was already recorded."""
        c = self.cfg
        try:
            self.store.execute(
                "INSERT INTO bot_signals(ts,tenant_id,account_id,mode,bot_id,strategy_version,config_hash,symbol,"
                "candle_start,signal,status,reject_reasons,checks,values_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (now_ist().isoformat(), c.tenant_id, c.account_id, self.mode.value, d.bot_id, bot.version,
                 bot.config_hash, d.symbol, d.candle_start.isoformat(), int(d.signal), status,
                 json.dumps(reasons), json.dumps(d.checks), json.dumps(d.values, default=str)))
            return True
        except sqlite3.IntegrityError:
            return False

    def set_status(self, d: SignalDecision, status: str, reasons: list[str] | None = None) -> None:
        c = self.cfg
        self.store.execute(
            "UPDATE bot_signals SET status=?, reject_reasons=? WHERE tenant_id=? AND account_id=? AND mode=? "
            "AND bot_id=? AND symbol=? AND candle_start=?",
            (status, json.dumps(reasons or []), c.tenant_id, c.account_id, self.mode.value, d.bot_id, d.symbol,
             d.candle_start.isoformat()))

    def arbitrate(self, candidates: list[Candidate], *, held_symbols: set[str], pending_symbols: set[str],
                  open_count: int, pending_count: int) -> list[ArbitrationResult]:
        r = self.cfg.risk
        ordered = sorted(candidates, key=lambda x: (self.priority.get(x.decision.bot_id, 99), x.decision.symbol))
        results: list[ArbitrationResult] = []
        claimed_symbols: set[str] = set()
        accepted = 0
        live = self.mode == ExecutionMode.LIVE
        for cand in ordered:
            d = cand.decision
            reasons: list[str] = []
            if live and len(self.live_enabled) > r.max_live_enabled_bots:
                reasons.append("multiple_live_bots_configured")
            elif live and d.bot_id not in self.live_enabled:
                reasons.append("bot_not_live_enabled")
            if d.symbol in held_symbols or d.symbol in pending_symbols:
                reasons.append("symbol_position_or_order_exists")
            if d.symbol in claimed_symbols:
                reasons.append("symbol_claimed_by_other_bot_this_cycle")
            if open_count + accepted >= r.max_open_positions:
                reasons.append("account_position_limit")
            if pending_count + accepted >= 1:
                reasons.append("account_pending_order_lock")
            if not reasons and not self.record_signal(d, cand.bot, "ACCEPTED", []):
                reasons.append("duplicate_signal")
            if reasons:
                self.record_signal(d, cand.bot, "REJECTED", reasons)  # first record wins (unique constraint)
                results.append(ArbitrationResult(cand, False, reasons))
            else:
                claimed_symbols.add(d.symbol)
                accepted += 1
                results.append(ArbitrationResult(cand, True, []))
        return results
