"""Integration-style tests for mcp-connector-service."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from advisory_core.security import ServiceAuth, redact_secrets
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.service import MCPConnectorService
from app.settings import MCPConnectorSettings


def _headers(tenant: str, user: str, role: str = "user") -> dict[str, str]:
    auth = ServiceAuth(os.environ["SERVICE_HMAC_SECRET"])
    return auth.sign(tenant, user, role, str(uuid4()))


@pytest.fixture
def fresh_service(monkeypatch):
    settings = MCPConnectorSettings(
        live_trading_enabled=False,
        paper_trading_enabled=True,
        mcp_enable_dhan=True,
        kill_switch=False,
        kafka_bootstrap_servers="memory://",
    )
    monkeypatch.setattr("app.main.svc", MCPConnectorService(settings))
    monkeypatch.setattr("app.main.settings", settings)
    return app


@pytest.mark.asyncio
async def test_list_indian_providers(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/mcp/providers", params={"country": "IN"}, headers=_headers(tenant, user))
    assert resp.status_code == 200
    data = resp.json()["data"]
    ids = {p["provider_id"] for p in data}
    assert "dhan" in ids
    assert "paper_trading" in ids
    assert "truedata" in ids


@pytest.mark.asyncio
async def test_connect_mock_dhan_and_snapshot(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        conn_resp = await client.post(
            "/mcp/connections",
            headers=headers,
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True, "demo": True}},
        )
        assert conn_resp.status_code == 200
        connection_id = conn_resp.json()["data"]["connection"]["id"]
        assert conn_resp.json()["data"]["connect_result"]["ok"] is True

        test_resp = await client.post(f"/mcp/connections/{connection_id}/test", headers=headers)
        assert test_resp.status_code == 200
        assert test_resp.json()["data"]["health"]["status"] in ("connected", "connected")

        snap = await client.get(f"/mcp/connections/{connection_id}/snapshot", headers=headers)
        assert snap.status_code == 200
        body = snap.json()["data"]
        assert "margins_json" in body
        assert body["holdings_json"][0]["symbol"] == "RELIANCE"

        caps = await client.get(f"/mcp/providers/dhan/capabilities", headers=headers)
        assert "ACCOUNT_PROFILE" in caps.json()["data"]["capabilities"]


@pytest.mark.asyncio
async def test_paper_order_and_live_blocked(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        paper = await client.post(
            "/mcp/connections",
            headers=headers,
            json={"provider_id": "paper_trading", "credentials": {}},
        )
        paper_id = paper.json()["data"]["connection"]["id"]

        preview = await client.post(
            f"/mcp/connections/{paper_id}/orders/preview",
            headers=headers,
            json={"order": {"symbol": "RELIANCE", "exchange": "NSE", "side": "BUY", "quantity": 1, "price": 100}},
        )
        assert preview.status_code == 200
        assert preview.json()["data"]["accepted"] is True

        exec_paper = await client.post(
            f"/mcp/connections/{paper_id}/orders/execute-disabled",
            headers=headers,
            json={"order": {"symbol": "RELIANCE", "exchange": "NSE", "side": "BUY", "quantity": 1, "price": 100}},
        )
        assert exec_paper.status_code == 200
        assert exec_paper.json()["data"]["status"] == "FILLED"

        dhan = await client.post(
            "/mcp/connections",
            headers=headers,
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True}},
        )
        dhan_id = dhan.json()["data"]["connection"]["id"]
        blocked = await client.post(
            f"/mcp/connections/{dhan_id}/orders/execute-disabled",
            headers=headers,
            json={
                "order": {
                    "symbol": "RELIANCE",
                    "exchange": "NSE",
                    "side": "BUY",
                    "quantity": 1,
                    "price": 100,
                }
            },
        )
        assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation(fresh_service):
    t1, u1 = str(uuid4()), str(uuid4())
    t2, u2 = str(uuid4()), str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post(
            "/mcp/connections",
            headers=_headers(t1, u1),
            json={"provider_id": "mock_trading", "credentials": {}},
        )
        cid = created.json()["data"]["connection"]["id"]
        forbidden = await client.get(f"/mcp/connections/{cid}", headers=_headers(t2, u2))
        assert forbidden.status_code == 404


@pytest.mark.asyncio
async def test_secrets_not_in_llm_context(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/mcp/connections",
            headers=headers,
            json={
                "provider_id": "dhan",
                "credentials": {"client_id": "1112656215", "access_token": "super-secret-token-xyz"},
                "config": {"use_mock": True},
            },
        )
        ctx = await client.get("/mcp/dhanlaxmi/context", headers=headers)
        payload = ctx.json()["data"]
        blob = str(payload)
        assert "super-secret-token-xyz" not in blob
        assert payload["secrets_included"] is False
        redacted = redact_secrets({"access_token": "super-secret-token-xyz", "ok": True})
        assert redacted["access_token"] == "[REDACTED]"


@pytest.mark.asyncio
async def test_advisory_context_and_oms_gate(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/mcp/connections",
            headers=_headers(tenant, user),
            json={"provider_id": "paper_trading", "credentials": {}},
        )
        adv = await client.get("/mcp/advisory/provider-context", headers=_headers(tenant, user))
        assert adv.status_code == 200
        assert adv.json()["data"]["live_trading_enabled"] is False
        assert adv.json()["data"]["paper_trading_provider"] == "paper_trading"

        # OMS without approvals still blocked for live dhan
        dhan = await client.post(
            "/mcp/connections",
            headers=_headers(tenant, user),
            json={"provider_id": "dhan", "config": {"use_mock": True}, "credentials": {}},
        )
        dhan_id = dhan.json()["data"]["connection"]["id"]
        oms = await client.post(
            f"/mcp/connections/{dhan_id}/orders/execute-disabled",
            headers=_headers(tenant, user, role="oms_service"),
            json={"order": {"symbol": "RELIANCE", "side": "BUY", "quantity": 1, "exchange": "NSE"}},
        )
        assert oms.status_code == 403


@pytest.mark.asyncio
async def test_health_monitor_publishes(fresh_service):
    from app import main as main_mod

    tenant, user = str(uuid4()), str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/mcp/connections",
            headers=_headers(tenant, user),
            json={"provider_id": "mock_trading", "credentials": {}},
        )
    results = await main_mod.svc.run_health_monitor_once()
    assert isinstance(results, list)
