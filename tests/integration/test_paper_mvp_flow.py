"""Integration flow for Algo Library + Paper Trading MVP (shared runtime)."""

from __future__ import annotations

import pytest

from algo_platform_store.runtime import get_runtime
from algo_templates import create_strategy_from_template, list_templates
from schemas.paper import OrderSide, OrderType, PaperOrder
from schemas.risk import RiskRules


@pytest.fixture()
def rt():
    get_runtime.cache_clear()
    return get_runtime()


def test_end_to_end_paper_mvp(rt):
    # 1. Create paper account
    acct = rt.broker.create_account("qa-user", 1_000_000)
    assert acct.cash_balance == 1_000_000

    # 2. Load algo templates
    templates = list_templates()
    assert len(templates) >= 11

    # 3. Create Moving Average strategy
    strategy = create_strategy_from_template(
        "ma_crossover", symbols=["RELIANCE"], created_by="qa-user"
    )
    assert strategy.live_trading_enabled is False
    assert strategy.paper_trading_required is True
    rt.engine.save_strategy(strategy)

    # 4. Validate strategy
    validation = rt.engine.validate(strategy.strategy_id)
    assert validation["ok"] is True
    assert validation["live_trading_enabled"] is False

    # 5-8. Run paper test, update portfolio, generate report
    report = rt.engine.paper_test(
        strategy.strategy_id, account_id=acct.account_id, regime="trending", bars=100
    )
    assert report.live_trading_enabled is False
    assert report.performance.risk_warning
    assert report.orders_placed >= 0
    positions_or_cash = rt.broker.get_account(acct.account_id)
    assert positions_or_cash is not None

    # 9. Save strategy
    saved = rt.engine.save_strategy(strategy)
    assert saved.strategy_id == strategy.strategy_id

    # 10. Deploy to paper
    deployed = rt.engine.deploy_paper(strategy.strategy_id)
    assert deployed.status.value == "paper_deployed"
    assert deployed.live_trading_enabled is False

    # Report lookup
    assert report.test_id in rt.engine.paper_tests

    # 11-12. Kill switch blocks future paper orders
    rt.risk.trigger_kill_switch("qa")
    acct.kill_switch_active = True
    rt.broker.accounts[acct.account_id] = acct
    blocked = rt.broker.place_order(
        PaperOrder(
            account_id=acct.account_id,
            symbol="TCS",
            side=OrderSide.BUY,
            quantity=1,
            order_type=OrderType.MARKET,
        ),
        RiskRules(),
    )
    assert blocked.status.value == "REJECTED"
    assert "kill_switch" in (blocked.reject_reason or "")


def test_http_strategy_and_library_docs_mount():
    """Smoke: FastAPI apps expose health + OpenAPI."""
    import sys
    from pathlib import Path

    from fastapi.testclient import TestClient

    root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(root / "services" / "strategy-service"))
    # Import after path set — use unique process via already-installed package if available
    get_runtime.cache_clear()
    from app.main import app as strategy_app

    client = TestClient(strategy_app)
    assert client.get("/health").json()["live_trading_enabled"] is False
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/strategies").status_code == 200
