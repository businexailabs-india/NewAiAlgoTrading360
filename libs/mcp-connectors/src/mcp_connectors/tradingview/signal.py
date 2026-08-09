"""Normalize and preview TradingView alert payloads (never live-execute)."""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any
from uuid import uuid4

from mcp_connectors.tradingview.symbols import map_symbol


def _secret_hint(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 8:
        return "****"
    return f"{secret[:4]}…{secret[-4:]}"


def validate_webhook_secret(provided: str | None, expected: str | None) -> bool:
    if not expected:
        return False
    return hmac.compare_digest(str(provided or ""), str(expected))


def normalize_alert_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize a TradingView webhook body into a paper signal intent."""
    data = dict(payload or {})
    symbol_raw = str(data.get("symbol") or data.get("ticker") or "")
    exchange = str(data.get("exchange") or "") or None
    mapped = map_symbol(symbol_raw, exchange)
    side = str(data.get("side") or data.get("action") or "BUY").upper()
    if side in {"LONG", "ENTRY_LONG"}:
        side = "BUY"
    elif side in {"SHORT", "ENTRY_SHORT"}:
        side = "SELL"
    qty = int(float(data.get("quantity") or data.get("qty") or 1))
    price_raw = data.get("price") or data.get("close")
    try:
        price = float(price_raw) if price_raw not in (None, "", "{{close}}") else None
    except (TypeError, ValueError):
        price = None
    mode = str(data.get("mode") or "PAPER").upper()
    if mode not in {"PAPER", "SIGNAL"}:
        # Force non-live — MCP never accepts LIVE from TV alerts
        mode = "PAPER"
    ts = data.get("timestamp") or data.get("time") or int(time.time())
    signal_id = str(data.get("signal_id") or uuid4())
    return {
        "signal_id": signal_id,
        "strategy_id": data.get("strategy_id") or "tv_alert",
        "signal_type": data.get("signal_type") or "TV_ALERT",
        "symbol": mapped["symbol"],
        "exchange": mapped["exchange"],
        "segment": mapped.get("segment", "EQ"),
        "normalized_symbol": mapped["normalized"],
        "side": side,
        "quantity": max(0, qty),
        "price": price,
        "timeframe": data.get("timeframe") or data.get("interval"),
        "stop_loss": data.get("stop_loss"),
        "target": data.get("target"),
        "mode": mode,
        "timestamp": ts,
        "live_trading_disabled": True,
        "source": "tradingview",
        "raw_keys": sorted(data.keys()),
    }


def preview_signal(
    payload: dict[str, Any],
    *,
    expected_secret: str | None = None,
) -> dict[str, Any]:
    """Validate + normalize a TV alert for paper/signal path only."""
    provided = payload.get("secret") if isinstance(payload, dict) else None
    secret_ok = True
    warnings: list[str] = []
    if expected_secret:
        secret_ok = validate_webhook_secret(str(provided) if provided is not None else None, expected_secret)
        if not secret_ok:
            warnings.append("webhook_secret_mismatch")
    # Never echo raw secret into normalized signal
    stripped = {k: v for k, v in dict(payload or {}).items() if k.lower() != "secret"}
    if "secret" in (payload or {}):
        stripped["secret_hint"] = _secret_hint(str(provided or ""))
    normalized = normalize_alert_payload(stripped)

    accepted = secret_ok and bool(normalized.get("symbol")) and normalized.get("side") in {
        "BUY",
        "SELL",
        "EXIT",
    }
    if not normalized.get("symbol"):
        warnings.append("missing_symbol")
    if str(payload.get("mode") or "").upper() == "LIVE":
        warnings.append("live_mode_rejected_forced_paper")
        accepted = accepted and True  # still preview as paper

    idempotency = hashlib.sha256(
        f"{normalized.get('strategy_id')}|{normalized.get('symbol')}|{normalized.get('side')}|"
        f"{normalized.get('timestamp')}|{normalized.get('price')}".encode()
    ).hexdigest()[:24]

    return {
        "preview": True,
        "accepted": accepted,
        "mode": "PAPER",
        "provider_id": "tradingview",
        "live_trading_disabled": True,
        "live_order_execution": False,
        "warnings": warnings,
        "idempotency_key": idempotency,
        "signal": normalized,
        "next_step": "Preview → user approval → RMS → OMS → paper broker (never live from TV click)",
        "secret_ok": secret_ok,
    }
