"""Map IBKR market / historical data into normalized ticks and bars."""

from __future__ import annotations

from typing import Any

from .contract_mapper import normalize_symbol
from .models import IBKRHistoricalBar, IBKRMarketDataTick


TIMEFRAME_BAR_SIZE = {
    "1m": "1 min",
    "1min": "1 min",
    "5m": "5 mins",
    "5min": "5 mins",
    "15m": "15 mins",
    "1h": "1 hour",
    "1d": "1 day",
    "1day": "1 day",
    "day": "1 day",
}


def map_timeframe(timeframe: str) -> str:
    key = (timeframe or "1d").lower().strip()
    return TIMEFRAME_BAR_SIZE.get(key, "1 day")


def tick_from_raw(symbol: str, raw: dict[str, Any]) -> IBKRMarketDataTick:
    return IBKRMarketDataTick(
        symbol=normalize_symbol(symbol),
        bid=_f(raw.get("bid") or raw.get("bidPrice")),
        ask=_f(raw.get("ask") or raw.get("askPrice")),
        last=_f(raw.get("last") or raw.get("lastPrice") or raw.get("ltp")),
        close=_f(raw.get("close") or raw.get("closePrice")),
        volume=_f(raw.get("volume")),
        bid_size=_f(raw.get("bid_size") or raw.get("bidSize")),
        ask_size=_f(raw.get("ask_size") or raw.get("askSize")),
        currency=str(raw.get("currency") or "USD"),
        delayed=bool(raw.get("delayed", True)),
    )


def bars_from_raw(rows: list[dict[str, Any]]) -> list[IBKRHistoricalBar]:
    out: list[IBKRHistoricalBar] = []
    for r in rows:
        out.append(
            IBKRHistoricalBar(
                time=str(r.get("time") or r.get("date") or ""),
                open=float(r.get("open") or 0),
                high=float(r.get("high") or 0),
                low=float(r.get("low") or 0),
                close=float(r.get("close") or 0),
                volume=float(r.get("volume") or 0),
                bar_count=int(r["barCount"]) if r.get("barCount") is not None else None,
                wap=_f(r.get("wap") or r.get("average")),
            )
        )
    return out


def _f(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
