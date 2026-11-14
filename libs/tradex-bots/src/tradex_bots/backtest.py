"""Event-driven backtester. Uses the SAME bot logic, risk engine, sizing and fee model as paper/live.

Execution model (all conservative):
* Signals are evaluated on COMPLETED candles only and executed at the NEXT candle's open.
* Stop-loss: triggered if low <= stop (fill at stop, or at the open on a gap below it) with adverse slippage.
* Target: limit fill at the target (or open on a gap above) with exit slippage applied (conservative).
* If one candle touches both stop and target, the STOP is assumed to have hit first.
* EMA/Supertrend exits are decided on a completed candle and executed at the next open.
* Forced square-off executes at the open of the first candle starting at/after the square-off time.
* Position, daily-loss, exposure and capital limits come from the central RiskEngine.
"""

from __future__ import annotations

import csv
import json
import random
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import pandas as pd

from tradex_bots.bots.base import BotStrategy, Features, GuardState
from tradex_bots.config import EngineConfig, ExecutionMode
from tradex_bots.costs import SLIPPAGE_SCENARIOS, Execution, FeeModelRegistry
from tradex_bots.data_quality import (
    CorporateAction,
    DataQualityReport,
    MarketCalendar,
    adjust_for_corporate_actions,
    check_candles,
    event_days,
)
from tradex_bots.instruments import Instrument
from tradex_bots.metrics import TradeRecord, compute_metrics
from tradex_bots.models import ExitReason, Side, TradeLevels
from tradex_bots.risk import EntryRequest, Health, OpenRisk, RiskEngine
from tradex_bots.store import Store
from tradex_bots.timeutil import now_ist


@dataclass
class BacktestSettings:
    slippage_scenario: str = "base"
    modelled_spread_bps: float = 0.0  # half of this is added to entry / removed from exit reference prices
    rejection_rate: float = 0.0  # simulated broker rejections of entries (seeded)
    seed: int = 7
    skip_days_with_gaps: bool = True


@dataclass
class _Pos:
    symbol: str
    qty: int
    entry_fill: float
    entry_ref: float
    levels: TradeLevels
    entry_ts: datetime
    pending_exit: ExitReason | None = None


@dataclass
class _Pending:
    i: int
    decision: Any


@dataclass
class BacktestResult:
    bot_id: str
    kind: str
    date_from: str
    date_to: str
    trades: list[TradeRecord]
    metrics: dict[str, Any]
    rejections: dict[str, int]
    signals_generated: int
    quality: dict[str, dict]
    config: dict[str, Any]
    run_id: str = field(default_factory=lambda: str(uuid4()))

    # ---------------------------------------------------------------- exports
    def to_csv(self, path: str | Path) -> None:
        rows = [t.to_row() for t in self.trades]
        with open(path, "w", newline="", encoding="utf-8") as fh:
            if not rows:
                fh.write("")
                return
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)

    def to_dict(self) -> dict[str, Any]:
        return {"run_id": self.run_id, "bot_id": self.bot_id, "kind": self.kind, "date_from": self.date_from,
                "date_to": self.date_to, "metrics": self.metrics, "rejections": self.rejections,
                "signals_generated": self.signals_generated, "data_quality": self.quality, "config": self.config,
                "trades": [t.to_row() for t in self.trades]}

    def to_json(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2, default=str), encoding="utf-8")

    def persist(self, store: Store, tenant_id: str = "", account_id: str = "") -> str:
        c = self.config
        with store.tx() as db:
            db.execute(
                "INSERT INTO backtest_runs(run_id,tenant_id,account_id,bot_id,strategy_version,config_hash,params_json,"
                "symbols,date_from,date_to,slippage_scenario,fee_version,vwap_method,kind,created_at,metrics_json,"
                "data_quality) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (self.run_id, tenant_id, account_id, self.bot_id, c["bot"]["version"], c["bot"]["config_hash"],
                 json.dumps(c["bot"]["params"], default=str), ",".join(c["symbols"]), self.date_from, self.date_to,
                 c["slippage_scenario"], c["fee_version"], c["vwap_method"], self.kind, now_ist().isoformat(),
                 json.dumps(self.metrics, default=str), json.dumps(self.quality, default=str)))
            for t in self.trades:
                db.execute(
                    "INSERT INTO backtest_trades(run_id,symbol,entry_ts,exit_ts,quantity,entry_price,exit_price,"
                    "gross_pnl,slippage_cost,charges,net_pnl,r_multiple,exit_reason,segment) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (self.run_id, t.symbol, t.entry_ts.isoformat(), t.exit_ts.isoformat(), t.quantity,
                     t.entry_price, t.exit_price, t.gross_pnl, t.slippage_cost, t.charges, t.net_pnl, t.r_multiple,
                     t.exit_reason, self.kind))
        return self.run_id


