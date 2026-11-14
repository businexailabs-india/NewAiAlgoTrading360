"""Report generation (CSV / Excel / PDF) from persisted data via `Analytics`.

Every report carries: report kind, tenant, account (masked), date range, mode, generated-at, data-as-of,
generated-by and a PAPER-vs-LIVE notice. Files are written under `<out_dir>/<tenant>/<report_id>.<ext>`; each
generation is recorded in `generated_reports` with a SHA-256 so downloads are tenant-checked and tamper-evident.
Text cells that could be interpreted as spreadsheet formulas are neutralised (CSV/XLSX injection).
"""

from __future__ import annotations

import csv
import hashlib
import re
from datetime import date
from pathlib import Path
from typing import Any
from uuid import uuid4

from tradex_bots.analytics import Analytics
from tradex_bots.store import Store, mask_id
from tradex_bots.timeutil import now_ist

FORMATS = ("csv", "xlsx", "pdf")
MAX_PDF_ROWS = 2000
_SAFE_TENANT = re.compile(r"[^A-Za-z0-9_-]")
NOTICE = {
    "PAPER": "SIMULATED paper-trading results. Not real fills; no evidence of live profitability.",
    "LIVE": "LIVE results from persisted broker-confirmed fills. Reconcile with the broker contract note.",
}
KINDS = ("trades", "daily_pnl", "bot_comparison", "risk_summary", "execution_quality", "costs", "audit_log")


class ReportError(ValueError):
    pass


def _safe(v: Any) -> Any:
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + v
    return v


def _slug(tenant_id: str) -> str:
    s = _SAFE_TENANT.sub("_", tenant_id)
    if not s:
        raise ReportError("invalid tenant id")
    return s


