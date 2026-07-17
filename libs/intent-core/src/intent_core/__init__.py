"""Intent classification for DhanLaxmi trading assistant."""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, Field


class IntentType(str, Enum):
    MARKET_QUERY = "market_query"
    PORTFOLIO_QUERY = "portfolio_query"
    POSITION_QUERY = "position_query"
    ORDER_STATUS_QUERY = "order_status_query"
    RISK_QUERY = "risk_query"
    STRATEGY_CREATION = "strategy_creation"
    BACKTEST_REQUEST = "backtest_request"
    PAPER_TRADE_REQUEST = "paper_trade_request"
    LIVE_TRADE_REQUEST = "live_trade_request"
    ORDER_APPROVAL = "order_approval"
    ORDER_REJECTION = "order_rejection"
    STOP_BOT = "stop_bot"
    KILL_SWITCH = "kill_switch"
    EDUCATIONAL_QUERY = "educational_query"
    COMPLIANCE_QUERY = "compliance_query"
    UNKNOWN_INTENT = "unknown_intent"


class IntentResult(BaseModel):
    intent: IntentType
    confidence: float = Field(ge=0.0, le=1.0)
    secondary_intents: list[IntentType] = Field(default_factory=list)
    requires_approval: bool = False
    paper_first: bool = True


RULES: list[tuple[IntentType, re.Pattern[str], float, bool]] = [
    (IntentType.KILL_SWITCH, re.compile(r"(kill\s*switch|emergency\s*stop|halt\s*all)", re.I), 0.95, True),
    (IntentType.STOP_BOT, re.compile(r"(stop\s+all\s+bots?|bots?\s+band|sab\s+bots?\s+band|no[- ]?trade\s+mode)", re.I), 0.93, True),
    (IntentType.ORDER_REJECTION, re.compile(r"(reject|cancel\s+order|mat\s+karo|nahi\s+chahiye)", re.I), 0.9, False),
    (IntentType.ORDER_APPROVAL, re.compile(r"(approve|confirm\s+order|haan\s+karo|go\s+ahead|proceed)", re.I), 0.88, True),
    (IntentType.LIVE_TRADE_REQUEST, re.compile(r"(live\s+trade|live\s+deploy|real\s+money|live\s+chala)", re.I), 0.92, True),
    (IntentType.PAPER_TRADE_REQUEST, re.compile(r"(paper\s+trad|paper\s+test|demo\s+trad|virtual\s+trad)", re.I), 0.9, False),
    (IntentType.BACKTEST_REQUEST, re.compile(r"(back\s*test|historical\s+test|backtest)", re.I), 0.9, False),
    (IntentType.STRATEGY_CREATION, re.compile(r"(algo\s+bana|strategy\s+bana|create\s+(algo|strategy)|setup\s+batao|straddle|strangle|vwap|rsi|supertrend)", re.I), 0.88, False),
    (IntentType.RISK_QUERY, re.compile(r"(risk|max\s*loss|drawdown|exposure|କେତେ\s*risk|जोखिम)", re.I), 0.9, False),
    (IntentType.PORTFOLIO_QUERY, re.compile(r"(portfolio|holdings?|मेरा\s+पोर्टफोलियो|ପୋର୍ଟଫୋଲିଓ)", re.I), 0.88, False),
    (IntentType.POSITION_QUERY, re.compile(r"(position|open\s+pos|pnl\s+aaj|unrealized)", re.I), 0.85, False),
    (IntentType.ORDER_STATUS_QUERY, re.compile(r"(order\s+status|mera\s+order|filled|pending\s+order)", re.I), 0.85, False),
    (IntentType.MARKET_QUERY, re.compile(r"(market\s+(kaisa|kaise|summary|status)|आज\s+market|nifty|sensex|bank\s*nifty)", re.I), 0.86, False),
    (IntentType.COMPLIANCE_QUERY, re.compile(r"(compliance|sebi|disclaimer|financial\s+advice)", re.I), 0.8, False),
    (IntentType.EDUCATIONAL_QUERY, re.compile(r"(kya\s+hai|what\s+is|explain|sikhao|meaning)", re.I), 0.75, False),
]


class IntentClassifier:
    def classify(self, text: str) -> IntentResult:
        matched: list[tuple[IntentType, float, bool]] = []
        for intent, pattern, conf, needs_approval in RULES:
            if pattern.search(text or ""):
                matched.append((intent, conf, needs_approval))
        if not matched:
            # Buy/sell language → live request path that forces approval
            if re.search(r"\b(buy|sell|purchase|order\s+place|खरीदो|बेचो)\b", text or "", re.I):
                return IntentResult(
                    intent=IntentType.LIVE_TRADE_REQUEST,
                    confidence=0.8,
                    requires_approval=True,
                    paper_first=True,
                )
            return IntentResult(intent=IntentType.UNKNOWN_INTENT, confidence=0.4)

        # Prefer strategy creation when user asks to build an algo (even if "paper" is mentioned)
        intents_only = {m[0] for m in matched}
        if IntentType.STRATEGY_CREATION in intents_only and re.search(
            r"(algo\s+bana|strategy\s+bana|create\s+(algo|strategy)|setup\s+batao)",
            text or "",
            re.I,
        ):
            primary = IntentType.STRATEGY_CREATION
            conf = next(m[1] for m in matched if m[0] == primary)
            needs_approval = False
            secondary = [m[0] for m in matched if m[0] != primary][:3]
        else:
            matched.sort(key=lambda x: x[1], reverse=True)
            primary, conf, needs_approval = matched[0]
            secondary = [m[0] for m in matched[1:3]]
        paper_first = primary not in (IntentType.ORDER_APPROVAL, IntentType.ORDER_REJECTION)
        return IntentResult(
            intent=primary,
            confidence=conf,
            secondary_intents=secondary,
            requires_approval=needs_approval
            or primary
            in (
                IntentType.LIVE_TRADE_REQUEST,
                IntentType.KILL_SWITCH,
                IntentType.STOP_BOT,
            ),
            paper_first=paper_first,
        )
