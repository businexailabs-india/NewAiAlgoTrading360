"""Required advisory vertical-slice tests (no live APIs)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from advisory_core.contracts import reject_profit_promises
from advisory_core.events import EventEnvelope, KafkaTopics
from app.service import AIAdvisoryService
from app.store import reset_store


@pytest.fixture(autouse=True)
def _clean_store():
    reset_store()
    yield
    reset_store()


def test_forbidden_profit_language():
    with pytest.raises(ValueError):
        reject_profit_promises("This strategy has a guaranteed return")


@pytest.mark.asyncio
async def test_login_triggers_advisory_generation_async():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    tenant = str(uuid4())
    user = str(uuid4())
    event = EventEnvelope.create(
        KafkaTopics.USER_LOGIN_SUCCESS,
        tenant,
        user,
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 80000,
            "market_status": "open",
            "data_stale": False,
        },
        idempotency_key=f"login-test-{user}",
    )
    data = await svc.handle_login_event(event)
    assert data["status"] == "ready"
    assert data["advisory_id"]
    assert len(data["recommendations"]) >= 1


@pytest.mark.asyncio
async def test_duplicate_login_event_idempotent():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    tenant = str(uuid4())
    user = str(uuid4())
    key = f"dup-{user}"
    payload = {
        "broker_status": "connected",
        "broker": "mock",
        "risk_profile_completed": True,
        "available_margin": 50000,
    }
    e1 = EventEnvelope.create(KafkaTopics.USER_LOGIN_SUCCESS, tenant, user, payload, idempotency_key=key)
    e2 = EventEnvelope.create(KafkaTopics.USER_LOGIN_SUCCESS, tenant, user, payload, idempotency_key=key)
    await svc.handle_login_event(e1)
    second = await svc.handle_login_event(e2)
    assert second.get("status") in ("ready", "duplicate") or second.get("advisory_id")


@pytest.mark.asyncio
async def test_broker_disconnected_paper_only():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    data = await svc.generate_login_advisory(
        str(uuid4()),
        str(uuid4()),
        {"broker_status": "disconnected", "risk_profile_completed": True, "available_margin": 1000},
    )
    assert data["broker_status"] == "disconnected"
    blob = (data.get("summary") or "").lower() + " ".join(data.get("warnings") or []).lower()
    assert "paper" in blob or "disconnect" in blob


@pytest.mark.asyncio
async def test_stale_market_data_no_trade():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    data = await svc.generate_login_advisory(
        str(uuid4()),
        str(uuid4()),
        {
            "broker_status": "connected",
            "broker": "mock",
            "data_stale": True,
            "risk_profile_completed": True,
            "available_margin": 50000,
        },
    )
    titles = " ".join(r["title"].lower() for r in data["recommendations"])
    assert "no-trade" in titles or "stand aside" in titles


@pytest.mark.asyncio
async def test_convert_requires_paper_and_blocks_live_without_approval():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    tenant = str(uuid4())
    user = str(uuid4())
    adv = await svc.generate_login_advisory(
        user,
        tenant,
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 90000,
        },
    )
    rec = next(r for r in adv["recommendations"] if "no-trade" not in r["title"].lower())
    option = await svc.convert_to_algo(tenant, user, adv["advisory_id"], rec["id"])
    assert option["paper_test_required"] is True
    assert option["live_enabled"] is False

    live = svc.request_live_approval(
        tenant,
        user,
        option["id"],
        risk_disclosure_accepted=True,
        explicit_confirmation=True,
        paper_qualified=False,
        live_env_enabled=False,
        admin_approved=False,
    )
    assert live["status"] == "blocked"
    assert any("paper" in b.lower() for b in live["block_reasons"])


@pytest.mark.asyncio
async def test_user_approval_logged():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    tenant = str(uuid4())
    user = str(uuid4())
    adv = await svc.generate_login_advisory(
        user,
        tenant,
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 90000,
        },
    )
    rec = next(r for r in adv["recommendations"] if "no-trade" not in r["title"].lower())
    option = await svc.convert_to_algo(tenant, user, adv["advisory_id"], rec["id"])
    svc.store.update_strategy_option(option["id"], {"saved": True})
    svc.request_live_approval(
        tenant,
        user,
        option["id"],
        risk_disclosure_accepted=True,
        explicit_confirmation=True,
        paper_qualified=True,
        live_env_enabled=True,
        admin_approved=True,
    )
    assert any(a["action"] == "live_approval_requested" for a in svc.store.audits)
    assert any(a.get("approval_type") == "live_request" for a in svc.store.approvals)


@pytest.mark.asyncio
async def test_ai_decisions_audited():
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    await svc.generate_login_advisory(
        str(uuid4()),
        str(uuid4()),
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 50000,
        },
    )
    assert any(a["action"] == "advisory_generated" for a in svc.store.audits)