class ReportGenerator:
    def __init__(self, store: Store, out_dir: str | Path):
        self.store, self.out = store, Path(out_dir)
        self.an = Analytics(store)

    # ------------------------------------------------------------------ data builders: (columns, rows, data_as_of)
    def _data(self, kind: str, tenant: str, mode: str, accounts: list[str] | None, d_from: date | None,
              d_to: date | None) -> tuple[list[str], list[list[Any]], str | None]:
        a = self.an
        if kind == "trades":
            r = a.trades(tenant, mode, accounts=accounts, d_from=d_from, d_to=d_to, limit=5000)
            cols = ["position_id", "bot_id", "symbol", "quantity", "entry_price", "exit_price", "opened_at",
                    "closed_at", "exit_reason", "gross_pnl", "slippage_cost", "charges", "net_pnl", "r_multiple",
                    "fee_version", "strategy_version", "config_hash"]
            return cols, [[i[c] for c in cols] for i in r["items"]], r["data_as_of"]
        if kind == "daily_pnl":
            r = a.pnl_breakdown(tenant, mode, "day", accounts=accounts, d_from=d_from, d_to=d_to)
            cols = ["key", "trades", "wins", "gross", "slippage", "charges", "net"]
            return ["date"] + cols[1:], [[i[c] for c in cols] for i in r["items"]], r["data_as_of"]
        if kind == "bot_comparison":
            r = a.bot_comparison(tenant, mode, accounts=accounts, d_from=d_from, d_to=d_to)
            cols = ["bot_id", "trade_count", "net_profit", "win_rate", "profit_factor", "expectancy", "avg_r",
                    "max_drawdown_abs", "max_drawdown_pct", "charges_total", "slippage_total", "sample_warning"]
            return cols, [[b.get(c) for c in cols] for b in r["bots"]], r["data_as_of"]
        if kind == "risk_summary":
            r = a.risk(tenant, mode, accounts=accounts, d_from=d_from, d_to=d_to)
            rows = [[k, v] for k, v in r.items() if k not in ("risk_events", "entries_by_day", "definitions")
                    and not isinstance(v, (list, dict))]
            rows += [[f"risk_event:{e['kind']}:{e['severity']}", e["count"]] for e in r["risk_events"]]
            return ["metric", "value"], rows, r["data_as_of"]
        if kind == "execution_quality":
            r = a.execution_quality(tenant, mode, accounts=accounts, d_from=d_from, d_to=d_to)
            rows = [["orders", r.get("orders")], ["submitted", r.get("submitted")],
                    ["rejection_rate", r.get("rejection_rate")], ["partial_fills", r.get("partial_fills")],
                    ["unknown_status_orders", r.get("unknown_status_orders")]]
            for k, v in (r.get("latency_ms") or {}).items():
                rows += [[f"latency_ms:{k}:p50", v["p50"]], [f"latency_ms:{k}:p95", v["p95"]]]
            s = r.get("slippage_bps") or {}
            rows += [["slippage_bps:mean", s.get("mean")], ["slippage_bps:p95", s.get("p95")]]
            return ["metric", "value"], rows, None
        if kind == "costs":
            sql = ("SELECT c.position_id, p.bot_id, p.symbol, p.closed_at, c.fee_version, c.brokerage, c.stt, "
                   "c.exchange_txn, c.sebi, c.stamp, c.gst, c.ipft, c.other, c.total, c.contract_note_total, "
                   "c.reconciled FROM trading_costs c JOIN trading_positions p ON p.position_id=c.position_id "
                   "WHERE c.tenant_id=? AND c.mode=?")
            params: list[Any] = [tenant, mode.upper()]
            if accounts is not None:
                sql += f" AND c.account_id IN ({','.join('?' * len(accounts)) or 'NULL'})"
                params += accounts
            if d_from:
                sql += " AND substr(p.closed_at,1,10) >= ?"
                params.append(d_from.isoformat())
            if d_to:
                sql += " AND substr(p.closed_at,1,10) <= ?"
                params.append(d_to.isoformat())
            rows = self.store.query(sql + " ORDER BY p.closed_at", tuple(params))
            cols = ["position_id", "bot_id", "symbol", "closed_at", "fee_version", "brokerage", "stt",
                    "exchange_txn", "sebi", "stamp", "gst", "ipft", "other", "total", "contract_note_total",
                    "reconciled"]
            return cols, [[r[c] for c in cols] for r in rows], max((r["closed_at"] for r in rows), default=None)
        if kind == "audit_log":
            r = a.audit_log(tenant, d_from=d_from, d_to=d_to, limit=1000)
            cols = ["id", "ts", "mode", "bot_id", "actor", "action", "details", "hash"]
            return cols, [[i[c] for c in cols] for i in r["items"]], (r["items"][0]["ts"] if r["items"] else None)
        raise ReportError(f"unknown report kind {kind}")

    # ------------------------------------------------------------------ generate
    def generate(self, *, tenant_id: str, kind: str, fmt: str, mode: str, account_id: str | None,
                 accounts: list[str] | None, d_from: date | None, d_to: date | None,
                 generated_by: str) -> dict[str, Any]:
        if kind not in KINDS:
            raise ReportError(f"kind must be one of {KINDS}")
        if fmt not in FORMATS:
            raise ReportError(f"format must be one of {FORMATS}")
        mode = mode.upper()
        cols, rows, data_as_of = self._data(kind, tenant_id, mode, accounts, d_from, d_to)
        generated_at = now_ist().isoformat()
        meta = {
            "Report": kind, "Tenant": tenant_id, "Account": mask_id(account_id) if account_id else "ALL (permitted)",
            "Mode": mode, "From": d_from.isoformat() if d_from else "beginning",
            "To": d_to.isoformat() if d_to else "latest", "Generated at (IST)": generated_at,
            "Data as of (IST)": data_as_of or "n/a (no matching records)", "Generated by": generated_by,
            "Rows": str(len(rows)), "Notice": NOTICE[mode],
        }
        rid = str(uuid4())
        folder = self.out / _slug(tenant_id)
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{rid}.{fmt}"
        {"csv": self._csv, "xlsx": self._xlsx, "pdf": self._pdf}[fmt](path, meta, cols, rows)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        self.store.execute(
            "INSERT INTO generated_reports(report_id,tenant_id,account_id,kind,fmt,mode,date_from,date_to,"
            "generated_at,data_as_of,generated_by,path,row_count,sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (rid, tenant_id, account_id, kind, fmt, mode, meta["From"], meta["To"], generated_at,
             data_as_of or "", generated_by, str(path), len(rows), sha))
        self.store.audit("report_generated", tenant_id=tenant_id, account_id=account_id or "", mode=mode,
                         actor=generated_by, details={"report_id": rid, "kind": kind, "fmt": fmt, "rows": len(rows)})
        return {"report_id": rid, "kind": kind, "format": fmt, "rows": len(rows), "generated_at": generated_at,
                "data_as_of": data_as_of, "sha256": sha}

    def list_reports(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = self.store.query(
            "SELECT report_id,account_id,kind,fmt,mode,date_from,date_to,generated_at,data_as_of,generated_by,"
            "row_count,sha256 FROM generated_reports WHERE tenant_id=? ORDER BY generated_at DESC LIMIT ?",
            (tenant_id, min(limit, 500)))
        return [dict(r) | {"account_id": mask_id(r["account_id"]) if r["account_id"] else None} for r in rows]

    def open_report(self, tenant_id: str, report_id: str) -> tuple[Path, str]:
        """Tenant-checked lookup + integrity check. Raises ReportError (also for another tenant's report)."""
        r = self.store.one("SELECT path, fmt, sha256 FROM generated_reports WHERE report_id=? AND tenant_id=?",
                           (report_id, tenant_id))
        if r is None:
            raise ReportError("report not found")
        p = Path(r["path"]).resolve()
        if self.out.resolve() not in p.parents:
            raise ReportError("invalid report path")
        if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest() != r["sha256"]:
            raise ReportError("report file missing or modified since generation")
        return p, r["fmt"]

    # ------------------------------------------------------------------ writers
    @staticmethod
    def _csv(path: Path, meta: dict[str, str], cols: list[str], rows: list[list[Any]]) -> None:
        with open(path, "w", newline="", encoding="utf-8") as fh:
            for k, v in meta.items():
                fh.write(f"# {k}: {v}\n")
            w = csv.writer(fh)
            w.writerow(cols)
            for r in rows:
                w.writerow([_safe(c) for c in r])

    @staticmethod
    def _xlsx(path: Path, meta: dict[str, str], cols: list[str], rows: list[list[Any]]) -> None:
        from openpyxl import Workbook
        from openpyxl.styles import Font

        wb = Workbook()
        s = wb.active
        s.title = "Summary"
        for k, v in meta.items():
            s.append([k, _safe(v)])
            s.cell(row=s.max_row, column=1).font = Font(bold=True)
        s.column_dimensions["A"].width = 22
        s.column_dimensions["B"].width = 90
        d = wb.create_sheet("Data")
        d.append(cols)
        for c in d[1]:
            c.font = Font(bold=True)
        for r in rows:
            d.append([_safe(c) for c in r])
        d.freeze_panes = "A2"
        wb.save(path)

    @staticmethod
    def _pdf(path: Path, meta: dict[str, str], cols: list[str], rows: list[list[Any]]) -> None:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        st = getSampleStyleSheet()
        doc = SimpleDocTemplate(str(path), pagesize=landscape(A4), leftMargin=24, rightMargin=24,
                                topMargin=24, bottomMargin=24, title=f"TradeX {meta['Report']}")
        el: list[Any] = [Paragraph(f"BusineX AI TradeX - {meta['Report']}", st["Title"])]
        for k, v in meta.items():
            el.append(Paragraph(f"<b>{k}:</b> {_esc(str(v))}", st["Normal"]))
        el.append(Spacer(1, 10))
        body = [cols] + [["" if c is None else (f"{c:,.2f}" if isinstance(c, float) else str(c)) for c in r]
                         for r in rows[:MAX_PDF_ROWS]]
        if len(rows) > MAX_PDF_ROWS:
            el.append(Paragraph(f"Showing first {MAX_PDF_ROWS} of {len(rows)} rows. Use CSV/Excel for the full set.",
                                st["Italic"]))
        t = Table(body, repeatRows=1)
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey), ("FONTSIZE", (0, 0), (-1, -1), 6),
                               ("GRID", (0, 0), (-1, -1), 0.25, colors.grey)]))
        el.append(t)
        doc.build(el)


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
