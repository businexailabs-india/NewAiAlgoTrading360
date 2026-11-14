"""Performance metrics computed purely from trade records (backtest rows or persisted positions)."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Iterable

import numpy as np

from tradex_bots.timeutil import to_ist


@dataclass
class TradeRecord:
    symbol: str
    entry_ts: datetime
    exit_ts: datetime
    quantity: int
    entry_price: float  # actual/modelled fill (includes slippage)
    exit_price: float
    entry_ref: float  # reference price before slippage
    exit_ref: float
    gross_pnl: float  # qty * (exit_ref - entry_ref)
    slippage_cost: float
    charges: float
    net_pnl: float  # gross - slippage - charges
    initial_risk: float  # qty * stop_distance
    r_multiple: float
    exit_reason: str
    bot_id: str = ""
    mode: str = ""

    def to_row(self) -> dict[str, Any]:
        d = asdict(self)
        d["entry_ts"], d["exit_ts"] = self.entry_ts.isoformat(), self.exit_ts.isoformat()
        return d


def compute_metrics(
    trades: Iterable[TradeRecord], starting_capital: float, trading_days: list | None = None
) -> dict[str, Any]:
    ts = sorted(trades, key=lambda t: t.exit_ts)
    n = len(ts)
    out: dict[str, Any] = {"trade_count": n, "starting_capital": starting_capital}
    if n == 0:
        out.update(net_profit=0.0, gross_profit_total=0.0, win_rate=None, profit_factor=None, expectancy=None,
                   max_drawdown_abs=0.0, max_drawdown_pct=0.0, sharpe=None, avg_r=None, by_hour={}, by_symbol={},
                   equity_curve=[])
        return out
    net = np.array([t.net_pnl for t in ts])
    gross = np.array([t.gross_pnl for t in ts])
    wins, losses = net[net > 0], net[net <= 0]
    gp, gl = float(wins.sum()), float(-losses.sum())
    equity = starting_capital + np.cumsum(net)
    peak = np.maximum.accumulate(np.concatenate([[starting_capital], equity]))[1:]
    dd = peak - equity
    dd_pct = dd / peak * 100.0
    charges = sum(t.charges for t in ts)
    slip = sum(t.slippage_cost for t in ts)
    out.update(
        net_profit=round(float(net.sum()), 2),
        net_return_pct=round(float(net.sum()) / starting_capital * 100.0, 3),
        gross_pnl_total=round(float(gross.sum()), 2),
        charges_total=round(charges, 2),
        slippage_total=round(slip, 2),
        charges_pct_of_gross_profit=round(charges / float(gross[gross > 0].sum()) * 100.0, 2)
        if (gross > 0).any() else None,
        win_rate=round(len(wins) / n, 4),
        avg_win=round(float(wins.mean()), 2) if len(wins) else 0.0,
        avg_loss=round(float(losses.mean()), 2) if len(losses) else 0.0,
        expectancy=round(float(net.mean()), 4),  # cost-adjusted expectancy per trade (INR)
        profit_factor=round(gp / gl, 3) if gl > 0 else (None if gp == 0 else math.inf),
        avg_r=round(float(np.mean([t.r_multiple for t in ts])), 3),
        max_drawdown_abs=round(float(dd.max()), 2),
        max_drawdown_pct=round(float(dd_pct.max()), 3),
        equity_curve=[(t.exit_ts.isoformat(), round(float(e), 2)) for t, e in zip(ts, equity, strict=True)],
        by_hour=_group(ts, lambda t: f"{to_ist(t.entry_ts).hour:02d}"),
        by_symbol=_group(ts, lambda t: t.symbol),
        exit_reasons=_group(ts, lambda t: t.exit_reason),
    )
    out["sharpe"] = _sharpe(ts, starting_capital, trading_days)
    return out


def _group(ts: list[TradeRecord], key) -> dict[str, dict[str, float]]:
    g: dict[str, list[float]] = {}
    for t in ts:
        g.setdefault(key(t), []).append(t.net_pnl)
    return {
        k: {"trades": len(v), "net": round(sum(v), 2), "win_rate": round(sum(1 for x in v if x > 0) / len(v), 3)}
        for k, v in sorted(g.items())
    }


def _sharpe(ts: list[TradeRecord], capital: float, trading_days: list | None) -> float | None:
    """Annualised Sharpe from daily net P&L / capital. Reported only with >= 30 trading days (else None)."""
    daily: dict = {}
    for t in ts:
        d = to_ist(t.exit_ts).date()
        daily[d] = daily.get(d, 0.0) + t.net_pnl
    days = sorted(set(trading_days or []) | set(daily))
    if len(days) < 30:
        return None
    r = np.array([daily.get(d, 0.0) / capital for d in days])
    sd = r.std(ddof=1)
    return round(float(r.mean() / sd * math.sqrt(252)), 3) if sd > 0 else None


ACCEPTANCE = {"min_profit_factor": 1.3, "min_trades": 100, "max_drawdown_pct": 5.0}


def evaluate_acceptance(m: dict[str, Any]) -> dict[str, Any]:
    """Research acceptance checks. A pass is NOT evidence of future profitability."""
    pf = m.get("profit_factor")
    checks = {
        "positive_net_expectancy": (m.get("expectancy") or 0) > 0,
        "profit_factor_above_1_3": pf is not None and pf > ACCEPTANCE["min_profit_factor"],
        "at_least_100_trades": m.get("trade_count", 0) >= ACCEPTANCE["min_trades"],
        "max_drawdown_below_5pct": m.get("max_drawdown_pct", 100) < ACCEPTANCE["max_drawdown_pct"],
    }
    return {"checks": checks, "all_passed": all(checks.values()),
            "disclaimer": "Evaluation targets only; passing is not evidence of future profitability."}
