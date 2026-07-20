from __future__ import annotations

from fastapi import HTTPException

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from performance_metrics import compute_performance
from schemas.strategy import RISK_WARNING

app = build_app("Strategy Performance Report Service")
rt = get_runtime()


@app.get("/reports/strategy/{strategy_id}")
def strategy_report(strategy_id: str):
    s = rt.engine.get_strategy(strategy_id)
    if not s:
        raise HTTPException(404, "strategy_not_found")
    # Aggregate paper trades for strategy
    pnls = [
        t.pnl
        for t in rt.broker.list_trades()
        if any(o.strategy_id == strategy_id and o.order_id == t.order_id for o in rt.broker.list_orders())
    ]
    # Fallback: latest paper test
    tests = [t for t in rt.engine.paper_tests.values() if t.strategy_id == strategy_id]
    if tests:
        return {"success": True, "data": tests[-1].performance.model_dump(mode="json")}
    report = compute_performance(strategy_id, pnls)
    return {"success": True, "data": report.model_dump(mode="json")}


@app.get("/reports/paper-test/{test_id}")
def paper_test_report(test_id: str):
    report = rt.engine.paper_tests.get(test_id)
    if not report:
        raise HTTPException(404, "test_not_found")
    data = report.model_dump(mode="json")
    data["risk_warning"] = RISK_WARNING
    data["live_trading_enabled"] = False
    return {"success": True, "data": data}