class Backtester:
    def __init__(
        self,
        bot: BotStrategy,
        data: dict[str, pd.DataFrame],
        instruments: dict[str, Instrument],
        engine: EngineConfig | None = None,
        fees: FeeModelRegistry | None = None,
        settings: BacktestSettings | None = None,
        calendar: MarketCalendar | None = None,
        actions: list[CorporateAction] | None = None,
        universe: dict[str, tuple[date, date]] | None = None,
    ):
        self.bot, self.engine = bot, engine or EngineConfig()
        self.fees = fees or FeeModelRegistry()
        self.s = settings or BacktestSettings()
        self.instruments = instruments
        self.universe = universe or {}
        self.event_days = event_days(actions or [])
        self.feats: dict[str, Features] = {}
        self.quality: dict[str, DataQualityReport] = {}
        self.vwap_method = ""
        for sym, df in data.items():
            if sym not in instruments:
                raise KeyError(f"no instrument metadata for {sym}")
            d = adjust_for_corporate_actions(df, actions or []) if actions else df
            d, rep = check_candles(d, calendar, skip_days_with_gaps=self.s.skip_days_with_gaps)
            self.quality[sym] = rep
            if len(d):
                f = bot.features(d)
                self.feats[sym] = f
                self.vwap_method = f.vwap_method
        self.trading_days = sorted({day for f in self.feats.values() for day in f.session})

    # ------------------------------------------------------------------ run
    def run(self, date_from: date | None = None, date_to: date | None = None, kind: str = "FULL") -> BacktestResult:
        bot, p, risk_cfg = self.bot, self.bot.p, self.engine.risk
        slip = SLIPPAGE_SCENARIOS[self.s.slippage_scenario]
        store = Store(":memory:")
        risk = RiskEngine(self.engine, store, self.fees.for_date(date(2020, 1, 1)), ExecutionMode.BACKTEST)
        risk.log_rejections = False
        guard, rng = GuardState(), random.Random(self.s.seed)
        half_spread = self.s.modelled_spread_bps / 20_000.0
        d0 = date_from or (self.trading_days[0] if self.trading_days else date.min)
        d1 = date_to or (self.trading_days[-1] if self.trading_days else date.max)

        events = [(f.start[i], sym, i) for sym, f in self.feats.items() for i in range(f.n) if d0 <= f.session[i] <= d1]
        events.sort(key=lambda e: (e[0], e[1]))

        positions: dict[str, _Pos] = {}
        pending: dict[str, _Pending] = {}
        trades: list[TradeRecord] = []
        rej: Counter[str] = Counter()
        signals = 0
        realized_total = 0.0

        def open_risks(last: dict[str, float]) -> list[OpenRisk]:
            return [OpenRisk(s, ps.qty, ps.entry_fill, last.get(s, ps.entry_fill)) for s, ps in positions.items()]

        def funds() -> float:
            return risk_cfg.capital_inr + realized_total - sum(ps.entry_fill * ps.qty for ps in positions.values())

        def close(ps: _Pos, ref: float, reason: ExitReason, ts: datetime, tick: float, day: date) -> None:
            nonlocal realized_total
            exit_fill = slip.exit_price(ref, tick)
            model = self.fees.for_date(day)
            charges = float(model.charges([Execution("b", Side.BUY, ps.qty, ps.entry_fill),
                                           Execution("s", Side.SELL, ps.qty, exit_fill)]).total)
            gross = ps.qty * (ref - ps.entry_ref)
            slippage = ps.qty * ((ps.entry_fill - ps.entry_ref) + (ref - exit_fill))
            net = ps.qty * (exit_fill - ps.entry_fill) - charges
            init_risk = ps.qty * ps.levels.stop_distance
            trades.append(TradeRecord(
                symbol=ps.symbol, entry_ts=ps.entry_ts, exit_ts=ts, quantity=ps.qty, entry_price=ps.entry_fill,
                exit_price=exit_fill, entry_ref=ps.entry_ref, exit_ref=ref, gross_pnl=round(gross, 2),
                slippage_cost=round(slippage, 2), charges=round(charges, 2), net_pnl=round(net, 2),
                initial_risk=round(init_risk, 2), r_multiple=round(net / init_risk, 3) if init_risk else 0.0,
                exit_reason=reason.value, bot_id=bot.bot_id, mode="BACKTEST"))
            realized_total += net
            risk.record_closed_trade(ts, gross, charges, net)
            guard.record_exit(bot.bot_id, ps.symbol, ts, net)
            del positions[ps.symbol]

        last_close: dict[str, float] = {}
        for start, sym, idx in events:
            f, inst = self.feats[sym], self.instruments[sym]
            tick, day = inst.tick_size, f.session[idx]
            o, h, l, c = f["open"][idx], f["high"][idx], f["low"][idx], f["close"][idx]
            end = start + pd.Timedelta(minutes=p.candle_minutes)
            last_close[sym] = c
            ps = positions.get(sym)

            # (a) pending entry from the previous completed candle -> execute at this open
            pend = pending.pop(sym, None)
            if pend is not None and ps is None:
                ps = self._try_enter(bot, risk, guard, rng, f, inst, pend, idx, start, funds(),
                                     open_risks(last_close), rej, half_spread, slip, positions)
                if ps is not None:
                    positions[sym] = ps

            # (b) exits inside this candle
            if ps is not None:
                if bot.is_squareoff_time(start):
                    close(ps, o, ExitReason.TIME_SQUAREOFF, start, tick, day)
                elif ps.pending_exit is not None:
                    reason = ExitReason.STOP_LOSS if o <= ps.levels.stop_price else ps.pending_exit
                    close(ps, o, reason, start, tick, day)
                elif o <= ps.levels.stop_price:  # gap through the stop
                    close(ps, o, ExitReason.STOP_LOSS, start, tick, day)
                elif o >= ps.levels.target_price:  # gap above the target
                    close(ps, o, ExitReason.TARGET, start, tick, day)
                elif l <= ps.levels.stop_price:  # stop wins any same-candle collision
                    close(ps, ps.levels.stop_price, ExitReason.STOP_LOSS, start, tick, day)
                elif h >= ps.levels.target_price:
                    close(ps, ps.levels.target_price, ExitReason.TARGET, start, tick, day)

            # (c) end-of-candle decisions (only completed-candle information)
            ps = positions.get(sym)
            if ps is not None:
                sig = bot.exit_signal(f, idx)
                if sig is not None and ps.pending_exit is None:
                    ps.pending_exit = sig
                if risk.evaluate_daily_lock(end, open_risks(last_close)) and ps.pending_exit is None:
                    ps.pending_exit = ExitReason.DAILY_LOSS
                nxt_ok = idx + 1 < f.n and bool(f.gap_ok[idx + 1])
                if not nxt_ok:  # last candle available for this session: nothing to execute at a next open
                    close(ps, c, ExitReason.END_OF_DATA, end, tick, day)
            elif sym not in pending:
                if day in self.event_days or (self.s.skip_days_with_gaps and day in self.quality[sym].bad_days):
                    continue
                if sym in self.universe and not (self.universe[sym][0] <= day <= self.universe[sym][1]):
                    continue
                dec = bot.evaluate_at(f, idx)
                if dec.signal:
                    signals += 1
                    pending[sym] = _Pending(idx, dec)

        m = compute_metrics(trades, risk_cfg.capital_inr, [d for d in self.trading_days if d0 <= d <= d1])
        cfg = {
            "bot": bot.describe(), "risk": risk_cfg.model_dump(mode="json"), "slippage_scenario": self.s.slippage_scenario,
            "modelled_spread_bps": self.s.modelled_spread_bps, "rejection_rate": self.s.rejection_rate,
            "fee_version": self.fees.for_date(d1 if d1 != date.max else date(2030, 1, 1)).version,
            "vwap_method": self.vwap_method, "symbols": sorted(self.feats),
            "execution_model": "next-candle-open; stop-first on collision; slippage on all exits",
        }
        return BacktestResult(bot.bot_id, kind, d0.isoformat(), d1.isoformat(), trades, m, dict(rej), signals,
                              {s: r.to_dict() for s, r in self.quality.items()}, cfg)

    # ------------------------------------------------------------------ entry
    def _try_enter(self, bot, risk, guard, rng, f, inst, pend, idx, start, funds, open_risks, rej, half_spread,
                   slip, positions):
        p, sig_i = bot.p, pend.i
        if not f.gap_ok[idx]:
            rej["data_gap"] += 1
            return None
        ref = f["open"][idx] * (1 + half_spread)
        sig_close = f["close"][sig_i]
        if abs(ref - sig_close) / sig_close * 100 > p.max_entry_deviation_pct:
            rej["price_deviated_from_signal"] += 1
            return None
        ok, why = guard.can_enter(bot, f.symbol, start)
        if not ok:
            rej[why] += 1
            return None
        levels, why = bot.build_levels(f, sig_i, ref, inst.tick_size)
        if levels is None:
            rej[why] += 1
            return None
        req = EntryRequest(bot.bot_id, f.symbol, inst, levels, p, start, funds, Health(), None,
                           open_risks, 0, False)
        risk.fees = self.fees.for_date(f.session[idx])  # rates in force on the trade date
        dec = risk.check_entry(req)
        if not dec.approved:
            for r in dec.reasons:
                rej[r] += 1
            return None
        if rng.random() < self.s.rejection_rate:
            rej["simulated_broker_rejection"] += 1
            return None
        entry_fill = slip.entry_price(levels.entry_price, inst.tick_size)
        risk.record_entry(start)
        guard.record_entry(bot.bot_id, f.symbol, start)
        return _Pos(f.symbol, dec.sizing.quantity, entry_fill, levels.entry_price, levels, start)
