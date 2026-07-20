from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, Field

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from algo_templates import create_strategy_from_template

app = build_app("AlgoLibrary360 Service")
rt = get_runtime()


class CreateStrategyBody(BaseModel):
    symbols: list[str] = Field(default_factory=lambda: ["RELIANCE"])
    parameters: dict[str, Any] = Field(default_factory=dict)
    strategy_name: str | None = None
    created_by: str = "demo-user"


@app.get("/algos/templates")
def list_templates():
    return {"success": True, "data": rt.library.list_templates()}


@app.get("/algos/templates/{template_id}")
def get_template(template_id: str):
    try:
        return {"success": True, "data": rt.library.get_template(template_id)}
    except KeyError as exc:
        raise HTTPException(404, f"template_not_found: {template_id}") from exc


@app.post("/algos/templates/{template_id}/create-strategy")
def create_strategy(template_id: str, body: CreateStrategyBody):
    try:
        strategy = create_strategy_from_template(
            template_id,
            symbols=body.symbols,
            parameters=body.parameters,
            created_by=body.created_by,
            strategy_name=body.strategy_name,
        )
    except KeyError as exc:
        raise HTTPException(404, f"template_not_found: {template_id}") from exc
    saved = rt.engine.save_strategy(strategy)
    return {"success": True, "data": saved.model_dump(mode="json")}
