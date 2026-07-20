"""AI Advisory uses Dhan account context when broker=dhan."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.service import AIAdvisoryService
from app.store import reset_store


@pytest.fixture(autouse=True)
def _clean_store():
    reset_store()
    yield
    reset_store()


@pytest.mark.asyncio
async def test_advisory_uses_dhan_account_context():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    tenant, user = str(uuid4()), str(uuid4())
    data = await svc.generate_login_advisory(
        tenant,
        user,
        {
            "broker_status": "connected",
            "broker": "dhan",
            "risk_profile_completed": True,
            "available_margin": 125000,
            "market_status": "open",
            "data_stale": False,
        },
    )
    assert data["status"] == "ready"
    # Broker context should reflect Dhan margins/holdings (redacted)
    # summary/warnings must not contain secrets
    blob = str(data)
    assert "access_token" not in blob.lower()
    assert data.get("broker_status") == "connected"


@pytest.mark.asyncio
async def test_collect_broker_context_dhan_snapshot():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    ctx = await svc.collect_broker_context(
        {"broker_status": "connected", "broker": "dhan", "prefer_dhan": True}
    )
    assert ctx["broker"] == "dhan"
    assert ctx["status"] == "connected"
    assert ctx["live_order_execution"] is False
    assert ctx["margins"]["available"] == 125000.0
    assert len(ctx["holdings"]) == 2
    assert ctx["account_snapshot"] is not None
    assert ctx["account_snapshot"]["secrets_included"] is False
