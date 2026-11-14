"""Analytics computed ONLY from persisted records (never from in-memory state or UI caches).

Every public method requires `tenant_id` (tenant isolation) and returns plain dicts including `as_of`
(when computed) and `data_as_of` (timestamp of the newest persisted record used) so consumers can show
data freshness. Metric definitions are shared with the backtester via `metrics.compute_metrics`.
Paper, live and backtest data are never mixed: `mode` is mandatory and one of PAPER|LIVE.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Iterable

from tradex_bots.metrics import TradeRecord, compute_metrics
from tradex_bots.store import Store
from tradex_bots.timeutil import IST, now_ist

VALID_MODES = ("PAPER", "LIVE")

DEFINITIONS = {
    "net_pnl": "gross P&L (reference prices) - slippage - all charges (brokerage, STT, exchange, SEBI, stamp, GST)",
    "win_rate": "closed trades with net_pnl > 0 / closed trades",
    "profit_factor": "sum of winning net P&L / absolute sum of losing net P&L (None if no losses)",
    "expectancy": "mean net P&L per closed trade",
    "max_drawdown": "largest peak-to-trough fall of cumulative realised net P&L in trade-close order",
    "r_multiple": "net P&L / (quantity x planned stop distance)",
    "slippage_bps": "(fill - reference) / reference x 10,000, sign adverse = positive",
    "latency": "milliseconds between persisted timestamps (submitted->acked, submitted->first fill)",
}


def _mode(mode: str) -> str:
    m = mode.upper()
    if m not in VALID_MODES:
        raise ValueError(f"mode must be one of {VALID_MODES}")
    return m


def _pct(vals: list[float], q: float) -> float | None:
    if not vals:
        return None
    s = sorted(vals)
    k = (len(s) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    return round(s[lo] + (s[hi] - s[lo]) * (k - lo), 2)


def _ms(a: str | None, b: str | None) -> float | None:
    if not a or not b:
        return None
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() * 1000.0


class Analytics:
    def __init__(self, store: Store):
        self.store = store

    # ------------------------------------------------------------------ data access
    def _closed(self, tenant_id: str, mode: str, accounts: list[str] | None, d_from: date | None,
                d_to: date | None, bot_id: str | None = None, symbol: str | None = None):
        sql = ["SELECT * FROM trading_positions WHERE tenant_id=? AND mode=? AND state='CLOSED'"]
        p: list[Any] = [tenant_id, _mode(mode)]
        if accounts is not None:
            if not accounts:
                return []
            sql.append(f"AND account_id IN ({','.join('?' * len(accounts))})")
            p += accounts
        if d_from:
            sql.append("AND substr(closed_at,1,10) >= ?")
            p.append(d_from.isoformat())
        if d_to:
            sql.append("AND substr(closed_at,1,10) <= ?")
            p.append(d_to.isoformat())
        if bot_id:
            sql.append("AND bot_id=?")
            p.append(bot_id)
        if symbol:
            sql.append("AND symbol=?")
            p.append(symbol)
        sql.append("ORDER BY closed_at, position_id")
        return self.store.query(" ".join(sql), tuple(p))

    @staticmethod
    def _to_record(r) -> TradeRecord:
        return TradeRecord(
            symbol=r["symbol"], entry_ts=datetime.fromisoformat(r["opened_at"]),
            exit_ts=datetime.fromisoformat(r["closed_at"]), quantity=r["quantity"], entry_price=r["avg_price"],
            exit_price=r["exit_avg_price"] or 0.0, entry_ref=r["entry_ref_price"] or r["avg_price"],
            exit_ref=r["exit_ref_price"] or (r["exit_avg_price"] or 0.0), gross_pnl=r["gross_pnl"] or 0.0,
            slippage_cost=r["slippage_cost"] or 0.0, charges=r["charges"] or 0.0, net_pnl=r["net_pnl"] or 0.0,
            initial_risk=(r["quantity"] or 0) * (r["stop_distance"] or 0.0), r_multiple=r["r_multiple"] or 0.0,
            exit_reason=r["exit_reason"] or "", bot_id=r["bot_id"] or "", mode=r["mode"])

    def _meta(self, rows, mode: str) -> dict[str, Any]:
        latest = max((r["closed_at"] for r in rows), default=None)
        return {"mode": mode, "as_of": now_ist().isoformat(), "data_as_of": latest,
                "source": "persisted trading_positions/trade_fills/trading_costs", "definitions": DEFINITIONS,
                "simulated": mode == "PAPER", "empty": not rows}

    # ------------------------------------------------------------------ views
    def overview(self, tenant_id: str, mode: str, *, accounts: list[str] | None = None, d_from: date | None = None,
                 d_to: date | None = None, bot_id: str | None = None, symbol: str | None = None,
                 starting_capital: float = 20_000.0) -> dict[str, Any]:
        rows = self._closed(tenant_id, mode, accounts, d_from, d_to, bot_id, symbol)
        recs = [self._to_record(r) for r in rows]
        m = compute_metrics(recs, starting_capital)
        gross_win = sum(r.net_pnl for r in recs if r.net_pnl > 0)
        daily: dict[str, float] = defaultdict(float)
        for r in recs:
            daily[r.exit_ts.astimezone(IST).date().isoformat()] += r.net_pnl
        m["daily_net"] = [{"date": d, "net": round(v, 2)} for d, v in sorted(daily.items())]
        m["best_day"] = max(m["daily_net"], key=lambda x: x["net"]) if daily else None
        m["worst_day"] = min(m["daily_net"], key=lambda x: x["net"]) if daily else None
        m["gross_profit"] = round(gross_win, 2)
        m["slippage_total"] = round(sum(r.slippage_cost for r in recs), 2)
        m["charges_total"] = round(sum(r.charges for r in recs), 2)
        m["gross_pnl_total"] = round(sum(r.gross_pnl for r in recs), 2)
        open_rows = self.store.query(
            "SELECT COUNT(*) n FROM trading_positions WHERE tenant_id=? AND mode=? AND state='OPEN'",
            (tenant_id, _mode(mode)))
        m["open_positions"] = open_rows[0]["n"]
        return {**self._meta(rows, mode.upper()), "metrics": m}

    def trades(self, tenant_id: str, mode: str, *, accounts: list[str] | None = None, d_from: date | None = None,
               d_to: date | None = None, bot_id: str | None = None, symbol: str | None = None,
               limit: int = 500, offset: int = 0) -> dict[str, Any]:
        rows = self._closed(tenant_id, mode, accounts, d_from, d_to, bot_id, symbol)
        page = rows[offset:offset + min(limit, 5000)]
        items = [{"position_id": r["position_id"], "bot_id": r["bot_id"], "symbol": r["symbol"],
                  "quantity": r["quantity"], "entry_price": r["avg_price"], "exit_price": r["exit_avg_price"],
                  "opened_at": r["opened_at"], "closed_at": r["closed_at"], "exit_reason": r["exit_reason"],
                  "gross_pnl": r["gross_pnl"], "slippage_cost": r["slippage_cost"], "charges": r["charges"],
                  "net_pnl": r["net_pnl"], "r_multiple": r["r_multiple"], "fee_version": r["fee_version"],
                  "strategy_version": r["strategy_version"], "config_hash": r["config_hash"]} for r in page]
        return {**self._meta(rows, mode.upper()), "total": len(rows), "limit": limit, "offset": offset, "items": items}

    def bot_comparison(self, tenant_id: str, mode: str, *, accounts: list[str] | None = None,
                       d_from: date | None = None, d_to: date | None = None,
                       starting_capital: float = 20_000.0) -> dict[str, Any]:
        """Side-by-side per-bot metrics. No ranking and no 'best bot' claim: sample size is part of the output."""
        rows = self._closed(tenant_id, mode, accounts, d_from, d_to)
        by: dict[str, list] = defaultdict(list)
        for r in rows:
            by[r["bot_id"] or "UNKNOWN"].append(self._to_record(r))
        bots = []
        for bid, recs in sorted(by.items()):
            m = compute_metrics(recs, starting_capital)
            bots.append({"bot_id": bid, **{k: m.get(k) for k in (
                "trade_count", "net_profit", "win_rate", "profit_factor", "expectancy", "avg_r",
                "max_drawdown_abs", "max_drawdown_pct", "charges_total", "slippage_total")},
                "sample_warning": "fewer than 100 closed trades: not statistically meaningful"
                if len(recs) < 100 else None})
        return {**self._meta(rows, mode.upper()), "bots": bots}

    def pnl_breakdown(self, tenant_id: str, mode: str, group_by: str, *, accounts: list[str] | None = None,
                      d_from: date | None = None, d_to: date | None = None) -> dict[str, Any]:
        if group_by not in ("day", "bot", "symbol", "hour", "exit_reason"):
            raise ValueError("group_by must be day|bot|symbol|hour|exit_reason")
        rows = self._closed(tenant_id, mode, accounts, d_from, d_to)
        g: dict[str, dict[str, float]] = defaultdict(lambda: {"trades": 0, "wins": 0, "gross": 0.0, "charges": 0.0,
                                                               "slippage": 0.0, "net": 0.0})
        for r in rows:
            key = {"day": (r["closed_at"] or "")[:10], "bot": r["bot_id"] or "UNKNOWN", "symbol": r["symbol"],
                   "hour": datetime.fromisoformat(r["opened_at"]).astimezone(IST).strftime("%H:00"),
                   "exit_reason": r["exit_reason"] or ""}[group_by]
            x = g[key]
            x["trades"] += 1
            x["wins"] += 1 if (r["net_pnl"] or 0) > 0 else 0
            x["gross"] += r["gross_pnl"] or 0
            x["charges"] += r["charges"] or 0
            x["slippage"] += r["slippage_cost"] or 0
            x["net"] += r["net_pnl"] or 0
        items = [{"key": k, **{a: round(b, 2) for a, b in v.items()}} for k, v in sorted(g.items())]
        return {**self._meta(rows, mode.upper()), "group_by": group_by, "items": items}

    def risk(self, tenant_id: str, mode: str, *, accounts: list[str] | None = None, d_from: date | None = None,
             d_to: date | None = None, daily_cutoff: float = 200.0, max_exposure: float = 18_000.0) -> dict[str, Any]:
        rows = self._closed(tenant_id, mode, accounts, d_from, d_to)
        d = self.store.query(
            "SELECT trade_date, realized_net, entries, locked FROM daily_account_pnl WHERE tenant_id=? AND mode=? "
            "ORDER BY trade_date", (tenant_id, _mode(mode)))
        worst = min((r["realized_net"] for r in d), default=0.0)
        ev = self.store.query(
            "SELECT kind, severity, COUNT(*) n FROM risk_events WHERE tenant_id=? AND mode=? GROUP BY kind, severity",
            (tenant_id, mode.upper()))
        peak_notional = max((r["quantity"] * r["avg_price"] for r in rows), default=0.0)
        return {**self._meta(rows, mode.upper()),
                "daily_loss_cutoff": daily_cutoff,
                "worst_daily_realised_net": round(worst, 2),
                "daily_loss_utilisation_pct": round(max(0.0, -worst) / daily_cutoff * 100, 1) if daily_cutoff else None,
                "days_locked": sum(1 for r in d if r["locked"]),
                "peak_position_notional": round(peak_notional, 2),
                "exposure_utilisation_pct": round(peak_notional / max_exposure * 100, 1) if max_exposure else None,
                "risk_events": [{"kind": e["kind"], "severity": e["severity"], "count": e["n"]} for e in ev],
                "entries_by_day": [{"date": r["trade_date"], "entries": r["entries"]} for r in d]}

    def execution_quality(self, tenant_id: str, mode: str, *, accounts: list[str] | None = None,
                          d_from: date | None = None, d_to: date | None = None) -> dict[str, Any]:
        sql = "SELECT * FROM order_intents WHERE tenant_id=? AND mode=?"
        p: list[Any] = [tenant_id, _mode(mode)]
        if accounts is not None:
            if not accounts:
                return {**self._meta([], mode.upper()), "orders": 0}
            sql += f" AND account_id IN ({','.join('?' * len(accounts))})"
            p += accounts
        if d_from:
            sql += " AND substr(created_at,1,10) >= ?"
            p.append(d_from.isoformat())
        if d_to:
            sql += " AND substr(created_at,1,10) <= ?"
            p.append(d_to.isoformat())
        orders = self.store.query(sql, tuple(p))
        ack = [x for x in (_ms(o["submitted_at"], o["acked_at"]) for o in orders) if x is not None]
        fill = [x for x in (_ms(o["submitted_at"], o["first_fill_at"]) for o in orders) if x is not None]
        slip = []
        for o in orders:
            if o["filled_qty"] and o["avg_price"] and o["ref_price"] and o["role"] in ("ENTRY", "EXIT"):
                sign = 1 if o["side"] == "BUY" else -1
                slip.append(sign * (o["avg_price"] - o["ref_price"]) / o["ref_price"] * 10_000)
        states: dict[str, int] = defaultdict(int)
        for o in orders:
            states[o["state"]] += 1
        sent = [o for o in orders if o["submitted_at"]]
        partial = sum(1 for o in orders if 0 < o["filled_qty"] < o["quantity"])
        return {**self._meta([], mode.upper()), "orders": len(orders), "submitted": len(sent),
                "by_state": dict(states),
                "rejection_rate": round(states.get("REJECTED", 0) / len(sent), 4) if sent else None,
                "partial_fills": partial,
                "unknown_status_orders": states.get("UNKNOWN", 0),
                "latency_ms": {"submit_to_ack": {"n": len(ack), "p50": _pct(ack, .5), "p95": _pct(ack, .95)},
                               "submit_to_first_fill": {"n": len(fill), "p50": _pct(fill, .5), "p95": _pct(fill, .95)}},
                "slippage_bps": {"n": len(slip), "mean": round(sum(slip) / len(slip), 3) if slip else None,
                                 "p95": _pct(slip, .95)},
                "note": "latency uses locally persisted timestamps; paper latency is simulated"
                if mode.upper() == "PAPER" else "latency uses locally persisted timestamps"}

    def reconciliation_summary(self, tenant_id: str, mode: str) -> dict[str, Any]:
        r = self.store.query(
            "SELECT kind, status, COUNT(*) n FROM reconciliation_discrepancies WHERE tenant_id=? AND mode=? "
            "GROUP BY kind, status", (tenant_id, mode.upper()))
        return {"as_of": now_ist().isoformat(), "mode": mode.upper(),
                "discrepancies": [{"kind": x["kind"], "status": x["status"], "count": x["n"]} for x in r]}

    def audit_log(self, tenant_id: str, *, action: str | None = None, actor: str | None = None,
                  d_from: date | None = None, d_to: date | None = None, limit: int = 200, offset: int = 0) -> dict:
        sql = "SELECT id, ts, account_id, mode, bot_id, actor, action, details, hash FROM audit_events WHERE tenant_id=?"
        p: list[Any] = [tenant_id]
        for col, v in (("action", action), ("actor", actor)):
            if v:
                sql += f" AND {col}=?"
                p.append(v)
        if d_from:
            sql += " AND substr(ts,1,10) >= ?"
            p.append(d_from.isoformat())
        if d_to:
            sql += " AND substr(ts,1,10) <= ?"
            p.append(d_to.isoformat())
        sql += " ORDER BY id DESC LIMIT ? OFFSET ?"
        p += [min(limit, 1000), offset]
        rows = self.store.query(sql, tuple(p))
        ok, bad_id = self.store.verify_audit_chain()
        return {"as_of": now_ist().isoformat(), "chain_valid": ok, "first_invalid_id": bad_id,
                "items": [dict(r) for r in rows]}


def to_float_rows(rows: Iterable[dict]) -> list[dict]:
    return list(rows)
