"""Map normalized orders ↔ IBKR order fields."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from mcp_connectors.base.models import NormalizedOrderRequest

from .contract_mapper import normalize_symbol, to_contract_request
from .models import IBKROrderRequest, IBKROrderResponse


ORDER_TYPE_MAP = {
    "MKT": "MARKET",
    "MARKET": "MARKET",
    "LMT": "LIMIT",
    "LIMIT": "LIMIT",
    "STP": "STOP",
    "STOP": "STOP",
    "STP LMT": "STOP_LIMIT",
    "STOP_LIMIT": "STOP_LIMIT",
    "BRACKET": "BRACKET",
}

STATUS_MAP = {
    "PendingSubmit": "PENDING",
    "PendingCancel": "PENDING_CANCEL",
    "PreSubmitted": "PENDING",
    "Submitted": "SUBMITTED",
    "ApiPending": "PENDING",
    "ApiCancelled": "CANCELLED",
    "Cancelled": "CANCELLED",
    "Filled": "FILLED",
    "Inactive": "REJECTED",
    "PartialFilled": "PARTIAL",
    "PartiallyFilled": "PARTIAL",
}


def map_order_type(provider_order_type: str) -> str:
    return ORDER_TYPE_MAP.get((provider_order_type or "").upper().strip(), "MARKET")


def map_order_status(provider_status: str) -> str:
    key = (provider_status or "").strip()
    return STATUS_MAP.get(key, STATUS_MAP.get(key.title(), key.upper() or "UNKNOWN"))


def map_product_type(provider_product_type: str) -> str:
    p = (provider_product_type or "").upper()
    if p in ("DAY", "MIS", "INTRADAY"):
        return "INTRADAY"
    if p in ("MARGIN",):
        return "MARGIN"
    return "CNC"


def map_side(side: str) -> str:
    s = (side or "").upper()
    if s in ("BUY", "B", "BOT"):
        return "BUY"
    if s in ("SELL", "S", "SLD"):
        return "SELL"
    raise ValueError(f"Unsupported IBKR side: {side}")


def to_ibkr_order_request(order_request: NormalizedOrderRequest | dict[str, Any]) -> IBKROrderRequest:
    if isinstance(order_request, NormalizedOrderRequest):
        data = order_request.model_dump()
    else:
        data = dict(order_request)
    symbol = normalize_symbol(str(data.get("symbol") or ""))
    side = map_side(str(data.get("side") or "BUY"))
    order_type = map_order_type(str(data.get("order_type") or "MARKET"))
    qty = float(data.get("quantity") or 0)
    return IBKROrderRequest(
        symbol=symbol,
        side=side,  # type: ignore[arg-type]
        quantity=qty,
        order_type=order_type,  # type: ignore[arg-type]
        sec_type=str(data.get("sec_type") or "STK"),
        exchange=str(data.get("exchange") or "SMART"),
        currency=str(data.get("currency") or "USD"),
        limit_price=float(data["price"]) if data.get("price") is not None else None,
        stop_price=float(data["trigger_price"]) if data.get("trigger_price") is not None else None,
        tif=str(data.get("validity") or "DAY"),
        account_id=str(data.get("account_id") or ""),
        idempotency_key=str(data.get("idempotency_key") or uuid4()),
        oms_order_id=data.get("oms_order_id") or data.get("platform_order_id"),
        rms_approval_id=data.get("rms_approval_id"),
        user_approval_id=data.get("user_approval_id") or data.get("approval_id"),
        strategy_id=data.get("strategy_id"),
        caller_role=str(data.get("caller_role") or "user"),
        con_id=data.get("con_id"),
        last_trade_date_or_contract_month=data.get("last_trade_date_or_contract_month"),
        strike=data.get("strike"),
        right=data.get("right"),
        multiplier=data.get("multiplier"),
    )


def to_ibapi_order_dict(req: IBKROrderRequest) -> dict[str, Any]:
    """ibapi Order-compatible dict (no ibapi dependency)."""
    action = req.side
    ot = req.order_type
    ib_type = {
        "MARKET": "MKT",
        "LIMIT": "LMT",
        "STOP": "STP",
        "STOP_LIMIT": "STP LMT",
        "BRACKET": "MKT",  # placeholder parent
    }.get(ot, "MKT")
    out: dict[str, Any] = {
        "action": action,
        "totalQuantity": float(req.quantity),
        "orderType": ib_type,
        "tif": req.tif or "DAY",
        "account": req.account_id or "",
        "orderRef": (req.idempotency_key or "")[:48],
    }
    if ot in ("LIMIT", "STOP_LIMIT") and req.limit_price is not None:
        out["lmtPrice"] = float(req.limit_price)
    if ot in ("STOP", "STOP_LIMIT") and req.stop_price is not None:
        out["auxPrice"] = float(req.stop_price)
    return out


def contract_request_from_order(req: IBKROrderRequest):
    return to_contract_request(
        req.symbol,
        sec_type=req.sec_type,
        exchange=req.exchange,
        currency=req.currency,
        last_trade_date_or_contract_month=req.last_trade_date_or_contract_month,
        strike=req.strike,
        right=req.right,
        multiplier=req.multiplier,
        con_id=req.con_id,
    )


def response_from_client(
    *,
    provider_order_id: str | None,
    status: str,
    message: str = "",
    filled_qty: float = 0,
    avg_fill_price: float | None = None,
    mode: str = "paper",
    idempotency_key: str | None = None,
    raw: dict[str, Any] | None = None,
) -> IBKROrderResponse:
    redacted = {k: v for k, v in (raw or {}).items() if "account" not in k.lower() or "masked" in k.lower()}
    return IBKROrderResponse(
        provider_order_id=provider_order_id,
        status=map_order_status(status),
        message=message,
        filled_qty=filled_qty,
        avg_fill_price=avg_fill_price,
        mode=mode,
        idempotency_key=idempotency_key,
        raw_response_redacted=redacted,
    )
