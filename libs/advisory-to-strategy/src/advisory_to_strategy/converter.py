"""Convert advisory recommendations into Phase 1 StrategyConfig."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from schemas.risk import RiskRules
from schemas.strategy import RISK_WARNING, StrategyConfig, StrategyStatus
from strategy_normalizer import StrategyNormalizer

_TYPE_TO_ENGINE: dict[str, str] = {
    "vwap_breakout": "vwap_breakout",
    "conservative_intraday": "rsi_mean_reversion",
    "aggressive_intraday": "ma_crossover",
    "rsi_mean_reversion": "rsi_mean_reversion",
    "moving_average_crossover": "ma_crossover",
    "opening_range_breakout": "opening_range_breakout",
    "supertrend": "supertrend",
    "bollinger_mean_reversion": "bollinger_mean_reversion",
    "protective_put": "ma_crossover",
    "portfolio_rebalance": "ma_crossover",
    "no_trade": "ma_crossover",
}


def convert_recommendation_to_strategy_config(
    recommendation: dict[str, Any],
    *,
    created_by: str = "advisory",
) -> StrategyConfig:
    return AdvisoryToStrategyConverter().convert(recommendation, created_by=created_by)


class AdvisoryToStrategyConverter:
    def __init__(self, normalizer: StrategyNormalizer | None = None):
        self.normalizer = normalizer or StrategyNormalizer()

    def convert(
        self,
        recommendation: dict[str, Any],
        *,
        created_by: str = "advisory",
    ) -> StrategyConfig:
        preferred = (
            recommendation.get("recommendation_type")
            or recommendation.get("type")
            or "vwap_breakout"
        )
        rules = self.normalizer.normalize_from_recommendation(
            recommendation, strategy_type=str(preferred)
        )
        rms = self.normalizer.validate_rms(rules, historical_bars=60)
        if not rms.allowed:
            raise ValueError(f"RMS validation failed: {', '.join(rms.reasons)}")

        rtype = (rules.strategy_type or "vwap_breakout").lower()
        engine_type = _TYPE_TO_ENGINE.get(rtype, "vwap_breakout")
        symbols = [self._clean_symbol(s) for s in (rules.instruments or ["RELIANCE"])]
        symbols = [s for s in symbols if s and s != "PORTFOLIO"] or ["RELIANCE"]

        stop_pct = 1.5
        daily_max = float(rules.daily_max_loss or 25000)
        for rr in rules.risk_rules:
            if rr.get("type") == "stop_loss" and rr.get("value_pct") is not None:
                stop_pct = float(rr["value_pct"])
            if rr.get("type") == "daily_max_loss" and rr.get("value") is not None:
                daily_max = float(rr["value"])

        entry = rules.entry_rules[0] if rules.entry_rules else {"type": "price_above_vwap_volume"}
        exit_r = rules.exit_rules[0] if rules.exit_rules else {"type": "stop_or_target"}
        if isinstance(entry, list):
            entry = entry[0] if entry else {}
        if isinstance(exit_r, list):
            exit_r = exit_r[0] if exit_r else {}

        return StrategyConfig(
            strategy_id=str(uuid4()),
            strategy_name=str(recommendation.get("title") or "Advisory Strategy"),
            strategy_type=engine_type,
            symbols=symbols,
            timeframe=rules.timeframe or "5m",
            entry_rules=dict(entry) if isinstance(entry, dict) else {"rules": entry},
            exit_rules=dict(exit_r) if isinstance(exit_r, dict) else {"rules": exit_r},
            risk_rules=RiskRules(
                stop_loss_percent=stop_pct,
                max_daily_loss=daily_max,
                max_position_value=float(
                    (rules.position_sizing or {}).get("required_capital") or 200000
                )
                * 2,
            ),
            position_sizing={
                **(rules.position_sizing or {}),
                "method": (rules.position_sizing or {}).get("method") or "fixed_fraction",
                "max_qty": 10,
            },
            paper_trading_required=True,
            live_trading_enabled=False,
            created_by=created_by,
            status=StrategyStatus.DRAFT,
            parameters={
                "template_id": engine_type,
                "source": "ai_advisory",
                "recommendation_type": rtype,
                "advisory_legacy_rules": {
                    "entry_rules": rules.entry_rules,
                    "exit_rules": rules.exit_rules,
                    "risk_rules": rules.risk_rules,
                },
            },
            risk_warning=RISK_WARNING,
        )

    def to_option_payload(
        self,
        recommendation: dict[str, Any],
        strategy: StrategyConfig,
        *,
        tenant_id: str,
        user_id: str,
        recommendation_id: str,
    ) -> dict[str, Any]:
        preferred = (
            recommendation.get("recommendation_type")
            or recommendation.get("type")
            or strategy.strategy_type
        )
        rules = self.normalizer.normalize_from_recommendation(
            recommendation, strategy_type=str(preferred)
        )
        rms = self.normalizer.validate_rms(rules, historical_bars=60)
        legacy = self.normalizer.to_strategy_config(
            name=recommendation.get("title") or strategy.strategy_name,
            rules=rules,
            source_type="ai_generated",
            source_name="BusineXAi Advisory",
            license_status="internal",
        )
        return {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "advisory_recommendation_id": recommendation_id,
            "strategy_type": strategy.strategy_type,
            "strategy_name": strategy.strategy_name,
            "entry_rules_json": strategy.entry_rules,
            "exit_rules_json": strategy.exit_rules,
            "risk_rules_json": strategy.risk_rules.model_dump(),
            "position_sizing_json": strategy.position_sizing,
            "instruments_json": strategy.symbols,
            "timeframe": strategy.timeframe,
            "paper_test_required": True,
            "live_enabled": False,
            "source_type": "ai_generated",
            "source_name": "BusineXAi Advisory",
            "source_license_status": "internal",
            "validation_status": "rms_passed" if rms.allowed else "rms_failed",
            "config": legacy,
            "strategy_config": strategy.model_dump(mode="json"),
            "rms": rms.model_dump(),
        }

    @staticmethod
    def _clean_symbol(symbol: str) -> str:
        s = str(symbol or "").strip().upper()
        if ":" in s:
            s = s.split(":")[-1]
        return s
