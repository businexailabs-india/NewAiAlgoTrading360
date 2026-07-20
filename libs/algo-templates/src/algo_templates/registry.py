"""AlgoLibrary360 — MVP paper-only strategy templates."""

from __future__ import annotations

from typing import Any

from schemas.risk import RiskRules
from schemas.strategy import RISK_WARNING, StrategyConfig

_TEMPLATES: dict[str, dict[str, Any]] = {
    "ma_crossover": {
        "template_id": "ma_crossover",
        "name": "Moving Average Crossover",
        "strategy_type": "trend_following",
        "asset_class": "equity",
        "description": "Short MA crosses above long MA for entry; reverse or stop-loss for exit.",
        "inputs": {"short_period": 9, "long_period": 21, "timeframe": "5m"},
        "entry_rules": {"type": "ma_cross_above", "short": 9, "long": 21},
        "exit_rules": {"type": "ma_cross_below_or_stop"},
        "risk_rules": RiskRules(stop_loss_percent=2.0, max_daily_loss=25000, max_position_value=200000),
        "warnings": ["Trend strategies can underperform in sideways markets.", RISK_WARNING],
    },
    "rsi_mean_reversion": {
        "template_id": "rsi_mean_reversion",
        "name": "RSI Mean Reversion",
        "strategy_type": "mean_reversion",
        "asset_class": "equity",
        "description": "Enter when RSI is oversold; exit at neutral or stop-loss.",
        "inputs": {"rsi_period": 14, "oversold_level": 30, "overbought_level": 70, "exit_level": 50},
        "entry_rules": {"type": "rsi_oversold", "period": 14, "level": 30},
        "exit_rules": {"type": "rsi_neutral_or_stop", "exit_level": 50},
        "risk_rules": RiskRules(stop_loss_percent=1.5, max_trades_per_day=8, max_daily_loss=20000),
        "warnings": ["Mean-reversion can fail in strong trends.", RISK_WARNING],
    },
    "vwap_intraday": {
        "template_id": "vwap_intraday",
        "name": "VWAP Intraday",
        "strategy_type": "intraday",
        "asset_class": "equity",
        "description": "Hold above VWAP with volume confirmation; square-off intraday.",
        "inputs": {"timeframe": "5m", "vwap_tolerance": 0.001, "volume_confirmation": True},
        "entry_rules": {"type": "price_above_vwap_volume"},
        "exit_rules": {"type": "below_vwap_or_stop_or_squareoff"},
        "risk_rules": RiskRules(
            stop_loss_percent=1.0, max_daily_loss=15000, intraday_square_off_time="15:20"
        ),
        "warnings": ["Rejects stale market data.", RISK_WARNING],
    },
    "opening_range_breakout": {
        "template_id": "opening_range_breakout",
        "name": "Opening Range Breakout",
        "strategy_type": "breakout",
        "asset_class": "equity",
        "description": "Break above opening range high with buffer; EOD square-off.",
        "inputs": {"opening_range_minutes": 15, "breakout_buffer": 0.001},
        "entry_rules": {"type": "orb_break_high", "minutes": 15, "buffer": 0.001},
        "exit_rules": {"type": "stop_target_or_eod"},
        "risk_rules": RiskRules(stop_loss_percent=1.2, max_trades_per_day=3, max_daily_loss=20000),
        "warnings": ["False breakout guard active.", RISK_WARNING],
    },
    "supertrend": {
        "template_id": "supertrend",
        "name": "Supertrend Trend Following",
        "strategy_type": "trend_following",
        "asset_class": "equity",
        "description": "Enter when Supertrend turns bullish; exit on bearish flip or stop.",
        "inputs": {"atr_period": 10, "multiplier": 3.0},
        "entry_rules": {"type": "supertrend_bullish"},
        "exit_rules": {"type": "supertrend_bearish_or_stop"},
        "risk_rules": RiskRules(stop_loss_percent=2.5, max_daily_loss=30000),
        "warnings": ["Choppy markets may whipsaw Supertrend.", RISK_WARNING],
    },
    "bollinger_mean_reversion": {
        "template_id": "bollinger_mean_reversion",
        "name": "Bollinger Band Mean Reversion",
        "strategy_type": "mean_reversion",
        "asset_class": "equity",
        "description": "Enter near lower band; exit at middle/upper band.",
        "inputs": {"period": 20, "standard_deviation": 2.0},
        "entry_rules": {"type": "touch_lower_band_reversal"},
        "exit_rules": {"type": "middle_or_upper_band"},
        "risk_rules": RiskRules(stop_loss_percent=2.0, max_daily_loss=20000),
        "warnings": ["Trend markets can keep walking the bands.", RISK_WARNING],
    },
    "long_call_put": {
        "template_id": "long_call_put",
        "name": "Long Call / Long Put Options Algo",
        "strategy_type": "options_directional",
        "asset_class": "options",
        "description": "Directional long options; max loss limited to premium.",
        "inputs": {"symbol": "NIFTY", "expiry": "nearest_weekly", "strike_rule": "ATM"},
        "entry_rules": {"type": "bullish_or_bearish_signal"},
        "exit_rules": {"type": "premium_stop_target_or_expiry"},
        "risk_rules": RiskRules(
            stop_loss_percent=30.0, max_position_value=50000, max_daily_loss=15000, allow_options_selling=False
        ),
        "warnings": ["Options can expire worthless. Max loss = premium paid.", RISK_WARNING],
    },
    "covered_call": {
        "template_id": "covered_call",
        "name": "Covered Call Algo",
        "strategy_type": "options_income",
        "asset_class": "options",
        "description": "Suggest covered call against existing stock holding (paper only).",
        "inputs": {"stock_holding_required": True, "call_strike": "OTM", "expiry": "monthly"},
        "entry_rules": {"type": "requires_stock_holding"},
        "exit_rules": {"type": "expiry_or_buyback"},
        "risk_rules": RiskRules(stop_loss_percent=5.0, allow_options_selling=False, max_daily_loss=25000),
        "warnings": ["Upside is capped. Paper suggestion only — selling not auto-enabled.", RISK_WARNING],
    },
    "portfolio_rebalance": {
        "template_id": "portfolio_rebalance",
        "name": "Portfolio Rebalancing Algo",
        "strategy_type": "portfolio",
        "asset_class": "multi",
        "description": "Suggest buy/sell actions to reach target allocation.",
        "inputs": {"target_allocation": {"RELIANCE": 0.25, "TCS": 0.25, "INFY": 0.25, "HDFCBANK": 0.25}},
        "entry_rules": {"type": "rebalance_drift"},
        "exit_rules": {"type": "n/a"},
        "risk_rules": RiskRules(stop_loss_percent=1.0, max_position_value=300000, max_daily_loss=40000),
        "warnings": ["Watch portfolio concentration risk.", RISK_WARNING],
    },
    "ai_advisory_placeholder": {
        "template_id": "ai_advisory_placeholder",
        "name": "AI Advisory-to-Algo (placeholder)",
        "strategy_type": "ai_draft",
        "asset_class": "equity",
        "description": "Converts advisory recommendation JSON into a paper-only strategy draft.",
        "inputs": {"advisory_recommendation": {}},
        "entry_rules": {"type": "from_advisory"},
        "exit_rules": {"type": "from_advisory"},
        "risk_rules": RiskRules(),
        "warnings": ["AI drafts are paper-only. Never auto-deploy live.", RISK_WARNING],
    },
    "dhanlaxmi_prompt_placeholder": {
        "template_id": "dhanlaxmi_prompt_placeholder",
        "name": "DhanLaxmi Prompt-to-Algo (placeholder)",
        "strategy_type": "ai_draft",
        "asset_class": "equity",
        "description": "Converts a natural-language prompt into a paper-only strategy draft.",
        "inputs": {"user_prompt": ""},
        "entry_rules": {"type": "from_prompt"},
        "exit_rules": {"type": "from_prompt"},
        "risk_rules": RiskRules(),
        "warnings": ["Prompt drafts are paper-only. Live trading locked.", RISK_WARNING],
    },
}


