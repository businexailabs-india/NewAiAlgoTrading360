from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, Field

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from schemas.strategy import StrategyConfig

app = build_app("AlgoBuilder360 / Strategy Service")
rt = get_runtime()


class PaperTestBody(BaseModel):
    account_id: str | None = None
    regime: str = "trending"
    bars: int = 120


@app.post("/strategies")
def create_strategy(body: StrategyConfig):
    body.live_trading_enabled = False
    body.paper_trading_required = True
    saved = rt.engine.save_strategy(body)
    return {"success": True, "data": saved.model_dump(mode="json")}


@app.get("/strategies")
def list_strategies():
    return {"success": True, "data": [s.model_dump(mode="json") for s in rt.engine.list_strategies()]}


@app.get("/strategies/{strategy_id}")
def get_strategy(strategy_id: str):
    s = rt.engine.get_strategy(strategy_id)
    if not s:
        raise HTTPException(404, "strategy_not_found")
    return {"success": True, "data": s.model_dump(mode="json")}


@app.put("/strategies/{strategy_id}")
def update_strategy(strategy_id: str, body: dict[str, Any]):
    s = rt.engine.get_strategy(strategy_id)
    if not s:
        raise HTTPException(404, "strategy_not_found")
    data = s.model_dump(mode="json")
    data.update(body)
    data["strategy_id"] = strategy_id
    data["live_trading_enabled"] = False
    updated = StrategyConfig(**data)
    return {"success": True, "data": rt.engine.save_strategy(updated).model_dump(mode="json")}


@app.post("/strategies/{strategy_id}/validate")
def validate(strategy_id: str):
    if not rt.engine.get_strategy(strategy_id):
        raise HTTPException(404, "strategy_not_found")
    return {"success": True, "data": rt.engine.validate(strategy_id)}


@app.post("/strategies/{strategy_id}/paper-test")
def paper_test(strategy_id: str, body: PaperTestBody = PaperTestBody()):
    if not rt.engine.get_strategy(strategy_id):
        raise HTTPException(404, "strategy_not_found")
    try:
        report = rt.engine.paper_test(
            strategy_id, account_id=body.account_id, regime=body.regime, bars=body.bars
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"success": True, "data": report.model_dump(mode="json")}


@app.post("/strategies/{strategy_id}/save")
def save(strategy_id: str):
    s = rt.engine.get_strategy(strategy_id)
    if not s:
        raise HTTPException(404, "strategy_not_found")
    return {"success": True, "data": rt.engine.save_strategy(s).model_dump(mode="json")}


@app.post("/strategies/{strategy_id}/deploy-paper")
def deploy_paper(strategy_id: str):
    if not rt.engine.get_strategy(strategy_id):
        raise HTTPException(404, "strategy_not_found")
    try:
        s = rt.engine.deploy_paper(strategy_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"success": True, "data": s.model_dump(mode="json")}


@app.post("/strategies/{strategy_id}/pause")
def pause(strategy_id: str):
    if not rt.engine.get_strategy(strategy_id):
        raise HTTPException(404, "strategy_not_found")
    return {"success": True, "data": rt.engine.pause(strategy_id).model_dump(mode="json")}


@app.post("/strategies/{strategy_id}/stop")
def stop(strategy_id: str):
    if not rt.engine.get_strategy(strategy_id):
        raise HTTPException(404, "strategy_not_found")
    return {"success": True, "data": rt.engine.stop(strategy_id).model_dump(mode="json")}
