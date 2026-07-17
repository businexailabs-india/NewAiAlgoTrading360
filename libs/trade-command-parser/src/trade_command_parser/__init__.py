"""Parse natural-language trading commands into structured fields."""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field


class ParsedTradeCommand(BaseModel):
    exchange: str | None = "NSE"
    symbol: str | None = None
    asset_class: str | None = "equity"
    order_side: Literal["BUY", "SELL"] | None = None
    quantity: int | None = None
    amount: float | None = None
    timeframe: str | None = None
    strategy_type: str | None = None
    risk_limit: float | None = None
    stop_loss: float | None = None
    target: float | None = None
    product_type: str | None = "MIS"
    paper_or_live: Literal["paper", "live"] = "paper"
    broker_account: str | None = None
    language: str | None = None
    confirmation_required: bool = True
    raw_text: str = ""
    extras: dict[str, Any] = Field(default_factory=dict)


SYMBOL_ALIASES = {
    "reliance": "RELIANCE",
    "tcs": "TCS",
    "infosys": "INFY",
    "infy": "INFY",
    "hdfc": "HDFCBANK",
    "hdfcbank": "HDFCBANK",
    "nifty": "NIFTY",
    "banknifty": "BANKNIFTY",
    "nifty bank": "BANKNIFTY",
    "sensex": "SENSEX",
    "itc": "ITC",
    "sbin": "SBIN",
    "sbi": "SBIN",
}

STRATEGY_HINTS = [
    (r"vwap", "vwap_breakout"),
    (r"rsi", "rsi_mean_reversion"),
    (r"super\s*trend", "supertrend"),
    (r"bollinger", "bollinger_mean_reversion"),
    (r"opening\s*range|orb", "opening_range_breakout"),
    (r"moving\s*average|ma\s*cross", "ma_crossover"),
    (r"straddle", "options_straddle_monitor"),
    (r"strangle", "options_strangle_monitor"),
    (r"rebalance", "portfolio_rebalance"),
]


class TradingCommandParser:
    def parse(self, text: str, language: str | None = None) -> ParsedTradeCommand:
        t = text or ""
        lower = t.lower()
        cmd = ParsedTradeCommand(raw_text=t, language=language)

        for alias, sym in SYMBOL_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", lower):
                cmd.symbol = sym
                break

        if re.search(r"\bbuy|खरीद|खरीदो\b", lower):
            cmd.order_side = "BUY"
        elif re.search(r"\bsell|बेच|बेचो\b", lower):
            cmd.order_side = "SELL"

        qty = re.search(r"\b(\d+)\s*(shares?|qty|quantity|lots?)?\b", lower)
        if qty and cmd.order_side:
            cmd.quantity = int(qty.group(1))

        amt = re.search(r"(?:₹|rs\.?\s*)(\d+(?:\.\d+)?)", lower)
        if amt:
            cmd.amount = float(amt.group(1))

        risk = re.search(r"max\s*loss\s*(?:₹|rs\.?\s*)?(\d+)", lower)
        if risk:
            cmd.risk_limit = float(risk.group(1))

        sl = re.search(r"stop[- ]?loss\s*(?:₹|rs\.?\s*|at\s*)?(\d+(?:\.\d+)?)", lower)
        if sl:
            cmd.stop_loss = float(sl.group(1))

        tgt = re.search(r"target\s*(?:₹|rs\.?\s*|at\s*)?(\d+(?:\.\d+)?)", lower)
        if tgt:
            cmd.target = float(tgt.group(1))

        if re.search(r"\b(5\s*m|5\s*min|five\s*minute)\b", lower):
            cmd.timeframe = "5m"
        elif re.search(r"\b(15\s*m|15\s*min)\b", lower):
            cmd.timeframe = "15m"
        elif re.search(r"intraday", lower):
            cmd.timeframe = "5m"
            cmd.product_type = "MIS"

        for pattern, stype in STRATEGY_HINTS:
            if re.search(pattern, lower):
                cmd.strategy_type = stype
                break

        if re.search(r"\blive\b", lower) and not re.search(r"paper", lower):
            cmd.paper_or_live = "live"
        else:
            cmd.paper_or_live = "paper"

        if re.search(r"option|straddle|strangle|put|call", lower):
            cmd.asset_class = "options"

        if cmd.order_side or cmd.paper_or_live == "live":
            cmd.confirmation_required = True

        return cmd
