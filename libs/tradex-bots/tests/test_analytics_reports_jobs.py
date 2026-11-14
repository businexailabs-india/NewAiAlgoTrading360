from __future__ import annotations

import csv
from datetime import date

import pytest

from harness import SYM, Env
from tradex_bots.analytics import Analytics
from tradex_bots.config import BOT_01, BOT_02
from tradex_bots.jobs import (
    RetentionPolicy, apply_retention, backup_encrypted, resolve_issue, restore_verified, run_data_quality,
    run_ledger_reconciliation,
)
from tradex_bots.reports import KINDS, ReportError, ReportGenerator
from tradex_bots.store import Store

KEY = bytes(range(32))


def run_trade(env: Env, outcome: str, key: str, bot: str = BOT_01) -> str:
    iid = env.entry(key=key, bot=bot)
    env.om.submit(iid)
    env.quote(400.0)
    env.om.poll()
    pos_id = f"pos-{iid}"
    assert env.om.ensure_protection(pos_id)
    pos = env.om.position(pos_id)
    if outcome == "win":
        env.quote(pos["target_price"] + 0.2)
        env.om.on_price(SYM, pos["target_price"] + 0.2)
        env.quote(pos["target_price"] + 0.2)
    else:
        env.quote(pos["stop_price"] - 0.1)
    env.om.poll()
    assert env.om.position(pos_id)["state"] == "CLOSED"
    env.quote(400.0)  # reset market for the next trade
    return pos_id


@pytest.fixture
def world():
    store = Store()
    e1 = Env(store=store, tenant="t1", account="a1")
    e2 = Env(store=store, tenant="t2", account="b1")
    plan = [("win", BOT_01), ("loss", BOT_01), ("win", BOT_02), ("loss", BOT_02), ("win", BOT_01)]
    for n, (o, b) in enumerate(plan):
        e1.clock.advance(86400)
        e1.broker.clock = e1.clock
        run_trade(e1, o, f"t1-{n}", b)
    for n, o in enumerate(["win", "win"]):
        e2.clock.advance(86400)
        run_trade(e2, o, f"t2-{n}", BOT_01)
    return store, e1, e2


# ------------------------------------------------------------------ analytics from persisted rows
def test_overview_matches_independent_recomputation(world):
    store, e1, _ = world
    rows = store.query("SELECT net_pnl, charges, gross_pnl FROM trading_positions WHERE tenant_id='t1' AND state='CLOSED'")
    nets = [r["net_pnl"] for r in rows]
    m = Analytics(store).overview("t1", "PAPER")["metrics"]
    assert m["trade_count"] == 5 == len(nets)
    assert m["net_profit"] == pytest.approx(sum(nets), abs=0.01)
    assert m["win_rate"] == pytest.approx(sum(1 for n in nets if n > 0) / 5)
    wins, losses = sum(n for n in nets if n > 0), -sum(n for n in nets if n < 0)
    assert m["profit_factor"] == pytest.approx(wins / losses, rel=1e-3)
    assert m["charges_total"] == pytest.approx(sum(r["charges"] for r in rows), abs=0.01)
    assert m["expectancy"] == pytest.approx(sum(nets) / 5, abs=0.01)
    assert len(m["daily_net"]) == 5


def test_modes_never_mixed(world):
    store, _, _ = world
    live = Analytics(store).overview("t1", "LIVE")
    assert live["empty"] and live["metrics"]["trade_count"] == 0
    with pytest.raises(ValueError):
        Analytics(store).overview("t1", "BACKTEST")


def test_tenant_isolation_in_every_view(world):
    store, e1, e2 = world
    a = Analytics(store)
    t1_ids = {r["position_id"] for r in store.query("SELECT position_id FROM trading_positions WHERE tenant_id='t1'")}
    items = a.trades("t1", "PAPER")["items"]
    assert {i["position_id"] for i in items} == t1_ids and len(items) == 5
    assert a.overview("t2", "PAPER")["metrics"]["trade_count"] == 2
    assert a.trades("t1", "PAPER", accounts=["b1"])["total"] == 0  # account of another tenant yields nothing
    assert a.trades("t1", "PAPER", accounts=[])["total"] == 0
    assert all(b["bot_id"] in (BOT_01, BOT_02) for b in a.bot_comparison("t1", "PAPER")["bots"])
    assert a.execution_quality("t2", "PAPER")["orders"] == 6 and a.execution_quality("t1", "PAPER")["orders"] == 13
    store.audit("x1", tenant_id="t1", actor="alice")
    store.audit("x2", tenant_id="t2", actor="bob")
    items = a.audit_log("t2")["items"]
    assert items and all(i["actor"] != "alice" for i in items) and any(i["action"] == "x2" for i in items)


