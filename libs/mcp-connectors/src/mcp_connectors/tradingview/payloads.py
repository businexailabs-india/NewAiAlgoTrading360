"""TradingView alert payload templates (paper/signal only)."""

from __future__ import annotations

from typing import Any, Literal

PayloadKind = Literal["BUY", "SELL", "EXIT", "STOP_LOSS", "OPTIONS", "MULTI_ACCOUNT", "STANDARD"]


def build_payload_template(kind: PayloadKind, secret_placeholder: str = "USER_WEBHOOK_SECRET") -> dict[str, Any]:
    base: dict[str, Any] = {
        "secret": secret_placeholder,
        "strategy_id": "strat_tv_1",
        "symbol": "{{ticker}}",
        "exchange": "{{exchange}}",
        "timeframe": "{{interval}}",
        "price": "{{close}}",
        "quantity": 1,
        "timestamp": "{{time}}",
        "mode": "PAPER",
    }
    if kind == "BUY":
        return {**base, "side": "BUY", "signal_type": "VWAP_BREAKOUT", "stop_loss": 0, "target": 0}
    if kind == "SELL":
        return {**base, "side": "SELL", "signal_type": "VWAP_BREAKDOWN", "stop_loss": 0, "target": 0}
    if kind == "EXIT":
        return {**base, "side": "EXIT", "signal_type": "EXIT_POSITION", "quantity": 0}
    if kind == "STOP_LOSS":
        return {**base, "side": "SELL", "signal_type": "STOP_LOSS", "stop_loss": "{{close}}"}
    if kind == "OPTIONS":
        return {
            **base,
            "side": "BUY",
            "signal_type": "LONG_CALL",
            "asset_class": "OPTION",
            "stop_loss": 0,
            "target": 0,
        }
    if kind == "MULTI_ACCOUNT":
        return {
            **base,
            "side": "BUY",
            "signal_type": "MULTI_ACCOUNT",
            "accounts": [
                {"label": "paper-main", "allocation_pct": 60},
                {"label": "paper-sat", "allocation_pct": 40},
            ],
        }
    return {
        "secret": secret_placeholder,
        "symbol": "{{ticker}}",
        "side": "BUY",
        "signal_type": "TV_ALERT",
        "price": "{{close}}",
        "timestamp": "{{time}}",
        "mode": "PAPER",
    }


def system_payload_templates() -> list[dict[str, Any]]:
    kinds: list[PayloadKind] = [
        "BUY",
        "SELL",
        "EXIT",
        "STOP_LOSS",
        "OPTIONS",
        "MULTI_ACCOUNT",
        "STANDARD",
    ]
    return [
        {
            "name": f"TradingView {kind}",
            "kind": kind,
            "template": build_payload_template(kind),
            "is_system": True,
            "live_trading_disabled": True,
        }
        for kind in kinds
    ]
