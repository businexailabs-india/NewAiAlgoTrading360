"""
DhanHQ Python sidecar — wraps official dhanhq SDK for TradeOS360.

Env:
  DHAN_CLIENT_ID
  DHAN_ACCESS_TOKEN
  DHANHQ_SIDECAR_PORT=8099
  DHANHQ_ALLOW_LIVE_ORDERS=false   # must be true to place/cancel
"""

from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from .client import DhanHqClient, credentials_from_env

app = FastAPI(
    title="DhanHQ Sidecar",
    version="0.1.0",
    description="Official dhanhq (DhanHQ-py) bridge for BxAiTradePortfolioOps360",
)


class CredsBody(BaseModel):
    client_id: Optional[str] = None
    access_token: Optional[str] = None


class OptionChainBody(CredsBody):
    under_security_id: int = Field(13, description="NIFTY=13")
    under_exchange_segment: str = "IDX_I"
    expiry: str = Field(..., description="YYYY-MM-DD")


class QuoteBody(CredsBody):
    securities: dict[str, list[int]] = Field(
        default_factory=lambda: {"NSE_EQ": [1333]},
        description='e.g. {"NSE_EQ":[1333],"NSE_FNO":[52175]}',
    )


class PlaceOrderBody(CredsBody):
    security_id: str
    exchange_segment: str = "NSE_EQ"
    transaction_type: str = "BUY"
    quantity: int = 1
    order_type: str = "MARKET"
    product_type: str = "CNC"
    price: float = 0
    trigger_price: float = 0
    validity: str = "DAY"


class HistoricalBody(CredsBody):
    security_id: str
    exchange_segment: str = "NSE_EQ"
    instrument_type: str = "EQUITY"
    from_date: str
    to_date: str
    interval: str = "daily"  # daily | minute


def _client(body: CredsBody | None = None) -> DhanHqClient:
    cid = (body.client_id if body else None) or os.getenv("DHAN_CLIENT_ID", "")
    tok = (body.access_token if body else None) or os.getenv("DHAN_ACCESS_TOKEN", "")
    if not cid or not tok:
        raise HTTPException(
            status_code=400,
            detail="Missing DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN (env or request body)",
        )
    try:
        return DhanHqClient(cid, tok)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"dhanhq init failed: {exc}") from exc


@app.get("/health")
def health() -> dict[str, Any]:
    env_ok = bool(os.getenv("DHAN_CLIENT_ID") and os.getenv("DHAN_ACCESS_TOKEN"))
    sdk = "unknown"
    try:
        import dhanhq  # noqa: F401

        sdk = getattr(dhanhq, "__version__", "installed")
    except Exception as exc:  # noqa: BLE001
        sdk = f"missing: {exc}"
    return {
        "ok": True,
        "service": "dhanhq-sidecar",
        "sdk": sdk,
        "env_credentials": env_ok,
        "allow_live_orders": os.getenv("DHANHQ_ALLOW_LIVE_ORDERS", "false").lower() == "true",
    }


@app.get("/v1/profile")
def profile(
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.user_profile()}


@app.get("/v1/funds")
def funds(
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.fund_limits()}


@app.get("/v1/holdings")
def holdings(
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.holdings()}


@app.get("/v1/positions")
def positions(
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.positions()}


@app.get("/v1/orders")
def orders(
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.orders()}


@app.post("/v1/quotes/ohlc")
def quotes_ohlc(body: QuoteBody) -> dict[str, Any]:
    c = _client(body)
    return {"ok": True, "data": c.ohlc_data(body.securities)}


@app.post("/v1/option-chain")
def option_chain(body: OptionChainBody) -> dict[str, Any]:
    c = _client(body)
    return {
        "ok": True,
        "data": c.option_chain(
            body.under_security_id,
            body.under_exchange_segment,
            body.expiry,
        ),
    }


@app.get("/v1/expiry-list")
def expiry_list(
    under_security_id: int = Query(13),
    under_exchange_segment: str = Query("IDX_I"),
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.expiry_list(under_security_id, under_exchange_segment)}


@app.post("/v1/historical")
def historical(body: HistoricalBody) -> dict[str, Any]:
    c = _client(body)
    if body.interval == "minute":
        data = c.intraday_minute_data(
            body.security_id,
            body.exchange_segment,
            body.instrument_type,
            body.from_date,
            body.to_date,
        )
    else:
        data = c.historical_daily_data(
            body.security_id,
            body.exchange_segment,
            body.instrument_type,
            body.from_date,
            body.to_date,
        )
    return {"ok": True, "data": data}


@app.post("/v1/orders/place")
def place_order(body: PlaceOrderBody) -> dict[str, Any]:
    if os.getenv("DHANHQ_ALLOW_LIVE_ORDERS", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="Live orders disabled. Set DHANHQ_ALLOW_LIVE_ORDERS=true to enable.",
        )
    c = _client(body)
    return {
        "ok": True,
        "data": c.place_order(
            security_id=body.security_id,
            exchange_segment=body.exchange_segment,
            transaction_type=body.transaction_type,
            quantity=body.quantity,
            order_type=body.order_type,
            product_type=body.product_type,
            price=body.price,
            trigger_price=body.trigger_price,
            validity=body.validity,
        ),
    }


@app.get("/v1/instruments/compact")
def instruments_compact(
    client_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    c = _client(CredsBody(client_id=client_id, access_token=access_token))
    return {"ok": True, "data": c.security_list("compact")}


def create_app() -> FastAPI:
    return app