def test_bot_comparison_and_breakdowns(world):
    store, _, _ = world
    a = Analytics(store)
    bots = {b["bot_id"]: b for b in a.bot_comparison("t1", "PAPER")["bots"]}
    assert bots[BOT_01]["trade_count"] == 3 and bots[BOT_02]["trade_count"] == 2
    assert bots[BOT_01]["sample_warning"]  # tiny samples are flagged, never ranked
    by_day = a.pnl_breakdown("t1", "PAPER", "day")["items"]
    assert len(by_day) == 5 and sum(i["trades"] for i in by_day) == 5
    by_reason = {i["key"]: i["trades"] for i in a.pnl_breakdown("t1", "PAPER", "exit_reason")["items"]}
    assert by_reason == {"TARGET": 3, "STOP_LOSS": 2}
    with pytest.raises(ValueError):
        a.pnl_breakdown("t1", "PAPER", "nonsense")


def test_execution_and_risk_views(world):
    store, _, _ = world
    a = Analytics(store)
    ex = a.execution_quality("t1", "PAPER")
    assert ex["orders"] == 13 and ex["partial_fills"] == 0 and ex["rejection_rate"] == 0
    assert ex["slippage_bps"]["n"] > 0
    rk = a.risk("t1", "PAPER")
    assert rk["worst_daily_realised_net"] < 0 and rk["peak_position_notional"] > 0
    assert rk["daily_loss_utilisation_pct"] > 0


# ------------------------------------------------------------------ reports
def test_report_csv_has_required_metadata_and_matches_data(world, tmp_path):
    store, _, _ = world
    rg = ReportGenerator(store, tmp_path)
    out = rg.generate(tenant_id="t1", kind="trades", fmt="csv", mode="PAPER", account_id="a1", accounts=["a1"],
                      d_from=None, d_to=None, generated_by="alice")
    path, fmt = rg.open_report("t1", out["report_id"])
    text = path.read_text(encoding="utf-8")
    for needle in ("# Mode: PAPER", "# Generated at (IST):", "# Data as of (IST):", "# Account:", "# From:", "# To:",
                   "SIMULATED"):
        assert needle in text
    data = [ln for ln in text.splitlines() if not ln.startswith("#")]
    assert len(list(csv.DictReader(data))) == 5 == out["rows"]
    assert store.one("SELECT COUNT(*) n FROM audit_events WHERE action='report_generated'")["n"] >= 1


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("fmt", ["csv", "xlsx", "pdf"])
def test_every_report_kind_and_format_generates(world, tmp_path, kind, fmt):
    store, _, _ = world
    rg = ReportGenerator(store, tmp_path)
    out = rg.generate(tenant_id="t1", kind=kind, fmt=fmt, mode="PAPER", account_id=None, accounts=None,
                      d_from=date(2000, 1, 1), d_to=date(2100, 1, 1), generated_by="alice")
    p, _ = rg.open_report("t1", out["report_id"])
    head = p.read_bytes()[:4]
    assert {"csv": b"# Re", "xlsx": b"PK\x03\x04", "pdf": b"%PDF"}[fmt] == head


def test_xlsx_contents_and_formula_injection_neutralised(world, tmp_path):
    from openpyxl import load_workbook

    store, _, _ = world
    store.execute("UPDATE trading_positions SET symbol='=HYPERLINK(\"http://evil\")' WHERE rowid=1")
    rg = ReportGenerator(store, tmp_path)
    out = rg.generate(tenant_id="t1", kind="trades", fmt="xlsx", mode="PAPER", account_id=None, accounts=None,
                      d_from=None, d_to=None, generated_by="alice")
    wb = load_workbook(rg.open_report("t1", out["report_id"])[0])
    assert wb.sheetnames == ["Summary", "Data"] and wb["Data"].max_row == 6
    cells = [c.value for row in wb["Data"].iter_rows(min_row=2) for c in row if isinstance(c.value, str)]
    assert not any(v.startswith("=") for v in cells)
    csv_out = rg.generate(tenant_id="t1", kind="trades", fmt="csv", mode="PAPER", account_id=None, accounts=None,
                          d_from=None, d_to=None, generated_by="alice")
    assert "'=HYPERLINK" in rg.open_report("t1", csv_out["report_id"])[0].read_text()


def test_report_download_is_tenant_checked_and_tamper_evident(world, tmp_path):
    store, _, _ = world
    rg = ReportGenerator(store, tmp_path)
    out = rg.generate(tenant_id="t1", kind="daily_pnl", fmt="csv", mode="PAPER", account_id="a1", accounts=["a1"],
                      d_from=None, d_to=None, generated_by="alice")
    with pytest.raises(ReportError):
        rg.open_report("t2", out["report_id"])  # another tenant cannot fetch it
    assert rg.list_reports("t2") == [] and len(rg.list_reports("t1")) == 1
    assert rg.list_reports("t1")[0]["account_id"] != "a1" or len("a1") <= 4  # masked identifiers
    p, _ = rg.open_report("t1", out["report_id"])
    p.write_text(p.read_text() + "tampered")
    with pytest.raises(ReportError, match="modified"):
        rg.open_report("t1", out["report_id"])
    with pytest.raises(ReportError):
        rg.generate(tenant_id="t1", kind="nope", fmt="csv", mode="PAPER", account_id=None, accounts=None,
                    d_from=None, d_to=None, generated_by="a")


