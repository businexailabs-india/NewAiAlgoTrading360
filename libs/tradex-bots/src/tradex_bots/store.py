"""Transactional persistence (SQLite for dev/test/standalone; Postgres is the production system of record).

The schema here mirrors backend/prisma/migrations/20261114100000_algo_trading_bots/migration.sql table-for-table
(column names identical). Idempotency is enforced by UNIQUE constraints, not application checks alone:
duplicate signals, correlation ids, broker events and fills are all rejected by the database.
Audit records are hash-chained (tamper-evident) and the table rejects UPDATE/DELETE via triggers.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

from tradex_bots.timeutil import now_ist

SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT, account_id TEXT, mode TEXT,
  bot_id TEXT, actor TEXT, action TEXT NOT NULL, details TEXT, prev_hash TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS audit_events_no_update BEFORE UPDATE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_events_no_delete BEFORE DELETE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

CREATE TABLE IF NOT EXISTS risk_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT, account_id TEXT, mode TEXT,
  bot_id TEXT, kind TEXT NOT NULL, severity TEXT NOT NULL, details TEXT);
CREATE TABLE IF NOT EXISTS control_flags(
  tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT, reason TEXT, PRIMARY KEY(tenant_id, account_id, key));

CREATE TABLE IF NOT EXISTS algo_bots(
  tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, bot_id TEXT NOT NULL, name TEXT, strategy_type TEXT,
  status TEXT NOT NULL DEFAULT 'STOPPED', execution_mode TEXT NOT NULL DEFAULT 'PAPER',
  live_enabled INTEGER NOT NULL DEFAULT 0, version TEXT, config_json TEXT, config_hash TEXT,
  updated_at TEXT, updated_by TEXT, row_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(tenant_id, account_id, bot_id));

CREATE TABLE IF NOT EXISTS bot_signals(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT NOT NULL, account_id TEXT NOT NULL,
  mode TEXT NOT NULL, bot_id TEXT NOT NULL, strategy_version TEXT, config_hash TEXT, symbol TEXT NOT NULL,
  candle_start TEXT NOT NULL, signal INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'GENERATED',
  reject_reasons TEXT, checks TEXT, values_json TEXT,
  UNIQUE(tenant_id, account_id, mode, bot_id, symbol, candle_start));

CREATE TABLE IF NOT EXISTS order_intents(
  intent_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, mode TEXT NOT NULL,
  bot_id TEXT, strategy_version TEXT, config_hash TEXT, symbol TEXT NOT NULL, security_id TEXT,
  side TEXT NOT NULL, role TEXT NOT NULL, parent_intent_id TEXT, quantity INTEGER NOT NULL,
  order_type TEXT NOT NULL, price REAL, trigger_price REAL, ref_price REAL, ref_bid REAL, ref_ask REAL,
  correlation_id TEXT NOT NULL UNIQUE, dedupe_key TEXT NOT NULL UNIQUE, state TEXT NOT NULL,
  filled_qty INTEGER NOT NULL DEFAULT 0, avg_price REAL, broker_order_id TEXT, signal_id TEXT,
  planned TEXT, created_at TEXT NOT NULL, submitted_at TEXT, acked_at TEXT, first_fill_at TEXT,
  updated_at TEXT NOT NULL, row_version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS ix_intents_acct_state ON order_intents(tenant_id, account_id, mode, state);
CREATE TABLE IF NOT EXISTS order_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, intent_id TEXT NOT NULL REFERENCES order_intents(intent_id),
  event_key TEXT NOT NULL UNIQUE, from_state TEXT, to_state TEXT NOT NULL, ts TEXT NOT NULL, payload TEXT);
CREATE TRIGGER IF NOT EXISTS order_events_no_update BEFORE UPDATE ON order_events
  BEGIN SELECT RAISE(ABORT, 'order_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS order_events_no_delete BEFORE DELETE ON order_events
  BEGIN SELECT RAISE(ABORT, 'order_events is append-only'); END;
CREATE TABLE IF NOT EXISTS broker_orders(
  broker_order_id TEXT NOT NULL, intent_id TEXT, tenant_id TEXT NOT NULL, account_id TEXT NOT NULL,
  correlation_id TEXT, status TEXT, filled_qty INTEGER, avg_price REAL, raw TEXT, updated_at TEXT,
  PRIMARY KEY(tenant_id, account_id, broker_order_id));
CREATE TABLE IF NOT EXISTS trade_fills(
  fill_key TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES order_intents(intent_id), tenant_id TEXT,
  account_id TEXT, mode TEXT, bot_id TEXT, broker_order_id TEXT, symbol TEXT, side TEXT,
  quantity INTEGER NOT NULL, price REAL NOT NULL, ts TEXT);
CREATE INDEX IF NOT EXISTS ix_fills_intent ON trade_fills(intent_id);

CREATE TABLE IF NOT EXISTS trading_positions(
  position_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, mode TEXT NOT NULL,
  bot_id TEXT, strategy_version TEXT, config_hash TEXT, symbol TEXT NOT NULL, security_id TEXT,
  quantity INTEGER NOT NULL, avg_price REAL NOT NULL, entry_ref_price REAL, stop_price REAL, target_price REAL,
  stop_distance REAL, planned_risk REAL, protection_status TEXT NOT NULL, protective_intent_id TEXT,
  entry_intent_id TEXT, state TEXT NOT NULL, opened_at TEXT, closed_at TEXT, exit_reason TEXT,
  exit_avg_price REAL, exit_ref_price REAL, gross_pnl REAL, slippage_cost REAL, charges REAL, net_pnl REAL,
  r_multiple REAL, last_price REAL, unrealized_pnl REAL, fee_version TEXT, row_version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS ix_positions_acct ON trading_positions(tenant_id, account_id, mode, state);
CREATE INDEX IF NOT EXISTS ix_positions_bot ON trading_positions(tenant_id, bot_id, mode, closed_at);
CREATE TABLE IF NOT EXISTS position_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, position_id TEXT NOT NULL REFERENCES trading_positions(position_id),
  ts TEXT NOT NULL, kind TEXT NOT NULL, details TEXT);
CREATE TABLE IF NOT EXISTS trading_costs(
  position_id TEXT PRIMARY KEY REFERENCES trading_positions(position_id), tenant_id TEXT, account_id TEXT,
  mode TEXT, bot_id TEXT, fee_version TEXT, brokerage REAL, stt REAL, exchange_txn REAL, sebi REAL, stamp REAL,
  gst REAL, ipft REAL, other REAL, total REAL, contract_note_total REAL, reconciled INTEGER);
CREATE TABLE IF NOT EXISTS capital_reservations(
  reservation_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, mode TEXT NOT NULL,
  bot_id TEXT NOT NULL, symbol TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL,
  intent_id TEXT, created_at TEXT NOT NULL, released_at TEXT);
CREATE INDEX IF NOT EXISTS ix_resv_active ON capital_reservations(tenant_id, account_id, mode, status);
CREATE TABLE IF NOT EXISTS daily_account_pnl(
  tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, mode TEXT NOT NULL, trade_date TEXT NOT NULL,
  entries INTEGER NOT NULL DEFAULT 0, realized_net REAL NOT NULL DEFAULT 0, gross REAL NOT NULL DEFAULT 0,
  charges REAL NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, lock_reason TEXT,
  PRIMARY KEY(tenant_id, account_id, mode, trade_date));
CREATE TABLE IF NOT EXISTS portfolio_snapshots(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT, account_id TEXT, mode TEXT,
  cash REAL, exposure REAL, realized_net REAL, unrealized REAL, open_positions INTEGER);
CREATE TABLE IF NOT EXISTS live_approvals(
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT, account_id TEXT, bot_id TEXT, operator TEXT NOT NULL,
  approved_at TEXT NOT NULL, valid_until TEXT NOT NULL, scope TEXT, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS role_assignments(
  tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_admin','trading_admin','trader','risk_manager','viewer')),
  granted_by TEXT NOT NULL, granted_at TEXT NOT NULL, revoked_at TEXT, PRIMARY KEY(tenant_id, user_id));
CREATE TABLE IF NOT EXISTS paper_accounts(
  tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, bot_id TEXT NOT NULL, starting_balance REAL NOT NULL,
  cash REAL NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(tenant_id, account_id, bot_id));

CREATE TABLE IF NOT EXISTS backtest_runs(
  run_id TEXT PRIMARY KEY, tenant_id TEXT, account_id TEXT, bot_id TEXT NOT NULL, strategy_version TEXT,
  config_hash TEXT, params_json TEXT, symbols TEXT, date_from TEXT, date_to TEXT, slippage_scenario TEXT,
  fee_version TEXT, vwap_method TEXT, kind TEXT, created_at TEXT NOT NULL, metrics_json TEXT, data_quality TEXT);
CREATE TABLE IF NOT EXISTS backtest_trades(
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES backtest_runs(run_id), symbol TEXT,
  entry_ts TEXT, exit_ts TEXT, quantity INTEGER, entry_price REAL, exit_price REAL, gross_pnl REAL,
  slippage_cost REAL, charges REAL, net_pnl REAL, r_multiple REAL, exit_reason TEXT, segment TEXT);
CREATE TABLE IF NOT EXISTS integration_errors(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT, account_id TEXT, source TEXT NOT NULL,
  payload TEXT, error TEXT, attempts INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'PENDING',
  resolved_at TEXT);
CREATE TABLE IF NOT EXISTS system_health_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT, account_id TEXT, component TEXT NOT NULL,
  status TEXT NOT NULL, details TEXT);
CREATE TABLE IF NOT EXISTS generated_reports(
  report_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, account_id TEXT, kind TEXT NOT NULL, fmt TEXT NOT NULL,
  mode TEXT, date_from TEXT, date_to TEXT, generated_at TEXT NOT NULL, data_as_of TEXT NOT NULL,
  generated_by TEXT, path TEXT, row_count INTEGER, sha256 TEXT);
CREATE TABLE IF NOT EXISTS data_quality_issues(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT NOT NULL, account_id TEXT, mode TEXT,
  check_name TEXT NOT NULL, severity TEXT NOT NULL, ref TEXT, details TEXT, status TEXT NOT NULL DEFAULT 'OPEN',
  resolved_at TEXT, resolved_by TEXT,
  UNIQUE(tenant_id, check_name, ref, status));
CREATE TABLE IF NOT EXISTS reconciliation_discrepancies(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, tenant_id TEXT NOT NULL, account_id TEXT, mode TEXT,
  kind TEXT NOT NULL, ref TEXT, expected TEXT, actual TEXT, status TEXT NOT NULL DEFAULT 'OPEN', details TEXT,
  resolved_at TEXT, resolved_by TEXT);
CREATE TABLE IF NOT EXISTS analytics_daily_summary(
  tenant_id TEXT NOT NULL, account_id TEXT NOT NULL, mode TEXT NOT NULL, bot_id TEXT NOT NULL,
  trade_date TEXT NOT NULL, trades INTEGER, wins INTEGER, gross REAL, charges REAL, net REAL,
  refreshed_at TEXT, PRIMARY KEY(tenant_id, account_id, mode, bot_id, trade_date));
"""


