"""Normalized Indian trading enums and provider mapping helpers."""

from __future__ import annotations

from enum import StrEnum


class OrderSide(StrEnum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(StrEnum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL = "SL"
    SL_M = "SL_M"
    BRACKET = "BRACKET"
    COVER = "COVER"


class ProductType(StrEnum):
    INTRADAY = "INTRADAY"
    DELIVERY = "DELIVERY"
    MARGIN = "MARGIN"
    CNC = "CNC"
    MIS = "MIS"
    NRML = "NRML"


class OrderStatus(StrEnum):
    CREATED = "CREATED"
    PENDING = "PENDING"
    OPEN = "OPEN"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"


class Exchange(StrEnum):
    NSE = "NSE"
    BSE = "BSE"
    MCX = "MCX"
    NCDEX = "NCDEX"


class Segment(StrEnum):
    EQ = "EQ"
    FNO = "FNO"
    CDS = "CDS"
    MCX = "MCX"
    BFO = "BFO"
    NFO = "NFO"


DHAN_ORDER_STATUS = {
    "TRANSIT": OrderStatus.PENDING,
    "PENDING": OrderStatus.PENDING,
    "REJECTED": OrderStatus.REJECTED,
    "CANCELLED": OrderStatus.CANCELLED,
    "TRADED": OrderStatus.FILLED,
    "EXPIRED": OrderStatus.CANCELLED,
    "PART_TRADED": OrderStatus.PARTIALLY_FILLED,
    "CONFIRM": OrderStatus.OPEN,
}

DHAN_PRODUCT = {
    "CNC": ProductType.CNC,
    "INTRADAY": ProductType.MIS,
    "MARGIN": ProductType.NRML,
    "MTF": ProductType.MARGIN,
    "CO": ProductType.INTRADAY,
    "BO": ProductType.INTRADAY,
}

DHAN_ORDER_TYPE = {
    "MARKET": OrderType.MARKET,
    "LIMIT": OrderType.LIMIT,
    "STOP_LOSS": OrderType.SL,
    "STOP_LOSS_MARKET": OrderType.SL_M,
}

KITE_ORDER_STATUS = {
    "PUT ORDER REQ RECEIVED": OrderStatus.PENDING,
    "VALIDATION PENDING": OrderStatus.PENDING,
    "OPEN PENDING": OrderStatus.PENDING,
    "OPEN": OrderStatus.OPEN,
    "COMPLETE": OrderStatus.FILLED,
    "CANCELLED": OrderStatus.CANCELLED,
    "REJECTED": OrderStatus.REJECTED,
    "TRIGGER PENDING": OrderStatus.PENDING,
    "AMO REQ RECEIVED": OrderStatus.PENDING,
}

KITE_PRODUCT = {"CNC": ProductType.CNC, "MIS": ProductType.MIS, "NRML": ProductType.NRML}
KITE_ORDER_TYPE = {
    "MARKET": OrderType.MARKET,
    "LIMIT": OrderType.LIMIT,
    "SL": OrderType.SL,
    "SL-M": OrderType.SL_M,
}

SMARTAPI_ORDER_STATUS = {
    "open": OrderStatus.OPEN,
    "complete": OrderStatus.FILLED,
    "cancelled": OrderStatus.CANCELLED,
    "rejected": OrderStatus.REJECTED,
    "trigger pending": OrderStatus.PENDING,
    "after market order req received": OrderStatus.PENDING,
}

PRODUCT_ALIASES = {
    "CNC": ProductType.CNC,
    "DELIVERY": ProductType.DELIVERY,
    "MIS": ProductType.MIS,
    "INTRADAY": ProductType.INTRADAY,
    "NRML": ProductType.NRML,
    "MARGIN": ProductType.MARGIN,
}


def map_order_status(provider: str, status: str) -> OrderStatus:
    key = (status or "").strip()
    table = {
        "dhan": DHAN_ORDER_STATUS,
        "zerodha": KITE_ORDER_STATUS,
        "angelone": SMARTAPI_ORDER_STATUS,
    }.get(provider.lower(), {})
    if key in table:
        return table[key]
    upper = key.upper().replace("-", "_").replace(" ", "_")
    try:
        return OrderStatus(upper)
    except ValueError:
        for known in OrderStatus:
            if known.value in upper or upper in known.value:
                return known
        return OrderStatus.UNKNOWN


def map_product_type(provider: str, product: str) -> ProductType:
    key = (product or "").strip().upper()
    table = {"dhan": DHAN_PRODUCT, "zerodha": KITE_PRODUCT}.get(provider.lower(), {})
    if key in table:
        return table[key]
    if key in PRODUCT_ALIASES:
        return PRODUCT_ALIASES[key]
    return ProductType.CNC


def map_order_type(provider: str, order_type: str) -> OrderType:
    raw = (order_type or "").strip()
    if provider.lower() == "zerodha" and raw in KITE_ORDER_TYPE:
        return KITE_ORDER_TYPE[raw]
    key = raw.upper().replace(" ", "_").replace("-", "_")
    table = {
        "dhan": DHAN_ORDER_TYPE,
        "zerodha": {k.upper().replace("-", "_"): v for k, v in KITE_ORDER_TYPE.items()},
    }.get(provider.lower(), {})
    if key in table:
        return table[key]
    try:
        return OrderType(key)
    except ValueError:
        return OrderType.MARKET


def normalize_symbol(exchange: str, symbol: str) -> str:
    sym = (symbol or "").strip().upper()
    if ":" in sym:
        return sym
    ex = (exchange or "NSE").strip().upper()
    return f"{ex}:{sym}"


def denormalize_symbol(normalized: str, style: str = "plain") -> str:
    value = (normalized or "").strip().upper()
    if style == "kite" and ":" not in value:
        return f"NSE:{value}"
    if ":" in value:
        exchange, symbol = value.split(":", 1)
        if style == "plain":
            return symbol
        if style in ("kite", "angelone"):
            return f"{exchange}:{symbol}"
        return symbol
    return value
