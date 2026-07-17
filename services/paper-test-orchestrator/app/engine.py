"""Deterministic paper/backtest replay without lookahead."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from advisory_core.contracts import PaperTestMetrics, RmsDecision
from advisory_core.telemetry import paper_tests_completed_count, paper_tests_started_count
from mcp_connectors import get_connector
from strategy_normalizer import StrategyNormalizer


class PaperTestOrchestrator:
    def __init__(self) -> None:
        self.normalizer = StrategyNormalizer()
        self.results: dict[str, dict[str, Any]] = {}

    async def run(
        self,
        strategy_option: dict[str, Any],
        user_id: str,
        account_id: str | None = None,
        initial_capital: float | None = None,
    ) -> dict[str, Any]:
        paper_tests_started_count.inc()
        start = datetime.now(timezone.utc)
        capital = float(
            initial_capital
            or (strategy_option.get("position_sizing_json") or {}).get("required_capital")
            or 50000
        )

        rules = {
            "entry_rules": strategy_option.get("entry_rules_json") or [],
            "exit_rules": strategy_option.get("exit_rules_json") or [],
            "risk_rules": strategy_option.get("risk_rules_json") or [],
            "position_sizing": strategy_option.get("position_sizing_json") or {},
            "instruments": strategy_option.get("instruments_json") or ["RELIANCE"],
            "timeframe": strategy_option.get("timeframe") or "5m",
            "strategy_type": strategy_option.get("strategy_type") or "vwap_breakout",
            "stop_loss_required": True,
            "daily_max_loss": (strategy_option.get("position_sizing_json") or {}).get("required_capital", capital) * 0.02,
            "unbounded_options_risk": any(
                r.get("type") == "unbounded_options_risk"
                for r in (strategy_option.get("risk_rules_json") or [])
            ),
        }
        from advisory_core.contracts import StrategyRules

        sr = StrategyRules(**rules)
        rms = self.normalizer.validate_rms(sr, historical_bars=60)
        if not rms.allowed:
            result = self._fail(strategy_option, user_id, account_id, start, capital, rms)
            paper_tests_completed_count.labels(status="failed").inc()
            return result

        paper = get_connector("paper", initial_cash=capital)
        await paper.connect()
        symbol = (sr.instruments or ["RELIANCE"])[0].split(":")[-1]
        bars = await paper.get_historical_data(symbol, sr.timeframe, start, start)
        # Anti-lookahead: only use bar i after seeing bars[:i+1]
        cash = capital
        position = 0
        entry_price = 0.0
        wins = 0
        losses = 0
        trades = 0
        equity_curve = [capital]
        peak = capital
        max_dd = 0.0
        breaches: list[dict[str, Any]] = []
        stop_pct = 1.5
        for r in sr.risk_rules:
            if r.get("type") == "stop_loss":
                stop_pct = float(r.get("value_pct") or 1.5)

        # Skip first 21 bars for indicator warm-up (no future leak)
        for i in range(21, len(bars) - 1):
            window = bars[: i + 1]
            price = float(window[-1]["close"])
            # Simple signal: close > SMA20 => long, else flat
            sma = sum(float(b["close"]) for b in window[-20:]) / 20
            signal = 1 if price > sma else 0

            # RMS simulation gate for each potential order
            if signal == 1 and position == 0:
                qty = max(int((cash * 0.1) / price), 0)
                order_value = qty * price
                if order_value > cash:
                    continue
                if not self._rms_sim_allow(order_value, cash):
                    breaches.append({"type": "rms_block", "bar": i})
                    continue
                position = qty
                entry_price = price
                cash -= qty * price * 1.0005  # costs/slippage
                trades += 1
            elif position > 0:
                pnl_pct = (price - entry_price) / entry_price * 100
                if pnl_pct <= -stop_pct or signal == 0:
                    cash += position * price * 0.9995
                    if price >= entry_price:
                        wins += 1
                    else:
                        losses += 1
                    position = 0
                    trades += 1

            mtm = cash + position * price
            equity_curve.append(mtm)
            peak = max(peak, mtm)
            dd = (peak - mtm) / peak * 100 if peak else 0
            max_dd = max(max_dd, dd)

        # Flatten
        if position > 0:
            last = float(bars[-1]["close"])
            cash += position * last * 0.9995
            trades += 1
            if last >= entry_price:
                wins += 1
            else:
                losses += 1
            position = 0

        final = cash
        pnl = final - capital
        pnl_pct = (pnl / capital) * 100 if capital else 0
        win_rate = (wins / (wins + losses) * 100) if (wins + losses) else 0
        returns = []
        for a, b in zip(equity_curve, equity_curve[1:]):
            if a:
                returns.append((b - a) / a)
        sharpe = None
        if returns:
            mean = sum(returns) / len(returns)
            var = sum((r - mean) ** 2 for r in returns) / len(returns)
            std = math.sqrt(var) if var > 0 else 0
            sharpe = (mean / std) * math.sqrt(252) if std else None

        qualified = (
            trades >= 5
            and max_dd <= 15.0
            and not any(b.get("type") == "rms_block" for b in breaches)
            and not sr.unbounded_options_risk
        )
        status = "passed" if qualified else "failed" if trades < 5 or max_dd > 15 else "breached"

        metrics = PaperTestMetrics(
            initial_capital=capital,
            final_capital=round(final, 2),
            pnl=round(pnl, 2),
            pnl_percent=round(pnl_pct, 2),
            max_drawdown=round(max_dd, 2),
            win_rate=round(win_rate, 2),
            trade_count=trades,
            profit_factor=round(wins / losses, 2) if losses else None,
            sharpe_ratio=round(sharpe, 3) if sharpe is not None else None,
            risk_breaches=breaches,
            result_status=status,  # type: ignore[arg-type]
            qualified_for_live=qualified and strategy_option.get("source_license_status") not in (
                "license_unknown",
                "not_verified",
            ),
        )
        end = datetime.now(timezone.utc)
        result = {
            "id": str(uuid4()),
            "strategy_option_id": strategy_option["id"],
            "user_id": user_id,
            "account_id": account_id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "dataset_version": f"paper-replay-{len(bars)}",
            **metrics.model_dump(),
        }
        self.results[result["id"]] = result
        paper_tests_completed_count.labels(status=status).inc()
        return result

    def _rms_sim_allow(self, order_value: float, cash: float) -> bool:
        if order_value <= 0 or order_value > cash:
            return False
        if order_value > 100000:
            return False
        return True

    def _fail(self, option, user_id, account_id, start, capital, rms: RmsDecision):
        end = datetime.now(timezone.utc)
        result = {
            "id": str(uuid4()),
            "strategy_option_id": option["id"],
            "user_id": user_id,
            "account_id": account_id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "initial_capital": capital,
            "final_capital": capital,
            "pnl": 0,
            "pnl_percent": 0,
            "max_drawdown": 0,
            "win_rate": 0,
            "trade_count": 0,
            "profit_factor": None,
            "sharpe_ratio": None,
            "risk_breaches": [{"type": "preflight", "reasons": rms.reasons}],
            "result_status": "failed",
            "qualified_for_live": False,
            "dataset_version": "none",
        }
        self.results[result["id"]] = result
        return result
