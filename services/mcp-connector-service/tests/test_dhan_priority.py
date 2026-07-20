"""Service-level Dhan priority tests — snapshot, DhanLaxmi status, live blocked."""

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
        kafka_bootstrap_servers="memory://",
        mcp_default_provider="dhan",
    )
    monkeypatch.setattr("app.main.svc", MCPConnectorService(settings))
    monkeypatch.setattr("app.main.settings", settings)
    return app


@pytest.mark.asyncio
async def test_dhan_connect_snapshot_books_and_preview(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        schema = await client.get("/mcp/providers/dhan/credential-schema", headers=headers)
        assert schema.status_code == 200
        assert "client_id" in schema.json()["data"]["required"]

        created = await client.post(
            "/mcp/connections",
            headers=headers,
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True, "demo": True}},
        )
        assert created.status_code == 200
        cid = created.json()["data"]["connection"]["id"]

        snap = await client.get(f"/mcp/connections/{cid}/snapshot", headers=headers)
        body = snap.json()["data"]
        assert body["holdings_json"][0]["symbol"] == "RELIANCE"
        assert len(body["orders_json"]) >= 2
        assert len(body["trades_json"]) >= 1
        assert body["live_order_execution"] is False

        orders = await client.get(f"/mcp/connections/{cid}/orders", headers=headers)
        assert orders.json()["data"][0]["status"] == "FILLED"

        quote = await client.get(f"/mcp/connections/{cid}/quote/RELIANCE", headers=headers)
        assert quote.json()["data"]["quotes"]["NSE:RELIANCE"]["ltp"] == 2550.0

        preview = await client.post(
            f"/mcp/connections/{cid}/orders/preview",
            headers=headers,
            json={
                "order": {
                    "symbol": "RELIANCE",
                    "exchange": "NSE",
                    "side": "BUY",
                    "quantity": 1,
                    "price": 2550,
                    "product_type": "CNC",
                }
            },
        )
        assert preview.json()["data"]["accepted"] is True
        assert preview.json()["data"]["live_execution"] is False

        blocked = await client.post(
            f"/mcp/connections/{cid}/orders/execute-disabled",
            headers=headers,
            json={"order": {"symbol": "RELIANCE", "side": "BUY", "quantity": 1, "exchange": "NSE"}},
        )
        assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_dhanlaxmi_dhan_status_masked(fresh_service):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/mcp/connections",
            headers=headers,
            json={
                "provider_id": "dhan",
                "credentials": {"client_id": "1112656215", "access_token": "super-secret-dhan-token"},
                "config": {"use_mock": True},
            },
        )
        status = await client.get("/mcp/dhanlaxmi/dhan-status", headers=headers)
        assert status.status_code == 200
        data = status.json()["data"]
        assert data["connected"] is True
        assert data["live_trading_enabled"] is False
        assert "super-secret-dhan-token" not in str(data)
        assert data["masked_client_id"].endswith("6215")

        ctx = await client.get("/mcp/dhanlaxmi/context", headers=headers)
        assert ctx.json()["data"]["preferred_broker"] == "dhan"
        assert ctx.json()["data"]["secrets_included"] is False

        adv = await client.get("/mcp/advisory/provider-context", headers=headers)
        assert adv.json()["data"]["dhan_connected"] is True
        assert adv.json()["data"]["live_trading_enabled"] is False


@pytest.mark.asyncio
async def test_dhan_audit_redacts_secrets(fresh_service):
    from app import main as main_mod

    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/mcp/connections",
            headers=headers,
            json={
                "provider_id": "dhan",
                "credentials": {"client_id": "1112656215", "access_token": "audit-secret-token"},
                "config": {"use_mock": True},
            },
        )
        await client.get("/mcp/dhanlaxmi/dhan-status", headers=headers)
    audits = [a for a in main_mod.svc.store.audit if a["tenant_id"] == tenant]
    blob = str(redact_secrets(audits))
    assert "audit-secret-token" not in blob
    assert any(a["action"] == "dhanlaxmi.provider_status" for a in audits)
