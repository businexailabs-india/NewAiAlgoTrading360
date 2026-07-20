"""Provider capability constants."""

from __future__ import annotations

from enum import StrEnum


class Capability(StrEnum):
    ACCOUNT_PROFILE = "ACCOUNT_PROFILE"
    MARGINS = "MARGINS"
    HOLDINGS = "HOLDINGS"
    POSITIONS = "POSITIONS"
    ORDERS = "ORDERS"
    TRADES = "TRADES"
    LIVE_QUOTES = "LIVE_QUOTES"
    WEBSOCKET_FEED = "WEBSOCKET_FEED"
    HISTORICAL_DATA = "HISTORICAL_DATA"
    OPTION_CHAIN = "OPTION_CHAIN"
    GREEKS = "GREEKS"
    ORDER_PREVIEW = "ORDER_PREVIEW"
    LIVE_ORDER_EXECUTION = "LIVE_ORDER_EXECUTION"
    PAPER_ORDER_EXECUTION = "PAPER_ORDER_EXECUTION"
    MODIFY_ORDER = "MODIFY_ORDER"
    CANCEL_ORDER = "CANCEL_ORDER"
    MARKET_DEPTH = "MARKET_DEPTH"
    FUNDAMENTALS = "FUNDAMENTALS"
    CORPORATE_ACTIONS = "CORPORATE_ACTIONS"
    NEWS = "NEWS"


YAML_CAPABILITY_ALIASES = {
    "account_profile": Capability.ACCOUNT_PROFILE,
    "test_account_profile": Capability.ACCOUNT_PROFILE,
    "account_profile_placeholder": Capability.ACCOUNT_PROFILE,
    "margins": Capability.MARGINS,
    "funds": Capability.MARGINS,
    "virtual_margins": Capability.MARGINS,
    "test_margins": Capability.MARGINS,
    "holdings": Capability.HOLDINGS,
    "virtual_holdings": Capability.HOLDINGS,
    "test_holdings": Capability.HOLDINGS,
    "holdings_placeholder": Capability.HOLDINGS,
    "positions": Capability.POSITIONS,
    "virtual_positions": Capability.POSITIONS,
    "test_positions": Capability.POSITIONS,
    "positions_placeholder": Capability.POSITIONS,
    "orders": Capability.ORDERS,
    "simulated_orders": Capability.ORDERS,
    "test_orders": Capability.ORDERS,
    "orders_placeholder": Capability.ORDERS,
    "trades": Capability.TRADES,
    "simulated_trades": Capability.TRADES,
    "live_quotes": Capability.LIVE_QUOTES,
    "simulated_live_quotes": Capability.LIVE_QUOTES,
    "test_market_data": Capability.LIVE_QUOTES,
    "market_data_placeholder": Capability.LIVE_QUOTES,
    "market_feed": Capability.WEBSOCKET_FEED,
    "websocket_feed": Capability.WEBSOCKET_FEED,
    "live_ticks": Capability.WEBSOCKET_FEED,
    "historical_data": Capability.HISTORICAL_DATA,
    "historical_replay": Capability.HISTORICAL_DATA,
    "eod_data": Capability.HISTORICAL_DATA,
    "option_chain": Capability.OPTION_CHAIN,
    "greeks": Capability.GREEKS,
    "order_preview": Capability.ORDER_PREVIEW,
    "live_order_execution": Capability.LIVE_ORDER_EXECUTION,
    "test_order_execution": Capability.PAPER_ORDER_EXECUTION,
    "paper_order_execution": Capability.PAPER_ORDER_EXECUTION,
    "modify_order": Capability.MODIFY_ORDER,
    "cancel_order": Capability.CANCEL_ORDER,
    "market_depth": Capability.MARKET_DEPTH,
    "fundamentals": Capability.FUNDAMENTALS,
    "corporate_actions": Capability.CORPORATE_ACTIONS,
    "news": Capability.NEWS,
    "symbol_master": Capability.FUNDAMENTALS,
    "reference_data": Capability.FUNDAMENTALS,
    "reference_data_placeholder": Capability.FUNDAMENTALS,
}


def normalize_capabilities(raw: list[str]) -> list[str]:
    out: list[str] = []
    for item in raw:
        key = (item or "").strip()
        if not key:
            continue
        if key.upper() in Capability.__members__:
            out.append(Capability[key.upper()].value)
            continue
        mapped = YAML_CAPABILITY_ALIASES.get(key.lower())
        out.append(mapped.value if mapped else key.upper())
    seen: set[str] = set()
    uniq: list[str] = []
    for c in out:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq
