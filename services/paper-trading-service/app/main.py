from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel, Field

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from performance_metrics import compute_performance
from schemas.paper import OrderSide, OrderType, PaperOrder
from schemas.risk import RiskRules

app = build_app("PaperTrade Lab Service")
rt = get_runtime()


class CreateAccountBody(BaseModel):
    user_id: str = "demo-user"
    starting_balance: float = 1_000_000.0


class PlaceOrderBody(BaseModel):
    account_id: str
    symbol: str
    side: OrderSide
    quantity: int = Field(gt=0)
    order_type: OrderType = OrderType.MARKET
    limit_price: float | None = None
    strategy_id: str | None = None


@app.post("/paper/accounts")
def create_account(body: CreateAccountBody):
    acct = rt.broker.create_account(body.user_id, body.starting_balance)
    return {"success": True, "data": acct.model_dump(mode="json")}


@app.get("/paper/accounts/{account_id}")
def get_account(account_id: str):
    acct = rt.broker.get_account(account_id)
    if not acct:
        raise HTTPException(404, "account_not_found")
    return {"success": True, "data": acct.model_dump(mode="json")}


@app.post("/paper/orders")
def place_order(body: PlaceOrderBody):
    order = PaperOrder(
        account_id=body.account_id,
        symbol=body.symbol.upper(),
        side=body.side,
        quantity=body.quantity,
        order_type=body.order_type,
        limit_price=body.limit_price,
        strategy_id=body.strategy_id,
    )
    filled = rt.broker.place_order(order, RiskRules())
    return {"success": True, "data": filled.model_dump(mode="json")}


@app.get("/paper/orders")
def list_orders(account_id: str | None = None):
    return {"success": True, "data": [o.model_dump(mode="json") for o in rt.broker.list_orders(account_id)]}


@app.get("/paper/trades")
def list_trades(account_id: str | None = None):
    return {"success": True, "data": [t.model_dump(mode="json") for t in rt.broker.list_trades(account_id)]}


@app.get("/paper/positions")
def list_positions(account_id: str):
    return {"success": True, "data": rt.broker.list_positions(account_id)}


@app.get("/paper/performance")
def performance(account_id: str, strategy_id: str = "account"):
    trades = rt.broker.list_trades(account_id)
    pnls = [t.pnl for t in trades]
    acct = rt.broker.get_account(account_id)
    starting = acct.starting_balance if acct else 1_000_000.0
    report = compute_performance(strategy_id, pnls, starting)
    return {"success": True, "data": report.model_dump(mode="json")}
