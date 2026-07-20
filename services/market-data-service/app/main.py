from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel, Field

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from market_simulator import SAMPLE_SYMBOLS

app = build_app("Mock Market Data Service")
rt = get_runtime()


class ReplayBody(BaseModel):
    symbols: list[str] = Field(default_factory=lambda: list(SAMPLE_SYMBOLS))
    timeframe: str = "5m"
    regime: str = "trending"
    n: int = 100


@app.get("/market-data/mock/candles")
def candles(symbol: str = "RELIANCE", timeframe: str = "5m", n: int = 200, regime: str = "trending"):
    try:
        data = rt.market.generate_candles(symbol, timeframe, n=n, regime=regime)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"success": True, "data": [c.model_dump(mode="json") for c in data]}


@app.get("/market-data/mock/quote/{symbol}")
def quote(symbol: str, stale: bool = False):
    try:
        q = rt.market.get_quote(symbol, stale=stale)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"success": True, "data": q.model_dump(mode="json")}


@app.post("/market-data/mock/replay")
def replay(body: ReplayBody):
    data = rt.market.replay(body.symbols, body.timeframe, body.regime, body.n)
    return {
        "success": True,
        "data": {k: [c.model_dump(mode="json") for c in v] for k, v in data.items()},
    }
