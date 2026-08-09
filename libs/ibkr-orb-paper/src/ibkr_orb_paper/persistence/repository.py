from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()

SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  mode TEXT NOT NULL,
  symbol TEXT NOT NULL,
  strategy_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  signal_id TEXT PRIMARY KEY,
  run_id TEXT,
  ts TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasons TEXT,
  entry_price REAL,
  stop_price REAL,
  target_price REAL,
  quantity INTEGER,
  indicators_json TEXT,
  breakout_key TEXT,
  con_id INTEGER
);

CREATE TABLE IF NOT EXISTS risk_gates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id TEXT,
  name TEXT,
  passed INTEGER,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  client_order_key TEXT PRIMARY KEY,
  signal_id TEXT,
  strategy_id TEXT,
  symbol TEXT,
  status TEXT,
  parent_id INTEGER,
  stop_id INTEGER,
  target_id INTEGER,
  quantity INTEGER,
  entry_limit REAL,
  stop_price REAL,
  target_price REAL,
  payload_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS executions (
  exec_id TEXT PRIMARY KEY,
  order_id INTEGER,
  symbol TEXT,
  qty REAL,
  price REAL,
  commission REAL,
  ts TEXT
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  equity REAL,
  equity_peak REAL,
  daily_pnl REAL,
  weekly_pnl REAL,
  drawdown_pct REAL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  kind TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS traded_breakouts (
  breakout_key TEXT PRIMARY KEY,
  signal_id TEXT,
  ts TEXT
);
"""


class TradeRepository:
    def __init__(self, path: str) -> None:
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            cur = conn.execute("SELECT COUNT(*) AS c FROM schema_version")
            if cur.fetchone()["c"] == 0:
                conn.execute("INSERT INTO schema_version(version) VALUES (1)")

    def start_run(self, mode: str, symbol: str, strategy_id: str) -> str:
        run_id = str(uuid4())
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO strategy_runs(run_id, started_at, mode, symbol, strategy_id) VALUES (?,?,?,?,?)",
                (run_id, _utc_now_iso(), mode, symbol, strategy_id),
            )
        return run_id

    def save_signal(self, run_id: str, signal: Any, con_id: int | None = None) -> None:
        ind = None
        if signal.indicators:
            ind = json.dumps(asdict(signal.indicators))
        with self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO signals
                (signal_id, run_id, ts, symbol, decision, reasons, entry_price, stop_price, target_price,
                 quantity, indicators_json, breakout_key, con_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    signal.signal_id,
                    run_id,
                    signal.bar_ts.isoformat(),
                    signal.symbol,
                    signal.decision.value,
                    json.dumps(signal.reasons),
                    signal.entry_price,
                    signal.stop_price,
                    signal.target_price,
                    signal.quantity,
                    ind,
                    signal.breakout_key,
                    con_id,
                ),
            )

    def save_gates(self, signal_id: str, gates: list[Any]) -> None:
        with self._connect() as conn:
            for g in gates:
                conn.execute(
                    "INSERT INTO risk_gates(signal_id, name, passed, detail) VALUES (?,?,?,?)",
                    (signal_id, g.name, 1 if g.passed else 0, g.detail),
                )

    def save_order(self, spec: Any, status: str, signal_id: str | None = None) -> None:
        with self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO orders
                (client_order_key, signal_id, strategy_id, symbol, status, parent_id, stop_id, target_id,
                 quantity, entry_limit, stop_price, target_price, payload_json, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    spec.client_order_key,
                    signal_id,
                    spec.strategy_id,
                    spec.symbol,
                    status,
                    spec.parent_order_id,
                    spec.stop_order_id,
                    spec.target_order_id,
                    spec.quantity,
                    spec.entry_limit,
                    spec.stop_price,
                    spec.target_price,
                    json.dumps({"meta": spec.meta}),
                    _utc_now_iso(),
                ),
            )

    def mark_breakout(self, breakout_key: str, signal_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO traded_breakouts(breakout_key, signal_id, ts) VALUES (?,?,?)",
                (breakout_key, signal_id, _utc_now_iso()),
            )

    def is_breakout_traded(self, breakout_key: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM traded_breakouts WHERE breakout_key=?", (breakout_key,)
            ).fetchone()
            return row is not None

    def load_breakouts(self) -> set[str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT breakout_key FROM traded_breakouts").fetchall()
            return {r["breakout_key"] for r in rows}

    def log_event(self, kind: str, detail: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO events(ts, kind, detail) VALUES (?,?,?)",
                (_utc_now_iso(), kind, detail),
            )

    def save_portfolio(self, equity: float, peak: float, daily: float, weekly: float, dd: float) -> None:
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO portfolio_snapshots(ts, equity, equity_peak, daily_pnl, weekly_pnl, drawdown_pct)
                   VALUES (?,?,?,?,?,?)""",
                (_utc_now_iso(), equity, peak, daily, weekly, dd),
            )

    def signals_for_date(self, day: str) -> list[sqlite3.Row]:
        with self._connect() as conn:
            return list(
                conn.execute("SELECT * FROM signals WHERE ts LIKE ?", (f"{day}%",)).fetchall()
            )

    def orders_all(self) -> list[sqlite3.Row]:
        with self._connect() as conn:
            return list(conn.execute("SELECT * FROM orders ORDER BY created_at").fetchall())
