"""MockLLMProvider — default deterministic provider for Phase 2."""

from __future__ import annotations

import json
from typing import Any

from llm_providers.base import (
    AdvisoryLLMOutput,
    BaseLLMProvider,
    StrategyDraftLLMOutput,
    validate_ai_json,
)


class MockLLMProvider(BaseLLMProvider):
    name = "mock"

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str:
        lang = context.get("language") or "en"
        mode = context.get("mode") or ""
        if mode == "advisory" or "advisory" in (prompt or "").lower():
            payload = await self.generate_advisory_json(prompt, context)
            return json.dumps(payload)
        return f"[mock:{lang}] Acknowledged. Paper-first. Risk warning applies."

    async def classify_intent(self, text: str) -> dict[str, Any]:
        lower = (text or "").lower()
        if "algo" in lower or "strategy" in lower or "banao" in lower:
            return {"intent": "strategy_creation", "confidence": 0.85}
        if "buy" in lower or "sell" in lower:
            return {"intent": "live_trade_request", "confidence": 0.8}
        return {"intent": "market_query", "confidence": 0.6}

    async def generate_strategy_draft(self, text: str, context: dict[str, Any]) -> dict[str, Any]:
        lower = (text or "").lower()
        symbol = context.get("symbol") or "RELIANCE"
        if "reliance" in lower:
            symbol = "RELIANCE"
        elif "tcs" in lower:
            symbol = "TCS"
        draft = {
            "strategy_type": "vwap_breakout",
            "symbol": symbol,
            "timeframe": "5m",
            "paper_only": True,
            "live_trading_enabled": False,
            "entry_rules": [
                {"indicator": "vwap", "condition": "price_above", "volume_confirmation": True}
            ],
            "exit_rules": [
                {"type": "stop_loss_atr", "multiplier": 1.5},
                {"type": "target_rr", "ratio": 2.0},
            ],
            "risk_rules": [
                {"type": "stop_loss", "required": True},
                {"type": "daily_max_loss", "value": 2000},
            ],
            "rationale": "Mock draft for paper testing only — not a trade instruction.",
        }
        return validate_ai_json(draft, StrategyDraftLLMOutput)

    async def generate_advisory_json(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        margin = float(context.get("available_margin") or 50000)
        force_no_trade = bool(context.get("force_no_trade") or context.get("data_stale"))
        if force_no_trade:
            recs = [
                {
                    "title": "No-Trade / Stand Aside",
                    "type": "no_trade",
                    "symbols": [],
                    "confidence_score": 0.85,
                    "risk_score": 0.15,
                    "required_capital": 0,
                    "timeframe": "1d",
                    "rationale": "Stale or unsafe conditions — preserve capital.",
                },
                {
                    "title": "Paper Watchlist — Conservative Intraday",
                    "type": "conservative_intraday",
                    "symbols": ["NSE:TCS"],
                    "confidence_score": 0.35,
                    "risk_score": 0.3,
                    "required_capital": min(10000, margin),
                    "timeframe": "5m",
                    "rationale": "Educational paper candidate only while data is stale.",
                },
                {
                    "title": "Paper Watchlist — VWAP Study",
                    "type": "vwap_breakout",
                    "symbols": ["NSE:RELIANCE"],
                    "confidence_score": 0.32,
                    "risk_score": 0.4,
                    "required_capital": min(15000, margin),
                    "timeframe": "5m",
                    "rationale": "Study VWAP structure on paper; do not deploy live.",
                },
            ]
        else:
            recs = [
                {
                    "title": "VWAP Breakout Intraday Strategy",
                    "type": "vwap_breakout",
                    "symbols": ["NSE:RELIANCE", "NSE:TCS"],
                    "confidence_score": 0.72,
                    "risk_score": 0.48,
                    "required_capital": min(margin * 0.2, 50000),
                    "timeframe": "5m",
                    "rationale": "Volume expansion above VWAP is a candidate — not a certainty.",
                },
                {
                    "title": "Conservative Intraday Mean-Reversion Candidate",
                    "type": "conservative_intraday",
                    "symbols": ["NSE:TCS", "NSE:INFY"],
                    "confidence_score": 0.62,
                    "risk_score": 0.35,
                    "required_capital": min(margin * 0.15, 40000),
                    "timeframe": "5m",
                    "rationale": "Lower size with strict stop-loss under moderate conditions.",
                },
                {
                    "title": "RSI Mean Reversion Candidate",
                    "type": "rsi_mean_reversion",
                    "symbols": ["NSE:ITC", "NSE:SBIN"],
                    "confidence_score": 0.6,
                    "risk_score": 0.5,
                    "required_capital": min(margin * 0.15, 40000),
                    "timeframe": "15m",
                    "rationale": "Oversold RSI may present candidates; invalidation is mandatory.",
                },
                {
                    "title": "Portfolio Rebalance Monitor",
                    "type": "portfolio_rebalance",
                    "symbols": ["PORTFOLIO"],
                    "confidence_score": 0.55,
                    "risk_score": 0.4,
                    "required_capital": 0,
                    "timeframe": "1d",
                    "rationale": "Review concentration and drift; paper rebalance first.",
                },
            ]
        payload = {
            "summary": "Mock advisory — paper-first. Trading involves risk; profit is not guaranteed.",
            "recommendations": recs,
            "warnings": list(context.get("guardrails") or ["Paper trading required"]),
            "paper_only": True,
            "live_trading_enabled": False,
        }
        return validate_ai_json(payload, AdvisoryLLMOutput)