class Store:
    def __init__(self, path: str = ":memory:"):
        self.path = path
        self._lock = threading.RLock()
        self._depth = 0
        self._conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL" if path != ":memory:" else "PRAGMA journal_mode=MEMORY")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        """Serialised write transaction; commits on success, rolls back on any exception. Re-entrant."""
        with self._lock:
            if self._depth:
                self._depth += 1
                try:
                    yield self._conn
                finally:
                    self._depth -= 1
                return
            self._conn.execute("BEGIN IMMEDIATE")
            self._depth = 1
            try:
                yield self._conn
            except BaseException:
                self._conn.execute("ROLLBACK")
                raise
            else:
                self._conn.execute("COMMIT")
            finally:
                self._depth = 0

    def query(self, sql: str, params: tuple | dict = ()) -> list[sqlite3.Row]:
        with self._lock:
            return list(self._conn.execute(sql, params))

    def one(self, sql: str, params: tuple | dict = ()) -> sqlite3.Row | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def execute(self, sql: str, params: tuple | dict = ()) -> None:
        with self.tx() as c:
            c.execute(sql, params)

    # ------------------------------------------------------------------ audit (hash chained)
    def audit(self, action: str, *, tenant_id: str = "", account_id: str = "", mode: str = "", bot_id: str = "",
              actor: str = "system", details: dict[str, Any] | None = None) -> None:
        ts = now_ist().isoformat()
        body = json.dumps(_redact(details or {}), default=str, sort_keys=True)
        with self.tx() as c:
            last = c.execute("SELECT hash FROM audit_events ORDER BY id DESC LIMIT 1").fetchone()
            prev = last["hash"] if last else "GENESIS"
            h = hashlib.sha256("|".join([prev, ts, tenant_id, account_id, mode, bot_id, actor, action, body])
                               .encode()).hexdigest()
            c.execute(
                "INSERT INTO audit_events(ts,tenant_id,account_id,mode,bot_id,actor,action,details,prev_hash,hash) "
                "VALUES(?,?,?,?,?,?,?,?,?,?)",
                (ts, tenant_id, account_id, mode, bot_id, actor, action, body, prev, h),
            )

    def verify_audit_chain(self) -> tuple[bool, int | None]:
        """Recompute the chain. Returns (ok, first_bad_id)."""
        prev = "GENESIS"
        for r in self.query("SELECT * FROM audit_events ORDER BY id"):
            h = hashlib.sha256("|".join([prev, r["ts"], r["tenant_id"] or "", r["account_id"] or "",
                                         r["mode"] or "", r["bot_id"] or "", r["actor"] or "", r["action"],
                                         r["details"] or ""]).encode()).hexdigest()
            if r["prev_hash"] != prev or r["hash"] != h:
                return False, r["id"]
            prev = r["hash"]
        return True, None

    def risk_event(self, kind: str, severity: str = "WARN", *, tenant_id: str = "", account_id: str = "",
                   mode: str = "", bot_id: str = "", details: dict[str, Any] | None = None) -> None:
        self.execute(
            "INSERT INTO risk_events(ts,tenant_id,account_id,mode,bot_id,kind,severity,details) VALUES(?,?,?,?,?,?,?,?)",
            (now_ist().isoformat(), tenant_id, account_id, mode, bot_id, kind, severity,
             json.dumps(_redact(details or {}), default=str)),
        )

    def dead_letter(self, source: str, payload: dict[str, Any], error: str, *, tenant_id: str = "",
                    account_id: str = "") -> None:
        """Never silently discard a failed event: park it for replay/operator review."""
        self.execute(
            "INSERT INTO integration_errors(ts,tenant_id,account_id,source,payload,error) VALUES(?,?,?,?,?,?)",
            (now_ist().isoformat(), tenant_id, account_id, source,
             json.dumps(_redact(payload), default=str), error[:2000]),
        )

    def health_event(self, component: str, status: str, details: dict[str, Any] | None = None, *,
                     tenant_id: str = "", account_id: str = "") -> None:
        self.execute(
            "INSERT INTO system_health_events(ts,tenant_id,account_id,component,status,details) VALUES(?,?,?,?,?,?)",
            (now_ist().isoformat(), tenant_id, account_id, component, status,
             json.dumps(_redact(details or {}), default=str)),
        )

    # ------------------------------------------------------------------ control flags (kill switch)
    def set_flag(self, tenant_id: str, account_id: str, key: str, value: str, by: str, reason: str = "") -> None:
        self.execute(
            "INSERT INTO control_flags(tenant_id,account_id,key,value,updated_at,updated_by,reason) "
            "VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,account_id,key) DO UPDATE SET "
            "value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by, "
            "reason=excluded.reason",
            (tenant_id, account_id, key, value, now_ist().isoformat(), by, reason),
        )

    def get_flag(self, tenant_id: str, account_id: str, key: str, default: str = "") -> str:
        r = self.one("SELECT value FROM control_flags WHERE tenant_id=? AND account_id=? AND key=?",
                     (tenant_id, account_id, key))
        return r["value"] if r else default

    # ------------------------------------------------------------------ daily pnl
    def daily_row(self, tenant_id: str, account_id: str, mode: str, trade_date: str) -> sqlite3.Row:
        self.execute(
            "INSERT OR IGNORE INTO daily_account_pnl(tenant_id,account_id,mode,trade_date) VALUES(?,?,?,?)",
            (tenant_id, account_id, mode, trade_date),
        )
        return self.one(
            "SELECT * FROM daily_account_pnl WHERE tenant_id=? AND account_id=? AND mode=? AND trade_date=?",
            (tenant_id, account_id, mode, trade_date),
        )


_SENSITIVE = ("token", "secret", "password", "authorization", "api_key", "access-token")


def _redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: ("[REDACTED]" if any(s in str(k).lower() for s in _SENSITIVE) else _redact(v))
                for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_redact(v) for v in obj]
    return obj


def iso(ts: datetime | None) -> str | None:
    return ts.isoformat() if ts else None


def mask_id(value: str, keep: int = 4) -> str:
    """Mask broker/user identifiers for reports and logs."""
    if not value:
        return ""
    return "*" * max(0, len(value) - keep) + value[-keep:]
