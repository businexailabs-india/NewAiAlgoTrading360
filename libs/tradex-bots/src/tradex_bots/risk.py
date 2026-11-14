"""Central, account-level risk engine: gates every entry, tracks the daily loss budget, owns the kill switch.

One RiskEngine per (tenant, account, mode). For LIVE this is the single authoritative ledger shared by all bots.
Paper bots each get their own account_id (separate virtual ledgers).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from tradex_bots.config import CommonParams, EngineConfig, ExecutionMode
from tradex_bots.costs import SLIPPAGE_SCENARIOS, FeeModel, SlippageScenario
from tradex_bots.instruments import Instrument
from tradex_bots.models import Quote, TradeLevels
from tradex_bots.sizing import SizingResult, size_position
from tradex_bots.store import Store
from tradex_bots.timeutil import at, ist_date, to_ist


@dataclass
class Health:
    """Verified backend statuses. Anything False blocks NEW entries (exits are never blocked)."""

    data_fresh: bool = True
    feed_connected: bool = True
    broker_connected: bool = True
    reconciled: bool = True
    instrument_valid: bool = True
    orders_known: bool = True
    protection_known: bool = True

    def problems(self) -> list[str]:
        return [f"health:{k}" for k, v in self.__dict__.items() if not v]


@dataclass
class OpenRisk:
    symbol: str
    quantity: int
    avg_price: float
    last_price: float
    protected: bool = True


@dataclass
class EntryRequest:
    bot_id: str
    symbol: str
    instrument: Instrument
    levels: TradeLevels
    params: CommonParams
    now: datetime
    available_funds: float  # broker/virtual funds AFTER other bots' capital reservations
    health: Health = field(default_factory=Health)
    quote: Quote | None = None
    open_positions: list[OpenRisk] = field(default_factory=list)
    pending_entry_orders: int = 0
    require_quote: bool = False  # live/paper-with-quotes must have a quote for the spread check


@dataclass
class RiskDecision:
    approved: bool
    reasons: list[str] = field(default_factory=list)
    sizing: SizingResult | None = None
    daily_loss_exposure: float = 0.0


class RiskEngine:
    def __init__(self, cfg: EngineConfig, store: Store, fees: FeeModel, mode: ExecutionMode):
        self.cfg, self.store, self.fees, self.mode = cfg, store, fees, mode
        self.slippage: SlippageScenario = SLIPPAGE_SCENARIOS[cfg.slippage_scenario]
        self.log_rejections = True  # backtests disable per-rejection DB rows (they count reasons instead)

    def _scope(self) -> dict:
        return {"tenant_id": self.cfg.tenant_id, "account_id": self.cfg.account_id, "mode": self.mode.value}

    # ------------------------------------------------------------------ kill switch (persistent)
    def kill_switch_active(self) -> bool:
        c = self.cfg
        return self.store.get_flag(c.tenant_id, c.account_id, "kill_switch", "OFF") == "ON"

    def engage_kill_switch(self, reason: str, by: str = "system") -> None:
        c = self.cfg
        self.store.set_flag(c.tenant_id, c.account_id, "kill_switch", "ON", by, reason)
        self.store.audit("kill_switch_engaged", actor=by, details={"reason": reason}, **self._scope())
        self.store.risk_event("kill_switch", "CRITICAL", details={"reason": reason, "by": by}, **self._scope())

    def release_kill_switch(self, by: str, reason: str) -> None:
        if not by or by == "system":
            raise PermissionError("kill switch can only be released by an identified operator")
        c = self.cfg
        self.store.set_flag(c.tenant_id, c.account_id, "kill_switch", "OFF", by, reason)
        self.store.audit("kill_switch_released", actor=by, details={"reason": reason}, **self._scope())

    # ------------------------------------------------------------------ daily accounting
    def _day(self, now: datetime):
        c = self.cfg
        return self.store.daily_row(c.tenant_id, c.account_id, self.mode.value, ist_date(now).isoformat())

    def daily_state(self, now: datetime) -> dict:
        return dict(self._day(now))

    def daily_loss_exposure(self, now: datetime, open_positions: list[OpenRisk], pending_entry_orders: int = 0) -> float:
        """Realised net loss + unrealised losses + estimated closing costs + outstanding order risk."""
        row = self._day(now)
        exposure = max(0.0, -float(row["realized_net"]))
        for p in open_positions:
            unreal = (p.last_price - p.avg_price) * p.quantity
            est_charges = float(self.fees.round_trip(p.quantity, p.avg_price, p.last_price).total)
            exposure += max(0.0, -unreal) + est_charges
        exposure += pending_entry_orders * self.cfg.risk.risk_per_trade_inr
        return round(exposure, 2)

    def record_entry(self, now: datetime) -> None:
        c = self.cfg
        self._day(now)
        self.store.execute(
            "UPDATE daily_account_pnl SET entries=entries+1 WHERE tenant_id=? AND account_id=? AND mode=? AND trade_date=?",
            (c.tenant_id, c.account_id, self.mode.value, ist_date(now).isoformat()),
        )

    def record_closed_trade(self, now: datetime, gross: float, charges: float, net: float) -> bool:
        """Record realised P&L. Returns True if the daily loss budget is now breached (caller must stop entries
        and run the configured safe-exit procedure)."""
        c = self.cfg
        self._day(now)
        self.store.execute(
            "UPDATE daily_account_pnl SET realized_net=realized_net+?, gross=gross+?, charges=charges+? "
            "WHERE tenant_id=? AND account_id=? AND mode=? AND trade_date=?",
            (net, gross, charges, c.tenant_id, c.account_id, self.mode.value, ist_date(now).isoformat()),
        )
        return self.evaluate_daily_lock(now, [])

    def evaluate_daily_lock(self, now: datetime, open_positions: list[OpenRisk]) -> bool:
        """Lock new entries for the day once the loss budget is consumed. Returns True if locked."""
        c = self.cfg
        row = self._day(now)
        if row["locked"]:
            return True
        exposure = self.daily_loss_exposure(now, open_positions)
        if exposure >= c.risk.daily_loss_cutoff_inr:
            self.store.execute(
                "UPDATE daily_account_pnl SET locked=1, lock_reason=? WHERE tenant_id=? AND account_id=? "
                "AND mode=? AND trade_date=?",
                (f"daily_loss_cutoff:{exposure}", c.tenant_id, c.account_id, self.mode.value,
                 ist_date(now).isoformat()),
            )
            self.store.risk_event("daily_loss_cutoff", "CRITICAL",
                                  details={"exposure": exposure, "cutoff": c.risk.daily_loss_cutoff_inr},
                                  **self._scope())
            return True
        return False

    # ------------------------------------------------------------------ entry gate
    def check_entry(self, req: EntryRequest) -> RiskDecision:
        r, p = self.cfg.risk, req.params
        reasons: list[str] = []
        now = to_ist(req.now)
        live = self.mode == ExecutionMode.LIVE

        if self.kill_switch_active():
            reasons.append("kill_switch_active")
        reasons += req.health.problems()
        row = self._day(now)
        if row["locked"]:
            reasons.append("daily_risk_locked")
        if int(row["entries"]) >= r.max_entries_per_day:
            reasons.append("max_entries_per_day_reached")
        if len(req.open_positions) >= r.max_open_positions:
            reasons.append("open_position_exists")
        if any(not op.protected for op in req.open_positions):
            reasons.append("unprotected_position_exists")
        if req.pending_entry_orders > 0:
            reasons.append("pending_entry_exists")

        window_end = at(now.date(), p.entry_window_end) + timedelta(seconds=p.entry_grace_seconds)
        if not (at(now.date(), p.entry_window_start) <= now <= window_end):
            reasons.append("outside_entry_window")

        if live and not r.live_symbol_allowlist:
            reasons.append("live_symbol_allowlist_empty")
        elif live and req.symbol not in r.live_symbol_allowlist:
            reasons.append("live_symbol_not_allowlisted")

        reasons += [f"instrument:{x}" for x in req.instrument.validate()]

        if req.quote is None:
            if req.require_quote or live:
                reasons.append("quote_unavailable")
        else:
            if (now - to_ist(req.quote.ts)).total_seconds() > p.stale_data_seconds:
                reasons.append("quote_stale")
            sp = req.quote.spread_bps
            if sp is None and (req.require_quote or live):
                reasons.append("spread_unknown")
            elif sp is not None and sp > p.max_spread_bps:
                reasons.append("spread_too_wide")
            ref = req.quote.ask or req.quote.ltp
            if abs(ref - req.levels.entry_price) / req.levels.entry_price * 100 > p.max_entry_deviation_pct:
                reasons.append("price_deviated_from_signal")

        exposure = self.daily_loss_exposure(now, req.open_positions, req.pending_entry_orders)
        if exposure >= r.daily_loss_cutoff_inr:
            reasons.append("daily_loss_cutoff_breached")

        sizing = None
        if not reasons:
            sizing = size_position(
                req.levels, available_funds=req.available_funds, risk=r, fees=self.fees,
                slippage=self.slippage, tick=req.instrument.tick_size, live=live,
            )
            if not sizing.approved:
                reasons.append(f"sizing:{sizing.reason}")
            elif sizing.quantity > r.max_order_quantity:
                reasons.append("max_order_quantity_exceeded")
            elif r.reject_if_projected_daily_breach and exposure + sizing.projected_loss_at_stop > r.daily_loss_cutoff_inr + 1e-9:
                reasons.append("projected_daily_loss_breach")

        approved = not reasons
        if not approved and self.log_rejections:
            self.store.risk_event("entry_rejected", "INFO", bot_id=req.bot_id,
                                  details={"symbol": req.symbol, "reasons": reasons}, **self._scope())
        return RiskDecision(approved, reasons, sizing, exposure)
