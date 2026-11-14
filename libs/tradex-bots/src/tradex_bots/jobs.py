"""Operational jobs: data-quality checks, ledger reconciliation, retention, encrypted backup/restore.

These operate on the SQLite development/test store. The same checks are expressed as SQL so they port to the
production Postgres schema; the encrypted-backup mechanism here is for SQLite - production Postgres backups use
pg_dump/WAL archiving (documented in docs/algo-bots/DEPLOYMENT.md, NOT executed in this repository's tests).
"""

from __future__ import annotations

import json
import os
import sqlite3
import struct
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from tradex_bots.store import Store
from tradex_bots.timeutil import now_ist

TOL = 0.05


# ====================================================================== data quality
def _issue(store: Store, tenant: str, account: str | None, mode: str | None, name: str, severity: str, ref: str,
           details: dict[str, Any]) -> bool:
    try:
        store.execute(
            "INSERT INTO data_quality_issues(ts,tenant_id,account_id,mode,check_name,severity,ref,details) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (now_ist().isoformat(), tenant, account, mode, name, severity, ref, json.dumps(details, default=str)))
        return True
    except sqlite3.IntegrityError:
        return False  # already open for this ref


def run_data_quality(store: Store, tenant_id: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or now_ist()
    found: dict[str, int] = {}

    def add(name: str, sev: str, row, ref: str, **d) -> None:
        if _issue(store, tenant_id, row["account_id"], row["mode"], name, sev, ref, d):
            found[name] = found.get(name, 0) + 1

    closed = store.query("SELECT * FROM trading_positions WHERE tenant_id=? AND state='CLOSED'", (tenant_id,))
    for p in closed:
        pid = p["position_id"]
        if p["exit_avg_price"] is None or p["net_pnl"] is None or p["closed_at"] is None:
            add("closed_position_missing_fields", "ERROR", p, pid)
            continue
        if store.one("SELECT 1 FROM trading_costs WHERE position_id=?", (pid,)) is None:
            add("closed_position_missing_costs", "ERROR", p, pid)
        else:
            tot = store.one("SELECT total FROM trading_costs WHERE position_id=?", (pid,))["total"]
            if abs((tot or 0) - (p["charges"] or 0)) > TOL:
                add("charges_vs_costs_mismatch", "ERROR", p, pid, position_charges=p["charges"], cost_total=tot)
        ident = (p["gross_pnl"] or 0) - (p["slippage_cost"] or 0) - (p["charges"] or 0)
        if abs(ident - p["net_pnl"]) > TOL:
            add("net_pnl_identity_broken", "ERROR", p, pid, expected=round(ident, 2), stored=p["net_pnl"])
        buys = store.one("SELECT COALESCE(SUM(quantity),0) q FROM trade_fills WHERE intent_id=?",
                         (p["entry_intent_id"],))["q"]
        sells = store.one(
            "SELECT COALESCE(SUM(f.quantity),0) q FROM trade_fills f JOIN order_intents i ON i.intent_id=f.intent_id "
            "WHERE i.parent_intent_id=? AND f.side='SELL'", (p["entry_intent_id"],))["q"]
        if buys != p["quantity"] or sells != p["quantity"]:
            add("fills_do_not_match_position_quantity", "ERROR", p, pid, buys=buys, sells=sells, qty=p["quantity"])
    for p in store.query("SELECT * FROM trading_positions WHERE tenant_id=? AND state='OPEN' "
                         "AND protection_status!='PROTECTED' AND opened_at < ?",
                         (tenant_id, (now - timedelta(minutes=1)).isoformat())):
        add("open_position_unprotected", "CRITICAL", p, p["position_id"])
    for o in store.query("SELECT * FROM order_intents WHERE tenant_id=? AND state IN ('SUBMITTING','UNKNOWN') "
                         "AND updated_at < ?", (tenant_id, (now - timedelta(minutes=5)).isoformat())):
        add("order_stuck_unresolved", "CRITICAL", o, o["intent_id"], state=o["state"])
    for f in store.query("SELECT * FROM trade_fills WHERE tenant_id=? AND (quantity<=0 OR price<=0)", (tenant_id,)):
        add("invalid_fill", "ERROR", f, f["fill_key"])
    ok, bad = store.verify_audit_chain()
    if not ok:
        if _issue(store, tenant_id, None, None, "audit_chain_broken", "CRITICAL", str(bad), {"first_bad_id": bad}):
            found["audit_chain_broken"] = 1
    store.health_event("data_quality_job", "OK" if not found else "ISSUES", {"found": found}, tenant_id=tenant_id)
    return {"as_of": now.isoformat(), "new_issues": found, "positions_checked": len(closed)}


def resolve_issue(store: Store, tenant_id: str, issue_id: int, by: str, note: str) -> None:
    store.execute("UPDATE data_quality_issues SET status='RESOLVED', resolved_at=?, resolved_by=? "
                  "WHERE id=? AND tenant_id=? AND status='OPEN'", (now_ist().isoformat(), by, issue_id, tenant_id))
    store.audit("data_quality_issue_resolved", tenant_id=tenant_id, actor=by,
                details={"issue_id": issue_id, "note": note})


# ====================================================================== ledger reconciliation
def run_ledger_reconciliation(store: Store, tenant_id: str, mode: str) -> dict[str, Any]:
    """Cross-check persisted aggregates: daily P&L table vs closed positions, and costs vs contract notes.
    (Broker-vs-local position reconciliation is performed live by OrderManager.reconcile().)"""
    mode = mode.upper()
    new = 0

    def disc(account: str, kind: str, ref: str, expected: Any, actual: Any, **d) -> None:
        nonlocal new
        exists = store.one(
            "SELECT 1 FROM reconciliation_discrepancies WHERE tenant_id=? AND mode=? AND kind=? AND ref=? "
            "AND status='OPEN'", (tenant_id, mode, kind, ref))
        if exists:
            return
        store.execute(
            "INSERT INTO reconciliation_discrepancies(ts,tenant_id,account_id,mode,kind,ref,expected,actual,details) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (now_ist().isoformat(), tenant_id, account, mode, kind, ref, str(expected), str(actual),
             json.dumps(d, default=str)))
        new += 1

    sums = store.query(
        "SELECT account_id, substr(closed_at,1,10) d, ROUND(SUM(net_pnl),2) net, ROUND(SUM(charges),2) ch "
        "FROM trading_positions WHERE tenant_id=? AND mode=? AND state='CLOSED' GROUP BY account_id, d",
        (tenant_id, mode))
    for s in sums:
        day = store.one("SELECT realized_net, charges FROM daily_account_pnl WHERE tenant_id=? AND account_id=? "
                        "AND mode=? AND trade_date=?", (tenant_id, s["account_id"], mode, s["d"]))
        got = day["realized_net"] if day else None
        if got is None or abs(got - s["net"]) > TOL:
            disc(s["account_id"], "daily_pnl_vs_positions", f"{s['account_id']}:{s['d']}", s["net"], got)
    for c in store.query("SELECT * FROM trading_costs WHERE tenant_id=? AND mode=? AND contract_note_total IS NOT NULL",
                         (tenant_id, mode)):
        if abs(c["contract_note_total"] - c["total"]) > 1.0:  # Rs 1 tolerance: broker rounding differences
            disc(c["account_id"], "cost_vs_contract_note", c["position_id"], c["contract_note_total"], c["total"])
    open_n = store.one("SELECT COUNT(*) n FROM reconciliation_discrepancies WHERE tenant_id=? AND mode=? "
                       "AND status='OPEN'", (tenant_id, mode))["n"]
    store.health_event("ledger_reconciliation_job", "OK" if open_n == 0 else "DISCREPANCIES",
                       {"open": open_n, "new": new}, tenant_id=tenant_id)
    return {"as_of": now_ist().isoformat(), "new": new, "open": open_n}


# ====================================================================== retention
@dataclass
class RetentionPolicy:
    """Days to keep PURGEABLE operational data. Orders, fills, positions, costs, audit and report metadata are
    never purged by this code (regulatory/audit evidence). `retain_years_records` documents the intended
    policy only - it is an ASSUMPTION to be confirmed with compliance, not a verified legal requirement."""

    bot_signals_rejected_days: int = 365
    health_events_days: int = 180
    resolved_integration_errors_days: int = 365
    portfolio_snapshots_days: int = 730
    resolved_quality_issues_days: int = 730
    retain_years_records: int = 8
    never_purge: tuple[str, ...] = field(default=(
        "audit_events", "order_intents", "order_events", "trade_fills", "trading_positions", "trading_costs",
        "broker_orders", "live_approvals", "generated_reports"))


def apply_retention(store: Store, policy: RetentionPolicy, now: datetime | None = None,
                    dry_run: bool = True) -> dict[str, int]:
    now = now or now_ist()
    rules = [
        ("bot_signals", "ts", policy.bot_signals_rejected_days, "AND status='REJECTED'"),
        ("system_health_events", "ts", policy.health_events_days, ""),
        ("integration_errors", "ts", policy.resolved_integration_errors_days, "AND status='RESOLVED'"),
        ("portfolio_snapshots", "ts", policy.portfolio_snapshots_days, ""),
        ("data_quality_issues", "ts", policy.resolved_quality_issues_days, "AND status='RESOLVED'"),
    ]
    out: dict[str, int] = {}
    for table, col, days, extra in rules:
        assert table not in policy.never_purge
        cutoff = (now - timedelta(days=days)).isoformat()
        n = store.one(f"SELECT COUNT(*) n FROM {table} WHERE {col} < ? {extra}", (cutoff,))["n"]
        out[table] = n
        if n and not dry_run:
            store.execute(f"DELETE FROM {table} WHERE {col} < ? {extra}", (cutoff,))
    if not dry_run:
        store.audit("retention_applied", details={"deleted": out})
    return out


# ====================================================================== encrypted backup / verified restore
MAGIC = b"TXBK1"


def _counts(conn: sqlite3.Connection) -> dict[str, int]:
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    return {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in sorted(tables)}


def backup_encrypted(store: Store, dest: str | Path, key: bytes) -> dict[str, Any]:
    """Consistent online snapshot (sqlite backup API) -> AES-256-GCM. `key` must be 32 random bytes held in a
    secret manager (never in the repository or logs). Whole-file encryption: fine for this DB size."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if len(key) != 32:
        raise ValueError("backup key must be 32 bytes")
    with tempfile.TemporaryDirectory() as td:
        snap = Path(td) / "snap.db"
        dst = sqlite3.connect(snap)
        with store._lock:  # noqa: SLF001
            store._conn.backup(dst)  # noqa: SLF001
        counts = _counts(dst)
        dst.close()
        manifest = json.dumps({"created_at": now_ist().isoformat(), "counts": counts}).encode()
        payload = struct.pack(">I", len(manifest)) + manifest + snap.read_bytes()
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, payload, MAGIC)
    Path(dest).write_bytes(MAGIC + nonce + ct)
    return {"path": str(dest), "tables": len(counts), "rows": sum(counts.values())}


def restore_verified(src: str | Path, key: bytes, dest_db: str | Path) -> dict[str, Any]:
    """Decrypt, restore to `dest_db`, then VERIFY: SQLite integrity_check, row counts equal the manifest, and the
    audit hash chain validates. Raises on any failure (wrong key / tampered file / corrupt data)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw = Path(src).read_bytes()
    if raw[:5] != MAGIC:
        raise ValueError("not a TradeX backup")
    payload = AESGCM(key).decrypt(raw[5:17], raw[17:], MAGIC)  # raises InvalidTag on wrong key / tampering
    (mlen,) = struct.unpack(">I", payload[:4])
    manifest = json.loads(payload[4:4 + mlen])
    Path(dest_db).write_bytes(payload[4 + mlen:])
    conn = sqlite3.connect(dest_db)
    try:
        if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("integrity_check failed")
        if _counts(conn) != manifest["counts"]:
            raise ValueError("row counts differ from backup manifest")
    finally:
        conn.close()
    restored = Store(str(dest_db))
    try:
        ok, bad = restored.verify_audit_chain()
    finally:
        restored.close()
    if not ok:
        raise ValueError(f"audit chain invalid after restore at id {bad}")
    return {"verified": True, "created_at": manifest["created_at"], "rows": sum(manifest["counts"].values())}
