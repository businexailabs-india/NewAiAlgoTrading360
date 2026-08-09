"""Symbol mapping helpers for TradingView → platform symbols."""

from __future__ import annotations

from typing import Any

# Common TradingView ticker → NSE/BSE style mappings
_SYMBOL_MAP: dict[str, dict[str, str]] = {
    "RELIANCE": {"symbol": "RELIANCE", "exchange": "NSE", "segment": "EQ"},
    "TCS": {"symbol": "TCS", "exchange": "NSE", "segment": "EQ"},
    "INFY": {"symbol": "INFY", "exchange": "NSE", "segment": "EQ"},
    "HDFCBANK": {"symbol": "HDFCBANK", "exchange": "NSE", "segment": "EQ"},
    "NIFTY": {"symbol": "NIFTY", "exchange": "NSE", "segment": "IDX", "direct_trading_allowed": "false"},
    "BANKNIFTY": {"symbol": "BANKNIFTY", "exchange": "NSE", "segment": "IDX", "direct_trading_allowed": "false"},
    "SENSEX": {"symbol": "SENSEX", "exchange": "BSE", "segment": "IDX", "direct_trading_allowed": "false"},
}


def map_symbol(raw: str, exchange: str | None = None) -> dict[str, Any]:
    """Normalize TradingView ticker / exchange into platform fields."""
    text = (raw or "").strip().upper()
    # Strip common TV suffixes: RELIANCE:NSE, NSE:RELIANCE, RELIANCE.NS
    for sep in (":", "."):
        if sep in text:
            parts = [p for p in text.split(sep) if p]
            if len(parts) >= 2:
                if parts[0] in {"NSE", "BSE", "NYSE", "NASDAQ", "MCX"}:
                    exchange = exchange or parts[0]
                    text = parts[1]
                elif parts[-1] in {"NSE", "BSE", "NS", "BO", "NYSE", "NASDAQ"}:
                    suffix = parts[-1]
                    exchange = exchange or ("NSE" if suffix in {"NSE", "NS"} else "BSE" if suffix in {"BSE", "BO"} else suffix)
                    text = parts[0]
                else:
                    text = parts[0]
            break
    text = text.replace("-EQ", "").replace("_EQ", "")
    mapped = dict(_SYMBOL_MAP.get(text, {"symbol": text, "exchange": (exchange or "NSE").upper(), "segment": "EQ"}))
    if exchange:
        mapped["exchange"] = exchange.upper()
    mapped["provider_symbol"] = raw
    mapped["normalized"] = f"{mapped['exchange']}:{mapped['symbol']}"
    return mapped


def search_mapped_symbols(query: str) -> list[dict[str, Any]]:
    q = (query or "").upper()
    rows = [map_symbol(sym) for sym in _SYMBOL_MAP if q in sym]
    if not rows and q:
        rows = [map_symbol(q)]
    return rows
