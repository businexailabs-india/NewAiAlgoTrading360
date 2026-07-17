"""Strategy recommendation engine — deterministic candidates with compliance warnings."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from advisory_core.contracts import reject_profit_promises


SYMBOL_POOL = {
    "conservative_intraday": ["NSE:TCS", "NSE:INFY"],
    "aggressive_intraday": ["NSE:RELIANCE", "NSE:HDFCBANK"],
    "vwap_breakout": ["NSE:RELIANCE", "NSE:TCS"],
    "rsi_mean_reversion": ["NSE:ITC", "NSE:SBIN"],
    "protective_put": ["NSE:NIFTY"],
    "portfolio_rebalance": ["PORTFOLIO"],
    "no_trade": [],
}


class StrategyRecommendationEngine:
    def generate_options(
        self,
        option_types: list[str],
        regime: dict[str, Any],
        available_margin: float,
        paper_only: bool,
        guardrails: list[str],
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for otype in option_types:
            out.append(self._build(otype, regime, available_margin, paper_only, guardrails))
        return out

    def _build(
        self,
        otype: str,
        regime: dict[str, Any],
        available_margin: float,
        paper_only: bool,
        guardrails: list[str],
    ) -> dict[str, Any]:
        vol = regime.get("volatility") or "moderate"
        capital = min(max(available_margin * 0.2, 10000), available_margin or 50000)
        if otype == "no_trade":
            title = "No-Trade / Stand Aside"
            rationale = "Conditions favor capital preservation over new risk."
            confidence = 0.8
            risk = 0.2
            symbols: list[str] = []
        elif otype == "conservative_intraday":
            title = "Conservative Intraday Mean-Reversion Candidate"
            rationale = "Lower size intraday idea with strict stop-loss under moderate conditions."
            confidence = 0.62
            risk = 0.35
            symbols = SYMBOL_POOL[otype]
        elif otype == "aggressive_intraday":
            title = "Aggressive Intraday Momentum Candidate"
            rationale = "Higher participation candidate; paper test mandatory due to elevated risk."
            confidence = 0.55
            risk = 0.72 if vol in ("high", "extreme") else 0.58
            symbols = SYMBOL_POOL[otype]
            capital = min(capital, max(available_margin * 0.1, 5000))
        elif otype == "vwap_breakout":
            title = "VWAP Breakout Intraday Strategy"
            rationale = "Volume expansion with price trading above VWAP is a candidate setup — not a certainty."
            confidence = 0.72
            risk = 0.48
            symbols = SYMBOL_POOL[otype]
        elif otype == "rsi_mean_reversion":
            title = "RSI Mean Reversion Candidate"
            rationale = "Oversold RSI may present mean-reversion candidates; invalidation is mandatory."
            confidence = 0.6
            risk = 0.5
            symbols = SYMBOL_POOL[otype]
        elif otype == "protective_put":
            title = "Options Hedge / Protective Put Monitor"
            rationale = "Elevated volatility may justify hedge monitoring; options require paper qualification."
            confidence = 0.58
            risk = 0.55
            symbols = SYMBOL_POOL[otype]
        elif otype == "portfolio_rebalance":
            title = "Portfolio Rebalancing Idea"
            rationale = "Rebalance candidate based on concentration and regime — review before acting."
            confidence = 0.65
            risk = 0.4
            symbols = SYMBOL_POOL[otype]
        else:
            title = f"{otype.replace('_', ' ').title()} Candidate"
            rationale = "Generated strategy candidate for paper testing only."
            confidence = 0.5
            risk = 0.5
            symbols = ["NSE:NIFTY"]

        warnings = [
            "Paper test required",
            "Not financial advice — no guaranteed returns",
            "Live trading disabled by default",
            *guardrails,
        ]
        if paper_only:
            warnings.append("Paper-only until broker/RMS/qualification gates pass")
        if vol in ("high", "extreme"):
            warnings.append("Avoid if spread widens; reduce size")

        title = reject_profit_promises(title)
        rationale = reject_profit_promises(rationale)

        return {
            "id": str(uuid4()),
            "recommendation_type": otype,
            "title": title,
            "type": "intraday" if "intraday" in otype or otype in ("vwap_breakout", "rsi_mean_reversion") else otype,
            "summary": rationale,
            "symbols": symbols,
            "direction": "LONG" if otype != "no_trade" else "FLAT",
            "timeframe": "5m",
            "expected_holding_period": "intraday" if otype != "portfolio_rebalance" else "multi-day",
            "confidence_score": confidence,
            "risk_score": risk,
            "required_capital": round(capital, 2),
            "max_loss_estimate": round(capital * 0.02, 2),
            "stop_loss_required": True,
            "target_required": otype != "no_trade",
            "explanation": rationale,
            "rationale": rationale,
            "warnings": warnings,
            "actions": ["convert_to_algo", "paper_test", "save"] if otype != "no_trade" else ["dismiss"],
            "paper_only": True,
            "asset_class": "equity" if otype != "protective_put" else "options",
            "exchange": "NSE",
        }
