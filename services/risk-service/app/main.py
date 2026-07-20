from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel, Field

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from schemas.paper import OrderSide, OrderType, PaperOrder
from schemas.risk import RiskRules
from schemas.strategy import StrategyConfig
from risk_rules import get_default_policies

app = build_app("RiskGuard360 Service")
rt = get_runtime()


class ValidateStrategyBody(BaseModel):
    strategy: StrategyConfig


class CheckOrderBody(BaseModel):
    account_id: str
    symbol: str
    side: OrderSide = OrderSide.BUY
    quantity: int = Field(gt=0)
    price: float = Field(gt=0)
    risk_rules: RiskRules | None = None


class KillSwitchBody(BaseModel):
    reason: str = "manual"
    account_id: str | None = None


@app.post("/risk/validate-strategy")
def validate_strategy(body: ValidateStrategyBody):
    result = rt.risk.validate_strategy(body.strategy)
    return {"success": True, "data": result.model_dump(mode="json")}


@app.post("/risk/check-paper-order")
def check_order(body: CheckOrderBody):
    acct = rt.broker.get_account(body.account_id)
    if not acct:
        raise HTTPException(404, "account_not_found")
    order = PaperOrder(
        account_id=body.account_id,
        symbol=body.symbol,
        side=body.side,
        quantity=body.quantity,
        order_type=OrderType.LIMIT,
        limit_price=body.price,
    )
    result = rt.risk.check_paper_order(order, acct, body.risk_rules, mark_price=body.price)
    return {"success": True, "data": result.model_dump(mode="json")}


@app.get("/risk/policies")
def policies():
    return {"success": True, "data": get_default_policies()}


@app.post("/risk/kill-switch/trigger")
def kill_switch(body: KillSwitchBody):
    data = rt.risk.trigger_kill_switch(body.reason)
    if body.account_id and body.account_id in rt.broker.accounts:
        rt.broker.accounts[body.account_id].kill_switch_active = True
    return {"success": True, "data": data}
