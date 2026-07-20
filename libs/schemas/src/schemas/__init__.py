"""Shared Pydantic schemas for Algo Library + Paper Trading MVP."""

from schemas.market import Candle, MarketQuote, MarketRegime
from schemas.paper import PaperOrder, PaperPosition, PaperTradingAccount, PaperTrade
from schemas.risk import RiskCheckResult, RiskRules
from schemas.strategy import (
    RISK_WARNING,
    StrategyConfig,
    StrategyStatus,
    StrategyValidationResult,
    SuitabilityScore,
)
from schemas.reports import PerformanceReport, PaperTestReport

__all__ = [
    "Candle",
    "MarketQuote",
    "MarketRegime",
    "PaperOrder",
    "PaperPosition",
    "PaperTradingAccount",
    "PaperTrade",
    "RiskCheckResult",
    "RiskRules",
    "RISK_WARNING",
    "StrategyConfig",
    "StrategyStatus",
    "StrategyValidationResult",
    "SuitabilityScore",
    "PerformanceReport",
    "PaperTestReport",
]
