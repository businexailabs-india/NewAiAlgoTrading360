"""Normalize advisory recommendations / external candidates into typed strategy DSL."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from advisory_core.contracts import RmsDecision, StrategyRules, reject_profit_promises

SUPPORTED_STRATEGY_TYPES = {
    "moving_average_crossover",
    "vwap_breakout",
    "rsi_mean_reversion",
    "opening_range_breakout",
    "supertrend",
    "bollinger_mean_reversion",
    "options_straddle_monitor",
    "options_strangle_monitor",
    "covered_call",
    "protective_put",
    "portfolio_rebalance",
    "basket",
    "no_trade",
    "conservative_intraday",
    "aggressive_intraday",
}


class StrategyNormalizer:
    def normalize_from_recommendation(
        self,
        recommendation: dict[str, Any],
        strategy_type: str | None = None,
    ) -> StrategyRules:
        stype = (strategy_type or recommendation.get("type") or "vwap_breakout").lower().replace(" ", "_")
        if stype not in SUPPORTED_STRATEGY_TYPES:
            # Map common advisory labels
            mapping = {
                "intraday": "conservative_intraday",
                "mean_reversion": "rsi_mean_reversion",
                "breakout": "vwap_breakout",
                "options_hedge": "protective_put",
                "rebalance": "portfolio_rebalance",
            }
            stype = mapping.get(stype, "vwap_breakout")

        title = reject_profit_promises(str(recommendation.get("title") or "Strategy"))
        symbols = recommendation.get("symbols") or ["NIFTY"]
        timeframe = recommendation.get("timeframe") or "5m"
        required_capital = float(recommendation.get("required_capital") or 50000)
        risk_score = float(recommendation.get("risk_score") or 0.5)

        stop_pct = 1.0 if risk_score < 0.4 else 1.5 if risk_score < 0.7 else 2.0
        daily_max_loss = max(required_capital * 0.01, 500)
        unbounded = stype in ("options_straddle_monitor", "options_strangle_monitor")

        entry = self._default_entry(stype, symbols)
        exit_rules = self._default_exit(stype, stop_pct)
        risk_rules = [
            {"id": "sl", "type": "stop_loss", "value_pct": stop_pct, "required": True},
            {"id": "dml", "type": "daily_max_loss", "value": daily_max_loss, "required": True},
            {"id": "idempotent", "type": "idempotent_orders", "value": True},
            {"id": "no_lookahead", "type": "anti_lookahead", "value": True},
        ]
        if unbounded:
            risk_rules.append(
                {
                    "id": "unbounded_options",
                    "type": "unbounded_options_risk",
                    "value": True,
                    "live_blocked_by_default": True,
                }
            )

        sizing = {
            "method": "fixed_fractional",
            "risk_per_trade_pct": 0.5 if risk_score < 0.5 else 1.0,
            "max_position_pct": 10,
            "required_capital": required_capital,
        }

        return StrategyRules(
            entry_rules=entry,
            exit_rules=exit_rules,
            risk_rules=risk_rules,
            position_sizing=sizing,
            instruments=list(symbols),
            timeframe=timeframe,
            strategy_type=stype,
            stop_loss_required=True,
            daily_max_loss=daily_max_loss,
            unbounded_options_risk=unbounded,
        )

    def normalize_external(self, raw: dict[str, Any]) -> StrategyRules:
        """Normalize declarative JSON only — never execute imported code."""
        if "code" in raw or "script" in raw or "python" in raw:
            raise ValueError("Executable code imports are not allowed; provide declarative rules JSON")
        rec = {
            "title": raw.get("title") or raw.get("name") or "External strategy",
            "type": raw.get("strategy_type") or raw.get("type") or "vwap_breakout",
            "symbols": raw.get("symbols") or raw.get("instruments") or [],
            "timeframe": raw.get("timeframe") or "5m",
            "required_capital": raw.get("required_capital") or 50000,
            "risk_score": raw.get("risk_score") or 0.6,
        }
        rules = self.normalize_from_recommendation(rec)
        # Prefer explicit rules if present and declarative
        if isinstance(raw.get("entry_rules"), list):
            rules.entry_rules = raw["entry_rules"]
        if isinstance(raw.get("exit_rules"), list):
            rules.exit_rules = raw["exit_rules"]
        if isinstance(raw.get("risk_rules"), list):
            rules.risk_rules = raw["risk_rules"]
        return rules

    def validate_rms(self, rules: StrategyRules, historical_bars: int = 0) -> RmsDecision:
        checks: dict[str, bool] = {}
        reasons: list[str] = []
        warnings: list[str] = []

        has_sl = any(r.get("type") == "stop_loss" for r in rules.risk_rules) or rules.stop_loss_required
        checks["stop_loss"] = has_sl
        if not has_sl:
            reasons.append("Stop-loss required")

        has_dml = rules.daily_max_loss is not None or any(
            r.get("type") == "daily_max_loss" for r in rules.risk_rules
        )
        checks["daily_max_loss"] = has_dml
        if not has_dml:
            reasons.append("Daily max loss required")

        has_size = bool(rules.position_sizing)
        checks["position_sizing"] = has_size
        if not has_size:
            reasons.append("Position sizing required")

        checks["historical_coverage"] = historical_bars >= 30
        if historical_bars < 30:
            reasons.append("Insufficient historical data for paper test (need >= 30 bars)")

        checks["anti_lookahead"] = any(r.get("type") == "anti_lookahead" for r in rules.risk_rules)
        checks["idempotent_orders"] = any(r.get("type") == "idempotent_orders" for r in rules.risk_rules)

        live_blocked = True
        paper_only = True
        if rules.unbounded_options_risk:
            warnings.append("Unlimited-loss options structure blocked for live by default")
            live_blocked = True

        allowed = all(
            [
                checks["stop_loss"],
                checks["daily_max_loss"],
                checks["position_sizing"],
            ]
        )
        return RmsDecision(
            allowed=allowed,
            reasons=reasons,
            warnings=warnings,
            paper_only=paper_only,
            live_blocked=live_blocked,
            checks=checks,
        )

    def to_strategy_config(
        self,
        name: str,
        rules: StrategyRules,
        source_type: str,
        source_name: str,
        license_status: str,
    ) -> dict[str, Any]:
        return {
            "id": str(uuid4()),
            "name": name,
            "version": 1,
            "strategy_type": rules.strategy_type,
            "entry_rules": rules.entry_rules,
            "exit_rules": rules.exit_rules,
            "risk_rules": rules.risk_rules,
            "position_sizing": rules.position_sizing,
            "instruments": rules.instruments,
            "timeframe": rules.timeframe,
            "paper_test_required": True,
            "live_enabled": False,
            "source_type": source_type,
            "source_name": source_name,
            "source_license_status": license_status,
            "backtest_config": {"lookback_bars": 60, "anti_lookahead": True},
            "paper_trading_config": {"broker": "paper", "initial_capital": rules.position_sizing.get("required_capital", 50000)},
        }

    def _default_entry(self, stype: str, symbols: list[str]) -> list[dict[str, Any]]:
        templates = {
            "moving_average_crossover": [
                {"indicator": "sma", "fast": 9, "slow": 21, "condition": "cross_above"}
            ],
            "vwap_breakout": [
                {"indicator": "vwap", "condition": "price_above", "volume_expansion": True}
            ],
            "rsi_mean_reversion": [{"indicator": "rsi", "period": 14, "condition": "lt", "value": 30}],
            "opening_range_breakout": [{"indicator": "orb", "minutes": 15, "condition": "break_high"}],
            "supertrend": [{"indicator": "supertrend", "period": 10, "multiplier": 3, "condition": "bullish"}],
            "bollinger_mean_reversion": [
                {"indicator": "bollinger", "period": 20, "condition": "touch_lower"}
            ],
            "no_trade": [{"condition": "always_false"}],
        }
        rules = templates.get(stype, templates["vwap_breakout"])
        return [{"id": "e1", "symbols": symbols, **rules[0]}]

    def _default_exit(self, stype: str, stop_pct: float) -> list[dict[str, Any]]:
        if stype == "no_trade":
            return [{"id": "x0", "condition": "n/a"}]
        return [
            {"id": "x1", "type": "stop_loss_pct", "value": stop_pct},
            {"id": "x2", "type": "target_pct", "value": stop_pct * 1.5},
            {"id": "x3", "type": "time_exit", "value": "session_end"},
        ]