# ------------------------------------------------------------------ jobs
def test_data_quality_clean_data_then_detects_corruption(world):
    store, _, _ = world
    clean = run_data_quality(store, "t1")
    assert clean["new_issues"] == {} and clean["positions_checked"] == 5
    store.execute("UPDATE trading_positions SET net_pnl = net_pnl + 50 WHERE rowid=1")
    store.execute("DELETE FROM trading_costs WHERE rowid=2")
    r = run_data_quality(store, "t1")
    assert r["new_issues"].get("net_pnl_identity_broken") == 1
    assert r["new_issues"].get("closed_position_missing_costs") == 1
    assert run_data_quality(store, "t1")["new_issues"] == {}  # idempotent: already-open issues not duplicated
    issue = store.one("SELECT id FROM data_quality_issues WHERE check_name='net_pnl_identity_broken'")
    resolve_issue(store, "t1", issue["id"], "alice", "fixed manually")
    assert store.one("SELECT status FROM data_quality_issues WHERE id=?", (issue["id"],))["status"] == "RESOLVED"
    assert store.one("SELECT COUNT(*) n FROM data_quality_issues WHERE tenant_id='t2'")["n"] == 0


def test_ledger_reconciliation_flags_daily_total_drift(world):
    store, _, _ = world
    assert run_ledger_reconciliation(store, "t1", "PAPER")["open"] == 0
    store.execute("UPDATE daily_account_pnl SET realized_net = realized_net + 25 WHERE account_id='a1' AND rowid=(SELECT MIN(rowid) FROM daily_account_pnl WHERE account_id='a1')")
    r = run_ledger_reconciliation(store, "t1", "PAPER")
    assert r["open"] == 1 and r["new"] == 1
    assert run_ledger_reconciliation(store, "t1", "PAPER")["new"] == 0
    store.execute("UPDATE trading_costs SET contract_note_total = total + 10 WHERE rowid=1")
    assert run_ledger_reconciliation(store, "t1", "PAPER")["new"] == 1
    assert Analytics(store).reconciliation_summary("t1", "PAPER")["discrepancies"]


def test_retention_dry_run_apply_and_never_purges_records(world):
    from datetime import timedelta

    from tradex_bots.timeutil import now_ist

    store, _, _ = world
    store.health_event("old", "OK", {}, tenant_id="t1")
    store.execute("UPDATE system_health_events SET ts='2000-01-01T00:00:00+05:30'")
    before = {t: store.one(f"SELECT COUNT(*) n FROM {t}")["n"] for t in
              ("order_intents", "trade_fills", "trading_positions", "trading_costs", "audit_events")}
    dry = apply_retention(store, RetentionPolicy(), dry_run=True)
    assert dry["system_health_events"] > 0
    assert store.one("SELECT COUNT(*) n FROM system_health_events WHERE ts LIKE '2000%'")["n"] > 0
    apply_retention(store, RetentionPolicy(), now=now_ist() + timedelta(days=4000), dry_run=False)
    assert store.one("SELECT COUNT(*) n FROM system_health_events WHERE ts LIKE '2000%'")["n"] == 0
    for t, n in before.items():
        assert store.one(f"SELECT COUNT(*) n FROM {t}")["n"] >= n  # records are never purged


def test_encrypted_backup_restore_roundtrip_and_failure_modes(world, tmp_path):
    from cryptography.exceptions import InvalidTag

    store, _, _ = world
    bk = tmp_path / "b.enc"
    info = backup_encrypted(store, bk, KEY)
    assert info["rows"] > 0
    raw = bk.read_bytes()
    assert b"SQLite format" not in raw and b"trading_positions" not in raw  # actually encrypted
    res = restore_verified(bk, KEY, tmp_path / "restored.db")
    assert res["verified"] and res["rows"] == info["rows"]
    restored = Store(str(tmp_path / "restored.db"))
    assert Analytics(restored).overview("t1", "PAPER")["metrics"]["net_profit"] == \
        Analytics(store).overview("t1", "PAPER")["metrics"]["net_profit"]
    restored.close()
    with pytest.raises(InvalidTag):
        restore_verified(bk, bytes(32), tmp_path / "x.db")
    bad = bytearray(raw)
    bad[-5] ^= 0xFF
    (tmp_path / "bad.enc").write_bytes(bytes(bad))
    with pytest.raises(InvalidTag):
        restore_verified(tmp_path / "bad.enc", KEY, tmp_path / "y.db")
    with pytest.raises(ValueError):
        backup_encrypted(store, tmp_path / "z.enc", b"short")