def list_templates() -> list[dict[str, Any]]:
    return [
        {
            "template_id": t["template_id"],
            "name": t["name"],
            "strategy_type": t["strategy_type"],
            "asset_class": t["asset_class"],
            "description": t["description"],
            "inputs": t["inputs"],
            "live_trading_enabled": False,
            "paper_trading_required": True,
            "warnings": t["warnings"],
        }
        for t in _TEMPLATES.values()
    ]


def get_template(template_id: str) -> dict[str, Any]:
    if template_id not in _TEMPLATES:
        raise KeyError(template_id)
    return dict(_TEMPLATES[template_id])


def create_strategy_from_template(
    template_id: str,
    *,
    symbols: list[str] | None = None,
    parameters: dict[str, Any] | None = None,
    created_by: str = "demo-user",
    strategy_name: str | None = None,
) -> StrategyConfig:
    t = get_template(template_id)
    params = {**t["inputs"], **(parameters or {})}
    rr = t["risk_rules"]
    if isinstance(rr, dict):
        rr = RiskRules(**rr)
    return StrategyConfig(
        strategy_name=strategy_name or t["name"],
        strategy_type=t["strategy_type"],
        asset_class=t["asset_class"],
        symbols=symbols or (["RELIANCE"] if t["asset_class"] != "multi" else ["RELIANCE", "TCS", "INFY", "HDFCBANK"]),
        timeframe=str(params.get("timeframe") or "5m"),
        entry_rules=dict(t["entry_rules"]),
        exit_rules=dict(t["exit_rules"]),
        risk_rules=rr,
        parameters=params,
        template_id=template_id,
        created_by=created_by,
        live_trading_enabled=False,
        paper_trading_required=True,
    )


class AlgoLibrary360:
    list_templates = staticmethod(list_templates)
    get_template = staticmethod(get_template)
    create_strategy = staticmethod(create_strategy_from_template)
