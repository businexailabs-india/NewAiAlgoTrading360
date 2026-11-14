"""Single authoritative Order Management System (one instance per account+mode).

Guarantees
* The order intent (with a unique correlation id) is persisted BEFORE any broker call.
* Every state transition is validated, persisted as an event, and idempotent (unique event keys).
* After an ambiguous timeout the broker is QUERIED by correlation id; an order is never blindly resubmitted.
* Fills are stored individually (unique fill keys); broker updates that go backwards are ignored.
* Protection: a single broker-side protective stop for the ACTUAL filled quantity. Targets / indicator exits are
  executed by cancel-then-sell sequencing, so two live sell orders can never over-close a long position.
* If protection cannot be established the position is flattened; if that fails the persistent kill switch is
  engaged and an operator alert is raised.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable
from uuid import uuid4

from tradex_bots.arbitration import CapitalAllocator
from tradex_bots.broker import (
    BrokerAdapter,
    BrokerError,
    BrokerOrder,
    BrokerOrderRequest,
    BrokerRejected,
    BrokerStatus,
    BrokerTimeout,
)
from tradex_bots.config import EngineConfig, ExecutionMode, ProtectionMode
from tradex_bots.costs import SLIPPAGE_SCENARIOS, Execution, FeeModel
from tradex_bots.instruments import Instrument, round_to_tick
from tradex_bots.models import ExitReason, Side
from tradex_bots.risk import OpenRisk, RiskEngine
from tradex_bots.sizing import risk_with_actual_fill
from tradex_bots.store import Store
from tradex_bots.timeutil import now_ist


class OrderState(str, Enum):
    CREATED = "CREATED"
    RISK_APPROVED = "RISK_APPROVED"
    SUBMITTING = "SUBMITTING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    PROTECTED = "PROTECTED"
    EXIT_PENDING = "EXIT_PENDING"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    UNKNOWN = "UNKNOWN"


S = OrderState
TRANSITIONS: dict[OrderState, set[OrderState]] = {
    S.CREATED: {S.RISK_APPROVED, S.REJECTED, S.CANCELLED},
    S.RISK_APPROVED: {S.SUBMITTING, S.CANCELLED, S.REJECTED},
    S.SUBMITTING: {S.ACKNOWLEDGED, S.PARTIALLY_FILLED, S.FILLED, S.REJECTED, S.UNKNOWN, S.CANCELLED},
    S.UNKNOWN: {S.ACKNOWLEDGED, S.PARTIALLY_FILLED, S.FILLED, S.REJECTED, S.CANCELLED},
    S.ACKNOWLEDGED: {S.PARTIALLY_FILLED, S.FILLED, S.REJECTED, S.CANCELLED, S.UNKNOWN},
    S.PARTIALLY_FILLED: {S.PARTIALLY_FILLED, S.FILLED, S.CANCELLED, S.PROTECTED, S.EXIT_PENDING, S.UNKNOWN},
    S.FILLED: {S.PROTECTED, S.EXIT_PENDING, S.CLOSED},
    S.PROTECTED: {S.EXIT_PENDING, S.CLOSED, S.UNKNOWN},
    S.EXIT_PENDING: {S.EXIT_PENDING, S.CLOSED, S.UNKNOWN},
    S.CLOSED: set(),
    S.CANCELLED: set(),
    S.REJECTED: set(),
}
TERMINAL = {S.CLOSED, S.CANCELLED, S.REJECTED}
LIVE_ORDER_STATES = {S.SUBMITTING, S.ACKNOWLEDGED, S.PARTIALLY_FILLED, S.UNKNOWN}


class InvalidTransition(Exception):
    pass


@dataclass
class ReconcileReport:
    ok: bool = True
    mismatches: list[str] = field(default_factory=list)
    unknown_orders: list[str] = field(default_factory=list)
    resolved: int = 0


@dataclass
class SubmitResult:
    intent_id: str
    state: OrderState
    note: str = ""


class OrderManager:
    PREFIX = "TX"

    def __init__(self, store: Store, broker: BrokerAdapter, cfg: EngineConfig, mode: ExecutionMode,
                 risk: RiskEngine, fees: FeeModel, allocator: CapitalAllocator | None = None,
                 live_guard: Callable[[], bool] | None = None,
                 alert: Callable[[str, dict], None] | None = None,
                 clock: Callable[[], datetime] = now_ist, flatten_on_daily_breach: bool = True):
        if cfg.protection_mode == ProtectionMode.SUPER_ORDER:
            raise NotImplementedError("SUPER_ORDER protection is adapter-level only; use SOFTWARE_EXIT_CONTROLLER")
        self.store, self.broker, self.cfg, self.mode = store, broker, cfg, mode
        self.risk, self.fees, self.allocator = risk, fees, allocator
        self.live_guard, self.clock = live_guard, clock
        self.alert = alert or self._default_alert
        self.flatten_on_daily_breach = flatten_on_daily_breach
        self.instruments: dict[str, Instrument] = {}
        self.on_position_closed: list[Callable[[dict, float], None]] = []
        self.recovered = False
        self.reconciled = True
        self.slip = SLIPPAGE_SCENARIOS[cfg.slippage_scenario]

    # ------------------------------------------------------------------ helpers
    @property
    def _scope(self) -> dict:
        return {"tenant_id": self.cfg.tenant_id, "account_id": self.cfg.account_id, "mode": self.mode.value}

    def _default_alert(self, kind: str, details: dict) -> None:
        self.store.risk_event(kind, "CRITICAL", details=details, **self._scope)
        self.store.health_event("oms_alert", kind, details, tenant_id=self.cfg.tenant_id,
                                account_id=self.cfg.account_id)

    def _correlation_id(self, dedupe_key: str, role: str) -> str:
        # Dhan: max 30 chars, [a-zA-Z0-9 _-]
        return f"{self.PREFIX}{role[0]}-{hashlib.sha1(dedupe_key.encode()).hexdigest()[:24]}"

    def intent(self, intent_id: str) -> sqlite3.Row:
        r = self.store.one("SELECT * FROM order_intents WHERE intent_id=?", (intent_id,))
        if r is None:
            raise KeyError(intent_id)
        return r

    def position(self, position_id: str) -> sqlite3.Row:
        r = self.store.one("SELECT * FROM trading_positions WHERE position_id=?", (position_id,))
        if r is None:
            raise KeyError(position_id)
        return r

    # ------------------------------------------------------------------ intents & transitions
    def create_intent(self, *, bot_id: str, strategy_version: str, config_hash: str, symbol: str, security_id: str,
                      side: Side, role: str, quantity: int, order_type: str, price: float = 0.0,
                      trigger_price: float = 0.0, parent_intent_id: str | None = None, dedupe_key: str,
                      signal_id: str | None = None, planned: dict | None = None, ref_price: float | None = None,
                      ref_bid: float | None = None, ref_ask: float | None = None) -> tuple[str, bool]:
        """Persist the order intent BEFORE any broker contact. Returns (intent_id, created)."""
        dedupe_key = f"{self.cfg.tenant_id}|{self.cfg.account_id}|{self.mode.value}|{dedupe_key}"  # tenant-scoped
        now = self.clock().isoformat()
        iid = str(uuid4())
        corr = self._correlation_id(dedupe_key, role)
        try:
            with self.store.tx() as c:
                c.execute(
                    "INSERT INTO order_intents(intent_id,tenant_id,account_id,mode,bot_id,strategy_version,config_hash,"
                    "symbol,security_id,side,role,parent_intent_id,quantity,order_type,price,trigger_price,ref_price,"
                    "ref_bid,ref_ask,correlation_id,dedupe_key,state,signal_id,planned,created_at,updated_at) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (iid, self.cfg.tenant_id, self.cfg.account_id, self.mode.value, bot_id, strategy_version,
                     config_hash, symbol, security_id, side.value, role, parent_intent_id, quantity, order_type,
                     price, trigger_price, ref_price, ref_bid, ref_ask, corr, dedupe_key, S.CREATED.value,
                     signal_id, json.dumps(planned or {}, default=str), now, now))
                c.execute("INSERT INTO order_events(intent_id,event_key,from_state,to_state,ts,payload) "
                          "VALUES(?,?,?,?,?,?)", (iid, f"{iid}:CREATED", None, S.CREATED.value, now, "{}"))
        except sqlite3.IntegrityError:
            existing = self.store.one("SELECT intent_id FROM order_intents WHERE dedupe_key=?", (dedupe_key,))
            self.store.audit("duplicate_intent_blocked", bot_id=bot_id, details={"dedupe_key": dedupe_key},
                             **self._scope)
            return (existing["intent_id"] if existing else ""), False
        return iid, True

    def transition(self, intent_id: str, to: OrderState, event_key: str, payload: dict | None = None,
                   updates: dict | None = None) -> bool:
        """Validated, persisted, idempotent. Returns False if this exact event was already applied."""
        with self.store.tx() as c:
            row = c.execute("SELECT state FROM order_intents WHERE intent_id=?", (intent_id,)).fetchone()
            if row is None:
                raise KeyError(intent_id)
            cur = OrderState(row["state"])
            if c.execute("SELECT 1 FROM order_events WHERE event_key=?", (event_key,)).fetchone():
                return False
            if to == cur and to not in (S.PARTIALLY_FILLED, S.EXIT_PENDING):
                return False
            if to not in TRANSITIONS[cur]:
                raise InvalidTransition(f"{cur.value} -> {to.value} not allowed")
            now = self.clock().isoformat()
            sets, vals = ["state=?", "updated_at=?", "row_version=row_version+1"], [to.value, now]
            for k, v in (updates or {}).items():
                sets.append(f"{k}=?")
                vals.append(v)
            c.execute(f"UPDATE order_intents SET {', '.join(sets)} WHERE intent_id=?", (*vals, intent_id))
            c.execute("INSERT INTO order_events(intent_id,event_key,from_state,to_state,ts,payload) VALUES(?,?,?,?,?,?)",
                      (intent_id, event_key, cur.value, to.value, now, json.dumps(payload or {}, default=str)))
        return True

    def approve(self, intent_id: str) -> bool:
        return self.transition(intent_id, S.RISK_APPROVED, f"{intent_id}:RISK_APPROVED")

    # ------------------------------------------------------------------ blocking conditions
    def entries_blocked(self) -> list[str]:
        reasons: list[str] = []
        if self.risk.kill_switch_active():
            reasons.append("kill_switch_active")
        if not self.recovered:
            reasons.append("startup_recovery_not_completed")
        if not self.reconciled:
            reasons.append("reconciliation_mismatch")
        unknown = self.store.one(
            "SELECT COUNT(*) n FROM order_intents WHERE tenant_id=? AND account_id=? AND mode=? "
            "AND state IN ('UNKNOWN','SUBMITTING')", tuple(self._scope.values()))
        if unknown["n"]:
            reasons.append("unknown_order_status")
        unprot = self.store.one(
            "SELECT COUNT(*) n FROM trading_positions WHERE tenant_id=? AND account_id=? AND mode=? "
            "AND state='OPEN' AND protection_status!='PROTECTED'", tuple(self._scope.values()))
        if unprot["n"]:
            reasons.append("unprotected_position")
        return reasons

    def open_positions(self) -> list[sqlite3.Row]:
        return self.store.query("SELECT * FROM trading_positions WHERE tenant_id=? AND account_id=? AND mode=? "
                                "AND state='OPEN'", tuple(self._scope.values()))

    def pending_entries(self) -> list[sqlite3.Row]:
        return self.store.query(
            "SELECT * FROM order_intents WHERE tenant_id=? AND account_id=? AND mode=? AND role='ENTRY' "
            "AND state IN ('CREATED','RISK_APPROVED','SUBMITTING','ACKNOWLEDGED','PARTIALLY_FILLED','UNKNOWN')",
            tuple(self._scope.values()))

    def open_risk_view(self, last_prices: dict[str, float]) -> list[OpenRisk]:
        return [OpenRisk(p["symbol"], p["quantity"], p["avg_price"], last_prices.get(p["symbol"], p["avg_price"]),
                         p["protection_status"] == "PROTECTED") for p in self.open_positions()]

    # ------------------------------------------------------------------ submission
    def submit(self, intent_id: str) -> SubmitResult:
        row = self.intent(intent_id)
        if OrderState(row["state"]) != S.RISK_APPROVED:
            return SubmitResult(intent_id, OrderState(row["state"]), "not_in_risk_approved_state")
        if row["role"] == "ENTRY":
            blocked = self.entries_blocked()
            if blocked:
                self.transition(intent_id, S.CANCELLED, f"{intent_id}:CANCELLED:blocked", {"blocked": blocked})
                self._release_reservation(intent_id)
                return SubmitResult(intent_id, S.CANCELLED, ",".join(blocked))
        # Authorisation gates ENTRIES only: protective/exit orders REDUCE risk and must work after expiry/kill switch.
        if self.mode == ExecutionMode.LIVE and row["role"] == "ENTRY" and (
                self.live_guard is None or not self.live_guard()):
            self.transition(intent_id, S.CANCELLED, f"{intent_id}:CANCELLED:live_not_authorised")
            self._release_reservation(intent_id)
            self.store.audit("live_order_blocked_unauthorised", **self._scope, details={"intent_id": intent_id})
            return SubmitResult(intent_id, S.CANCELLED, "live_not_authorised")

        # 1) SUBMITTING is committed BEFORE the broker call (crash-safe: recovery will query by correlation id)
        self.transition(intent_id, S.SUBMITTING, f"{intent_id}:SUBMITTING", updates={"submitted_at": self.clock().isoformat()})
        req = BrokerOrderRequest(
            correlation_id=row["correlation_id"], symbol=row["symbol"], security_id=row["security_id"] or "",
            side=Side(row["side"]), quantity=row["quantity"], order_type=row["order_type"],
            price=row["price"] or 0.0, trigger_price=row["trigger_price"] or 0.0)
        try:
            ack = self.broker.place_order(req)
        except BrokerRejected as e:
            self.transition(intent_id, S.REJECTED, f"{intent_id}:REJECTED:submit", {"error": str(e)})
            self._release_reservation(intent_id)
            return SubmitResult(intent_id, S.REJECTED, str(e))
        except BrokerTimeout as e:
            self.transition(intent_id, S.UNKNOWN, f"{intent_id}:UNKNOWN:timeout", {"error": str(e)})
            return self.resolve_unknown(intent_id)
        except BrokerError as e:
            # Not proven rejected: the safe assumption is "outcome unknown", never "retry".
            self.transition(intent_id, S.UNKNOWN, f"{intent_id}:UNKNOWN:error", {"error": str(e)})
            return self.resolve_unknown(intent_id)
        self.store.execute("UPDATE order_intents SET broker_order_id=? WHERE intent_id=?", (ack.order_id, intent_id))
        bo = self._fetch_order(intent_id, ack.order_id) or BrokerOrder(
            ack.order_id, row["correlation_id"], ack.status)
        self._apply_broker_order(intent_id, bo, None)
        return SubmitResult(intent_id, OrderState(self.intent(intent_id)["state"]))

    def resolve_unknown(self, intent_id: str) -> SubmitResult:
        """Query the broker by correlation id. NEVER resubmit from here."""
        row = self.intent(intent_id)
        try:
            bo = self.broker.get_order_by_correlation(row["correlation_id"])
        except BrokerError as e:
            self.store.health_event("order_status_unknown", "UNKNOWN", {"intent_id": intent_id, "error": str(e)},
                                    tenant_id=self.cfg.tenant_id, account_id=self.cfg.account_id)
            return SubmitResult(intent_id, OrderState(self.intent(intent_id)["state"]), "lookup_failed_still_unknown")
        if bo is None:
            # definitive: the broker has no record -> the order never arrived
            self.transition(intent_id, S.REJECTED, f"{intent_id}:REJECTED:not_found",
                            {"note": "not found at broker by correlation id; NOT auto-resubmitted"})
            self._release_reservation(intent_id)
            return SubmitResult(intent_id, S.REJECTED, "not_found_at_broker")
        self.store.execute("UPDATE order_intents SET broker_order_id=? WHERE intent_id=?", (bo.order_id, intent_id))
        self._apply_broker_order(intent_id, bo, None)
        return SubmitResult(intent_id, OrderState(self.intent(intent_id)["state"]), "resolved_from_broker")

    def _fetch_order(self, intent_id: str, order_id: str) -> BrokerOrder | None:
        try:
            return self.broker.get_order(order_id)
        except BrokerError:
            return None

    # ------------------------------------------------------------------ applying broker updates
    def _apply_broker_order(self, intent_id: str, bo: BrokerOrder, trades: list | None) -> None:
        row = self.intent(intent_id)
        cur = OrderState(row["state"])
        if cur in TERMINAL or cur == S.CLOSED:
            return
        if bo.filled_qty < (row["filled_qty"] or 0):
            self.store.health_event("out_of_order_broker_update", "IGNORED",
                                    {"intent_id": intent_id, "filled_qty": bo.filled_qty},
                                    tenant_id=self.cfg.tenant_id, account_id=self.cfg.account_id)
            return
        if trades is None:
            try:
                trades = [t for t in self.broker.list_trades() if t.order_id == bo.order_id]
            except BrokerError:
                trades = []
        with self.store.tx() as c:
            c.execute(
                "INSERT INTO broker_orders(broker_order_id,intent_id,tenant_id,account_id,correlation_id,status,"
                "filled_qty,avg_price,raw,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, account_id, broker_order_id) DO UPDATE "
                "SET status=excluded.status, filled_qty=excluded.filled_qty, avg_price=excluded.avg_price, "
                "updated_at=excluded.updated_at",
                (bo.order_id, intent_id, self.cfg.tenant_id, self.cfg.account_id, bo.correlation_id,
                 bo.status.value, bo.filled_qty, bo.avg_price, "{}", self.clock().isoformat()))
            for t in trades:
                c.execute(
                    "INSERT OR IGNORE INTO trade_fills(fill_key,intent_id,tenant_id,account_id,mode,bot_id,"
                    "broker_order_id,symbol,side,quantity,price,ts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (f"{self.cfg.tenant_id}:{self.cfg.account_id}:{self.mode.value}:{t.trade_id}", intent_id, self.cfg.tenant_id, self.cfg.account_id,
                     self.mode.value, row["bot_id"], bo.order_id, t.symbol, t.side.value, t.quantity, t.price,
                     t.ts.isoformat() if t.ts else None))
        fills = self.store.query("SELECT quantity,price FROM trade_fills WHERE intent_id=?", (intent_id,))
        fq = sum(f["quantity"] for f in fills)
        avg = (sum(f["quantity"] * f["price"] for f in fills) / fq) if fq else (bo.avg_price or None)
        filled = max(fq, bo.filled_qty)
        if filled and not fq and bo.avg_price:
            avg = bo.avg_price

        now = self.clock().isoformat()
        upd: dict = {"filled_qty": filled, "avg_price": avg}
        if bo.status in (BrokerStatus.PENDING, BrokerStatus.TRANSIT, BrokerStatus.TRIGGERED):
            to = S.PARTIALLY_FILLED if 0 < filled < row["quantity"] else S.ACKNOWLEDGED
        elif bo.status == BrokerStatus.PART_TRADED:
            to = S.PARTIALLY_FILLED
        elif bo.status == BrokerStatus.TRADED:
            to = S.FILLED
        elif bo.status in (BrokerStatus.CANCELLED, BrokerStatus.EXPIRED):
            to = S.FILLED if filled > 0 else S.CANCELLED  # remainder cancelled after a partial -> final qty
        else:
            to = S.FILLED if filled > 0 else S.REJECTED
        if to in (S.ACKNOWLEDGED, S.PARTIALLY_FILLED, S.FILLED) and not row["acked_at"]:
            upd["acked_at"] = now
        if filled and not row["first_fill_at"]:
            upd["first_fill_at"] = now
        key = f"{intent_id}:{bo.status.value}:{filled}:{avg}"
        if cur == S.PARTIALLY_FILLED and to == S.ACKNOWLEDGED:
            to = S.PARTIALLY_FILLED
        if cur in (S.PROTECTED, S.EXIT_PENDING) and to in (S.ACKNOWLEDGED, S.PARTIALLY_FILLED, S.FILLED):
            return  # entry already beyond fill states; late duplicate update
        try:
            changed = self.transition(intent_id, to, key, {"broker_status": bo.status.value, "error": bo.error}, upd)
        except InvalidTransition:
            # e.g. SUBMITTING->... handled; any other combination is a protocol anomaly: park + flag, don't guess
            self.store.dead_letter("oms.apply_broker_order", {"intent_id": intent_id, "status": bo.status.value,
                                                              "state": cur.value}, "invalid_transition",
                                   tenant_id=self.cfg.tenant_id, account_id=self.cfg.account_id)
            return
        if not changed and not (filled and filled != (row["filled_qty"] or 0)):
            return
        if not changed:
            self.store.execute("UPDATE order_intents SET filled_qty=?, avg_price=? WHERE intent_id=?",
                               (filled, avg, intent_id))
        self._after_update(intent_id)

    def _after_update(self, intent_id: str) -> None:
        row = self.intent(intent_id)
        state, role = OrderState(row["state"]), row["role"]
        if role == "ENTRY":
            if row["filled_qty"]:
                self._sync_position(row)
                self._settle_reservation(intent_id, "CONSUMED")
            elif state in (S.REJECTED, S.CANCELLED):
                self._release_reservation(intent_id)
        elif role in ("STOP", "EXIT"):
            parent = row["parent_intent_id"]
            pos_id = f"pos-{parent}"
            if state == S.FILLED:
                self._check_position_closed(pos_id)
            elif role == "STOP" and state == S.ACKNOWLEDGED:
                self._mark_protected(pos_id, intent_id)
            elif role == "STOP" and state in (S.REJECTED, S.CANCELLED):
                pos = self.store.one("SELECT * FROM trading_positions WHERE position_id=?", (pos_id,))
                # an exit_reason means WE cancelled the stop on purpose (request_exit): not a lost stop
                if pos and pos["state"] == "OPEN" and pos["protection_status"] == "PROTECTED" \
                        and pos["protective_intent_id"] == intent_id and not pos["exit_reason"] \
                        and not self._exit_in_flight(pos_id):
                    self.store.execute("UPDATE trading_positions SET protection_status='LOST' WHERE position_id=?",
                                       (pos_id,))
                    self.alert("protective_stop_lost", {"position_id": pos_id, "intent_id": intent_id})
                    self.request_exit(pos_id, ExitReason.EMERGENCY)
            elif role == "EXIT" and state in (S.REJECTED, S.CANCELLED):
                pos = self.store.one("SELECT * FROM trading_positions WHERE position_id=?", (pos_id,))
                if pos and pos["state"] == "OPEN" and not self._exit_in_flight(pos_id):
                    self.alert("exit_order_failed", {"position_id": pos_id, "intent_id": intent_id})
                    self.risk.engage_kill_switch("exit_order_failed_position_still_open", "system")

    # ------------------------------------------------------------------ positions
    def _sync_position(self, entry: sqlite3.Row) -> None:
        pos_id = f"pos-{entry['intent_id']}"
        planned = json.loads(entry["planned"] or "{}")
        qty, avg = entry["filled_qty"], entry["avg_price"] or entry["price"] or 0.0
        now = self.clock().isoformat()
        with self.store.tx() as c:
            r = c.execute("SELECT 1 FROM trading_positions WHERE position_id=?", (pos_id,)).fetchone()
            if r is None:
                c.execute(
                    "INSERT INTO trading_positions(position_id,tenant_id,account_id,mode,bot_id,strategy_version,"
                    "config_hash,symbol,security_id,quantity,avg_price,entry_ref_price,stop_price,target_price,"
                    "stop_distance,planned_risk,protection_status,entry_intent_id,state,opened_at,fee_version) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (pos_id, self.cfg.tenant_id, self.cfg.account_id, self.mode.value, entry["bot_id"],
                     entry["strategy_version"], entry["config_hash"], entry["symbol"], entry["security_id"], qty,
                     avg, entry["ref_price"], planned.get("stop_price"), planned.get("target_price"),
                     planned.get("stop_distance"), planned.get("planned_risk"), "UNPROTECTED", entry["intent_id"],
                     "OPEN", now, self.fees.version))
                c.execute("INSERT INTO position_events(position_id,ts,kind,details) VALUES(?,?,?,?)",
                          (pos_id, now, "OPENED", json.dumps({"qty": qty, "avg": avg})))
            else:
                c.execute("UPDATE trading_positions SET quantity=?, avg_price=?, row_version=row_version+1 "
                          "WHERE position_id=? AND state='OPEN'", (qty, avg, pos_id))

    def _mark_protected(self, pos_id: str, stop_intent_id: str) -> None:
        pos = self.store.one("SELECT * FROM trading_positions WHERE position_id=?", (pos_id,))
        if not pos or pos["state"] != "OPEN":
            return
        self.store.execute("UPDATE trading_positions SET protection_status='PROTECTED', protective_intent_id=? "
                           "WHERE position_id=?", (stop_intent_id, pos_id))
        entry_id = pos["entry_intent_id"]
        try:
            self.transition(entry_id, S.PROTECTED, f"{entry_id}:PROTECTED:{stop_intent_id}")
        except InvalidTransition:
            pass
        self.store.execute("INSERT INTO position_events(position_id,ts,kind,details) VALUES(?,?,?,?)",
                           (pos_id, self.clock().isoformat(), "PROTECTED", json.dumps({"stop_intent": stop_intent_id})))

    def _exit_in_flight(self, pos_id: str) -> bool:
        pos = self.position(pos_id)
        r = self.store.one(
            "SELECT COUNT(*) n FROM order_intents WHERE parent_intent_id=? AND role='EXIT' "
            "AND state IN ('CREATED','RISK_APPROVED','SUBMITTING','ACKNOWLEDGED','PARTIALLY_FILLED','UNKNOWN')",
            (pos["entry_intent_id"],))
        return bool(r["n"])

    def ensure_protection(self, position_id: str) -> bool:
        """Place ONE broker-side protective stop for the actual filled quantity (re-anchored on the real
        average fill). Flatten if protection cannot be established. Returns True if protected."""
        pos = self.position(position_id)
        if pos["state"] != "OPEN":
            return False
        if pos["protection_status"] == "PROTECTED":
            return True
        entry = self.intent(pos["entry_intent_id"])
        # freeze quantity: cancel any still-working remainder of the entry first
        if OrderState(entry["state"]) in (S.PARTIALLY_FILLED, S.ACKNOWLEDGED) and entry["broker_order_id"]:
            try:
                self.broker.cancel_order(entry["broker_order_id"])
            except BrokerError:
                pass
            bo = self._fetch_order(entry["intent_id"], entry["broker_order_id"])
            if bo is not None:
                self._apply_broker_order(entry["intent_id"], bo, None)
            entry = self.intent(entry["intent_id"])
            if OrderState(entry["state"]) not in (S.FILLED, S.PROTECTED):
                self.alert("entry_remainder_not_cancelled", {"position_id": position_id})
                return False
            pos = self.position(position_id)

        inst = self.instruments.get(pos["symbol"])
        tick = inst.tick_size if inst else 0.05
        planned = json.loads(entry["planned"] or "{}")
        qty, avg = pos["quantity"], pos["avg_price"]
        d = planned.get("stop_distance") or pos["stop_distance"]
        tdist = (planned.get("target_price", 0) - planned.get("entry_price", 0)) if planned.get("target_price") else 2 * d
        stop = round_to_tick(avg - d, tick, "down")
        target = round_to_tick(avg + tdist, tick, "up")
        self.store.execute("UPDATE trading_positions SET stop_price=?, target_price=? WHERE position_id=?",
                           (stop, target, position_id))
        loss = risk_with_actual_fill(qty, avg, stop, self.fees, self.slip, tick)
        budget = self.cfg.risk.risk_per_trade_inr
        if loss > budget * self.cfg.risk.post_fill_risk_tolerance:
            self.store.risk_event("post_fill_risk_exceeded", "CRITICAL", bot_id=pos["bot_id"] or "",
                                  details={"loss": loss, "budget": budget, "position_id": position_id},
                                  **self._scope)
            self.request_exit(position_id, ExitReason.EMERGENCY, skip_stop_cancel=True)
            return False

        dk = f"{position_id}:STOP:1"
        iid, created = self.create_intent(
            bot_id=pos["bot_id"] or "", strategy_version=pos["strategy_version"] or "",
            config_hash=pos["config_hash"] or "", symbol=pos["symbol"], security_id=pos["security_id"] or "",
            side=Side.SELL, role="STOP", quantity=qty, order_type="STOP_LOSS_MARKET", trigger_price=stop,
            parent_intent_id=entry["intent_id"], dedupe_key=dk, ref_price=stop)
        if not created and self.intent(iid)["state"] in ("REJECTED", "CANCELLED"):
            iid = None  # earlier protective attempt failed
        if iid is not None and created:
            self.approve(iid)
            res = self.submit(iid)
            ok = res.state in (S.ACKNOWLEDGED, S.PARTIALLY_FILLED, S.FILLED)
        else:
            ok = bool(iid) and OrderState(self.intent(iid)["state"]) in (S.ACKNOWLEDGED, S.FILLED)
        if not ok:
            self.alert("protection_failed_flattening", {"position_id": position_id})
            self.request_exit(position_id, ExitReason.EMERGENCY, skip_stop_cancel=True)
            return False
        return self.position(position_id)["protection_status"] == "PROTECTED"

    # ------------------------------------------------------------------ exits
    def request_exit(self, position_id: str, reason: ExitReason, skip_stop_cancel: bool = False,
                     ref_price: float | None = None) -> str:
        """Cancel-then-sell. Never places a sell while a protective stop may still be live."""
        pos = self.position(position_id)
        if pos["state"] != "OPEN":
            return "not_open"
        if self._exit_in_flight(position_id):
            return "exit_already_in_flight"
        entry_id = pos["entry_intent_id"]
        try:
            self.transition(entry_id, S.EXIT_PENDING, f"{entry_id}:EXIT_PENDING:{reason.value}")
        except InvalidTransition:
            pass
        self.store.execute("UPDATE trading_positions SET exit_reason=COALESCE(exit_reason, ?) WHERE position_id=?",
                           (reason.value, position_id))

        stop_id = pos["protective_intent_id"]
        if stop_id and not skip_stop_cancel:
            stop = self.intent(stop_id)
            if OrderState(stop["state"]) in LIVE_ORDER_STATES and stop["broker_order_id"]:
                try:
                    self.broker.cancel_order(stop["broker_order_id"])
                except BrokerError as e:
                    self.store.health_event("stop_cancel_failed", "RETRY", {"position_id": position_id, "error": str(e)},
                                            tenant_id=self.cfg.tenant_id, account_id=self.cfg.account_id)
                bo = self._fetch_order(stop_id, stop["broker_order_id"])
                if bo is None or not bo.status.terminal:
                    return "stop_cancel_unconfirmed"  # do NOT sell: could oversell a still-live stop
                self._apply_broker_order(stop_id, bo, None)
                if self.position(position_id)["state"] != "OPEN":
                    return "closed_by_stop"
        # guard against over-closing: never sell more than the broker says we hold
        sell_qty = pos["quantity"] - self._sold_qty(entry_id)
        try:
            for bp in self.broker.list_positions():
                if bp.symbol == pos["symbol"]:
                    sell_qty = min(sell_qty, max(bp.net_qty, 0))
        except BrokerError:
            pass
        if sell_qty <= 0:
            self._check_position_closed(position_id)
            return "nothing_to_sell"
        attempt = self.store.one("SELECT COUNT(*) n FROM order_intents WHERE parent_intent_id=? AND role='EXIT'",
                                 (entry_id,))["n"] + 1
        iid, created = self.create_intent(
            bot_id=pos["bot_id"] or "", strategy_version=pos["strategy_version"] or "",
            config_hash=pos["config_hash"] or "", symbol=pos["symbol"], security_id=pos["security_id"] or "",
            side=Side.SELL, role="EXIT", quantity=sell_qty, order_type="MARKET", parent_intent_id=entry_id,
            dedupe_key=f"{position_id}:EXIT:{attempt}", ref_price=ref_price or pos["target_price"],
            planned={"reason": reason.value})
        if not created:
            return "duplicate_exit_blocked"
        self.approve(iid)  # exits bypass entry risk gates: they REDUCE risk and must work under kill switch
        res = self.submit(iid)
        if res.state in (S.REJECTED, S.CANCELLED):
            self.alert("exit_submission_failed", {"position_id": position_id, "note": res.note})
            self.risk.engage_kill_switch("exit_submission_failed", "system")
        return f"exit_submitted:{res.state.value}"

    def _sold_qty(self, entry_id: str) -> int:
        r = self.store.one(
            "SELECT COALESCE(SUM(f.quantity),0) q FROM trade_fills f JOIN order_intents i ON i.intent_id=f.intent_id "
            "WHERE i.parent_intent_id=? AND f.side='SELL'", (entry_id,))
        return int(r["q"])

    def _check_position_closed(self, pos_id: str) -> None:
        pos = self.position(pos_id)
        if pos["state"] != "OPEN":
            return
        entry_id = pos["entry_intent_id"]
        if self._sold_qty(entry_id) < pos["quantity"]:
            # an exit order may have ended with a partial fill: re-issue for the residual (never blind)
            if not self._exit_in_flight(pos_id) and pos["exit_reason"] and not self._stop_live(pos):
                self.request_exit(pos_id, ExitReason(pos["exit_reason"]))
            return
        self._close_position(pos)

    def _stop_live(self, pos: sqlite3.Row) -> bool:
        sid = pos["protective_intent_id"]
        return bool(sid) and OrderState(self.intent(sid)["state"]) in LIVE_ORDER_STATES

    def _close_position(self, pos: sqlite3.Row) -> None:
        entry = self.intent(pos["entry_intent_id"])
        sells = self.store.query(
            "SELECT f.quantity q, f.price p, f.broker_order_id oid, i.role role, i.ref_price rp "
            "FROM trade_fills f JOIN order_intents i ON i.intent_id=f.intent_id "
            "WHERE i.parent_intent_id=? AND f.side='SELL'", (entry["intent_id"],))
        buys = self.store.query("SELECT quantity q, price p, broker_order_id oid FROM trade_fills WHERE intent_id=?",
                                (entry["intent_id"],))
        qty = pos["quantity"]
        exit_avg = sum(s["q"] * s["p"] for s in sells) / sum(s["q"] for s in sells)
        exit_ref = (sum(s["q"] * (s["rp"] or s["p"]) for s in sells) / sum(s["q"] for s in sells))
        entry_avg = pos["avg_price"]
        entry_ref = pos["entry_ref_price"] or entry_avg
        execs = [Execution(b["oid"] or "buy", Side.BUY, b["q"], b["p"]) for b in buys] + \
                [Execution(s["oid"] or "sell", Side.SELL, s["q"], s["p"]) for s in sells]
        charges = self.fees.charges(execs)
        ch = float(charges.total)
        net = qty * (exit_avg - entry_avg) - ch
        gross = qty * (exit_ref - entry_ref)
        slippage = gross - qty * (exit_avg - entry_avg)
        init_risk = qty * (pos["stop_distance"] or 0)
        r_mult = net / init_risk if init_risk else 0.0
        now = self.clock().isoformat()
        reason = pos["exit_reason"] or ("STOP_LOSS" if sells[-1]["role"] == "STOP" else "EXIT")
        with self.store.tx() as c:
            c.execute(
                "UPDATE trading_positions SET state='CLOSED', closed_at=?, exit_reason=?, exit_avg_price=?, "
                "exit_ref_price=?, gross_pnl=?, slippage_cost=?, charges=?, net_pnl=?, r_multiple=?, "
                "row_version=row_version+1 WHERE position_id=?",
                (now, reason, exit_avg, exit_ref, round(gross, 2), round(slippage, 2), round(ch, 2),
                 round(net, 2), round(r_mult, 3), pos["position_id"]))
            cf = charges.as_floats()
            c.execute(
                "INSERT OR REPLACE INTO trading_costs(position_id,tenant_id,account_id,mode,bot_id,fee_version,"
                "brokerage,stt,exchange_txn,sebi,stamp,gst,ipft,other,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (pos["position_id"], self.cfg.tenant_id, self.cfg.account_id, self.mode.value, pos["bot_id"],
                 self.fees.version, cf["brokerage"], cf["stt"], cf["exchange_txn"], cf["sebi"], cf["stamp"],
                 cf["gst"], cf["ipft"], cf["other"], cf["total"]))
            c.execute("INSERT INTO position_events(position_id,ts,kind,details) VALUES(?,?,?,?)",
                      (pos["position_id"], now, "CLOSED", json.dumps({"net": round(net, 2)})))
        try:
            self.transition(entry["intent_id"], S.CLOSED, f"{entry['intent_id']}:CLOSED")
        except InvalidTransition:
            pass
        breached = self.risk.record_closed_trade(self.clock(), gross, ch, net)
        closed = dict(self.position(pos["position_id"]))
        for cb in self.on_position_closed:
            cb(closed, net)
        if breached:
            self.store.audit("daily_loss_breach_safe_exit", bot_id=pos["bot_id"] or "", **self._scope,
                             details={"net": net})
            if self.flatten_on_daily_breach:
                self.flatten_all(ExitReason.DAILY_LOSS)

    # ------------------------------------------------------------------ monitoring hooks
    def on_price(self, symbol: str, price: float) -> list[str]:
        """Software target monitor (stop is broker-side). Returns actions taken."""
        acts = []
        for p in self.open_positions():
            if p["symbol"] == symbol and p["protection_status"] == "PROTECTED" and p["target_price"] \
                    and price >= p["target_price"] and not p["exit_reason"]:
                acts.append(self.request_exit(p["position_id"], ExitReason.TARGET, ref_price=p["target_price"]))
        return acts

    def exit_on_signal(self, symbol: str, reason: ExitReason, ref_price: float | None = None) -> list[str]:
        return [self.request_exit(p["position_id"], reason, ref_price=ref_price)
                for p in self.open_positions() if p["symbol"] == symbol]

    def flatten_all(self, reason: ExitReason = ExitReason.EMERGENCY) -> list[str]:
        """Emergency flatten: cancel working entries, then exit every open position."""
        out = []
        for e in self.pending_entries():
            if e["broker_order_id"] and OrderState(e["state"]) in LIVE_ORDER_STATES:
                try:
                    self.broker.cancel_order(e["broker_order_id"])
                except BrokerError:
                    pass
            elif OrderState(e["state"]) in (S.CREATED, S.RISK_APPROVED):
                self.transition(e["intent_id"], S.CANCELLED, f"{e['intent_id']}:CANCELLED:flatten")
                self._release_reservation(e["intent_id"])
        for p in self.open_positions():
            out.append(self.request_exit(p["position_id"], reason))
        self.store.audit("flatten_all", details={"reason": reason.value, "results": out}, **self._scope)
        return out

    def emergency_stop(self, by: str, reason: str) -> list[str]:
        self.risk.engage_kill_switch(reason, by)
        return self.flatten_all(ExitReason.EMERGENCY)

    # ------------------------------------------------------------------ polling / reconcile / recovery
    def poll(self) -> None:
        """Pull broker order status + tradebook for every non-terminal intent and apply (idempotent)."""
        rows = self.store.query(
            "SELECT * FROM order_intents WHERE tenant_id=? AND account_id=? AND mode=? "
            "AND state IN ('SUBMITTING','ACKNOWLEDGED','PARTIALLY_FILLED','UNKNOWN','PROTECTED','EXIT_PENDING','FILLED')",
            tuple(self._scope.values()))
        try:
            trades = self.broker.list_trades()
        except BrokerError:
            trades = []
        for r in rows:
            st = OrderState(r["state"])
            if r["role"] == "ENTRY" and st in (S.PROTECTED, S.EXIT_PENDING, S.FILLED):
                continue
            if st in (S.SUBMITTING, S.UNKNOWN) and not r["broker_order_id"]:
                self.resolve_unknown(r["intent_id"])
                continue
            if not r["broker_order_id"]:
                continue
            bo = self._fetch_order(r["intent_id"], r["broker_order_id"])
            if bo is not None:
                self._apply_broker_order(r["intent_id"], bo, [t for t in trades if t.order_id == bo.order_id])
        for p in self.open_positions():  # entry filled but not yet protected -> protect now
            if p["protection_status"] != "PROTECTED" and not p["exit_reason"]:
                self.ensure_protection(p["position_id"])

    def reconcile(self) -> ReconcileReport:
        rep = ReconcileReport()
        self.poll()
        try:
            local: dict[str, int] = {}
            for p in self.open_positions():
                local[p["symbol"]] = local.get(p["symbol"], 0) + p["quantity"] - self._sold_qty(p["entry_intent_id"])
            broker = {bp.symbol: bp.net_qty for bp in self.broker.list_positions() if bp.net_qty != 0}
            for sym in sorted(set(local) | set(broker)):
                if local.get(sym, 0) != broker.get(sym, 0):
                    rep.mismatches.append(f"position:{sym}:local={local.get(sym, 0)}:broker={broker.get(sym, 0)}")
            known = {r["correlation_id"] for r in self.store.query(
                "SELECT correlation_id FROM order_intents WHERE tenant_id=? AND account_id=? AND mode=?",
                tuple(self._scope.values()))}
            for bo in self.broker.list_orders():
                if bo.correlation_id.startswith(self.PREFIX) and bo.correlation_id not in known:
                    rep.unknown_orders.append(bo.order_id)
                    rep.mismatches.append(f"orphan_broker_order:{bo.order_id}")
        except BrokerError as e:
            rep.mismatches.append(f"broker_unreachable:{e}")
        rep.ok = not rep.mismatches
        self.reconciled = rep.ok
        if not rep.ok:
            self.store.risk_event("reconciliation_mismatch", "CRITICAL", details={"mismatches": rep.mismatches},
                                  **self._scope)
        return rep

    def recover(self) -> ReconcileReport:
        """Startup recovery: resolve in-flight orders and verify positions BEFORE the strategy may trade."""
        self.recovered = False
        for r in self.store.query(
                "SELECT intent_id FROM order_intents WHERE tenant_id=? AND account_id=? AND mode=? "
                "AND state IN ('SUBMITTING','UNKNOWN')", tuple(self._scope.values())):
            self.resolve_unknown(r["intent_id"])
        rep = self.reconcile()
        self.recovered = rep.ok
        self.store.audit("startup_recovery", details={"ok": rep.ok, "mismatches": rep.mismatches}, **self._scope)
        return rep

    # ------------------------------------------------------------------ capital reservation hooks
    def _release_reservation(self, intent_id: str) -> None:
        self._settle_reservation(intent_id, "RELEASED")

    def _settle_reservation(self, intent_id: str, status: str) -> None:
        if self.allocator is None:
            return
        r = self.store.one("SELECT reservation_id FROM capital_reservations WHERE intent_id=? AND status='ACTIVE'",
                           (intent_id,))
        if r:
            self.allocator.settle(r["reservation_id"], status)
