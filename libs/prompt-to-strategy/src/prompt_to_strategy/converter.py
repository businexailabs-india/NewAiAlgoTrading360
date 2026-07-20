"""Convert natural-language prompts into strategy drafts / StrategyConfig.

Never executes trades. Live trading always disabled.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from schemas.risk import RiskRules
from schemas.strategy import RISK_WARNING, StrategyConfig, StrategyStatus

_SYMBOL_ALIASES = {
    "reliance": "RELIANCE",
    "tcs": "TCS",
    "infy": "INFY",
    "infosys": "INFY",
    "hdfc": "HDFCBANK",
    "hdfcbank": "HDFCBANK",
    "itc": "ITC",
    "sbin": "SBIN",
    "nifty": "NIFTY",
}

_TYPE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"vwap", re.I), "vwap_breakout"),
    (re.compile(r"rsi|mean.?reversion", re.I), "rsi_mean_reversion"),
    (re.compile(r"supertrend", re.I), "supertrend"),
    (re.compile(r"orb|opening.?range", re.I), "opening_range_breakout"),
    (re.compile(r"ma |crossover|moving.?average", re.I), "ma_crossover"),
    (re.compile(r"intraday|algo|banao|strategy", re.I), "vwap_breakout"),
]


def prompt_to_strategy_draft(
    prompt: str,
    *,
    language: str = "en",
    symbol: str | None = None,
    strategy_type: str | None = None,
    timeframe: str | None = None,
    created_by: str = "dhanlaxmi",
) -> dict[str, Any]:
    return PromptToStrategyConverter().to_draft(
        prompt,
        language=language,
        symbol=symbol,
        strategy_type=strategy_type,
        timeframe=timeframe,
        created_by=created_by,
    )


class PromptToStrategyConverter:
    def detect_symbol(self, prompt: str, fallback: str | None = None) -> str:
        lower = (prompt or "").lower()
        for alias, sym in _SYMBOL_ALIASES.items():
            if alias in lower:
                return sym
        return (fallback or "RELIANCE").upper()

    def detect_strategy_type(self, prompt: str, fallback: str | None = None) -> str:
        for pattern, stype in _TYPE_PATTERNS:
            if pattern.search(prompt or ""):
                return stype
        return fallback or "vwap_breakout"

    def to_draft(
        self,
        prompt: str,
        *,
        language: str = "en",
        symbol: str | None = None,
        strategy_type: str | None = None,
        timeframe: str | None = None,
        created_by: str = "dhanlaxmi",
        conversation_id: str | None = None,
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        stype = strategy_type or self.detect_strategy_type(prompt)
        sym = symbol or self.detect_symbol(prompt)
        tf = timeframe or "5m"
        draft_id = str(uuid4())
        strategy = self.to_strategy_config(
            prompt,
            symbol=sym,
            strategy_type=stype,
            timeframe=tf,
            created_by=created_by,
        )
        return {
            "id": draft_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "strategy_type": stype,
            "title": self._title(stype, sym),
            "symbol": sym,
            "exchange": "NSE",
            "timeframe": tf,
            "entry_rules": [
                {"indicator": "vwap", "condition": "price_above", "volume_confirmation": True}
                if "vwap" in stype
                else {"indicator": "rsi", "period": 14, "condition": "lt", "value": 30}
            ],
            "exit_rules": [
                {"type": "stop_loss_atr", "multiplier": 1.5},
                {"type": "target_rr", "ratio": 2.0},
            ],
            "risk_rules": [
                {"type": "stop_loss", "required": True},
                {"type": "daily_max_loss", "value": 2000},
                {"type": "anti_lookahead", "value": True},
            ],
            "paper_only": True,
            "live_enabled": False,
            "live_trading_enabled": False,
            "language": language,
            "prompt": prompt,
            "strategy_config": strategy.model_dump(mode="json"),
            "never_executes": True,
            "risk_warning": RISK_WARNING,
        }

    def to_strategy_config(
        self,
        prompt: str,
        *,
        symbol: str | None = None,
        strategy_type: str | None = None,
        timeframe: str = "5m",
        created_by: str = "dhanlaxmi",
    ) -> StrategyConfig:
        stype = strategy_type or self.detect_strategy_type(prompt)
        sym = symbol or self.detect_symbol(prompt)
        engine_type = stype if stype != "conservative_intraday" else "rsi_mean_reversion"
        return StrategyConfig(
            strategy_name=self._title(stype, sym),
            strategy_type=engine_type,
            symbols=[sym],
            timeframe=timeframe,
            entry_rules={"type": "price_above_vwap_volume"}
            if "vwap" in stype
            else {"type": "rsi_oversold", "period": 14, "level": 30},
            exit_rules={"type": "stop_target_or_squareoff"},
            risk_rules=RiskRules(stop_loss_percent=1.5, max_daily_loss=20000),
            position_sizing={"method": "fixed_fraction", "fraction": 0.1, "max_qty": 10},
            paper_trading_required=True,
            live_trading_enabled=False,
            created_by=created_by,
            status=StrategyStatus.DRAFT,
            parameters={"template_id": engine_type, "source": "dhanlaxmi_prompt", "prompt": prompt[:200]},
            risk_warning=RISK_WARNING,
        )

    @staticmethod
    def _title(stype: str, symbol: str) -> str:
        labels = {
            "vwap_breakout": "VWAP Breakout",
            "rsi_mean_reversion": "RSI Mean Reversion",
            "ma_crossover": "Moving Average Crossover",
            "opening_range_breakout": "Opening Range Breakout",
            "supertrend": "Supertrend",
        }
        return f"{labels.get(stype, stype)} — {symbol}"
