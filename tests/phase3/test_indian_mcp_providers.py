"""Phase 3 — Indian MCP Provider Integration tests."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from advisory_core.security import ServiceAuth
from httpx import ASGITransport, AsyncClient

from mcp_connectors import (
    fetch_provider_account_context,
    get_registry,
    phase3_provider_ids,
    resolve_preferred_provider,
)
from mcp_connectors.base.models import LiveOrderGateContext, NormalizedOrderRequest
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.base.secrets import LocalEncryptedSecretManager, mask_credential
from mcp_connectors.india.dhan import DhanMCPProvider
from mcp_connectors.india.paper_trading import PaperTradingProvider
from mcp_connectors.registry import MCPProviderRegistry

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / "config" / "mcp-providers"

PHASE3_IDS = [
    "dhan",
    "zerodha",
    "angelone",
    "upstox",
    "fyers",
    "icici_breeze",
    "kotak_neo",
    "alice_blue",
    "finvasia_shoonya",
    "paper_trading",
    "mock_trading",
]


@pytest.fixture
def registry():
    os.environ["MCP_PROVIDERS_CONFIG_DIR"] = str(CONFIG)
    os.environ["LIVE_TRADING_ENABLED"] = "false"
    reg = MCPProviderRegistry(config_dir=CONFIG)
    reg.load_providers_from_yaml()
    return reg


def test_load_providers_from_yaml(registry: MCPProviderRegistry):
    ids = {p.provider_id for p in registry.list_providers()}
    for pid in PHASE3_IDS:
        assert pid in ids, f"missing provider {pid} in YAML registry"
    phase3 = phase3_provider_ids(registry)
    assert phase3 == PHASE3_IDS
    assert all(p.live_trading_default is False for p in registry.list_providers())


def test_show_provider_capabilities(registry: MCPProviderRegistry):
    caps = registry.get_provider_capabilities("dhan")
    assert "ACCOUNT_PROFILE" in caps["capabilities"] or "account_profile" in [
        c.lower() for c in caps.get("raw_capabilities") or []
    ]
    assert caps["live_trading_default"] is False
    matrix = {pid: registry.get_provider_capabilities(pid) for pid in PHASE3_IDS}
    assert len(matrix) == 11
    assert matrix["paper_trading"]["paper_trading_default"] is True


@pytest.mark.asyncio
async def test_connect_mock_dhan():
    provider = DhanMCPProvider()
    result = await provider.connect({}, {"use_mock": True, "demo": True})
    assert result["ok"] is True
    assert result["status"] == "connected"
    health = await provider.health_check()
    assert health.get("ok") is True or health.get("status") == "connected"


@pytest.mark.asyncio
async def test_fetch_account_snapshot():
    ctx = await fetch_provider_account_context("dhan", config={"use_mock": True, "demo": True})
    assert ctx["provider_id"] == "dhan"
    assert ctx["status"] == "connected"
    assert ctx["live_trading_enabled"] is False
    assert ctx["secrets_included"] is False
    assert ctx["account_snapshot"] is not None
    assert ctx["margins"]["available"] > 0


@pytest.mark.asyncio
async def test_live_order_blocked():
    provider = DhanMCPProvider()
    await provider.connect({}, {"use_mock": True})
    with pytest.raises(LiveTradingBlockedError):
        await provider.place_order_disabled_by_default(
            {"symbol": "RELIANCE", "quantity": 1, "side": "BUY"},
            gate=LiveOrderGateContext(),
        )


@pytest.mark.asyncio
async def test_paper_order_allowed():
    paper = PaperTradingProvider(initial_cash=100000)
    await paper.connect({}, {})
    resp = await paper.place_paper_order(
        NormalizedOrderRequest(
            tenant_id="t1",
            user_id="u1",
            provider_id="paper_trading",
            exchange="NSE",
            symbol="RELIANCE",
            side="BUY",
            quantity=1,
            price=100.0,
        )
    )
    assert resp.status == "FILLED"


def test_secrets_masked():
    secret = "super-secret-token-xyz"
    masked = mask_credential(secret)
    assert secret not in masked
    assert masked.endswith("xyz") or "*" in masked
    mgr = LocalEncryptedSecretManager(key="phase3-test-key")
    ref = mgr.store("tenant:user:dhan:access_token", secret)
    retrieved = mgr.retrieve(ref)
    assert retrieved == secret
    # Store blob must not contain plaintext
    sealed = mgr._store[ref]
    assert secret not in sealed


def test_resolve_preferred_provider_from_yaml(registry: MCPProviderRegistry):
    assert resolve_preferred_provider({"broker": "kite"}, registry=registry) == "zerodha"
    assert (
        resolve_preferred_provider({}, registry=registry, connected_provider_ids=["upstox", "dhan"])
        == "dhan"
    )


# ---------------------------------------------------------------------------
# MCP connector service integration
# ---------------------------------------------------------------------------


def _headers(tenant: str, user: str, role: str = "user") -> dict[str, str]:
    auth = ServiceAuth(os.environ["SERVICE_HMAC_SECRET"])
    return auth.sign(tenant, user, role, str(uuid4()))


@pytest.fixture
def mcp_app(monkeypatch):
    os.environ.setdefault("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me")
    os.environ["MCP_PROVIDERS_CONFIG_DIR"] = str(CONFIG)
    os.environ["LIVE_TRADING_ENABLED"] = "false"
    os.environ["PAPER_TRADING_ENABLED"] = "true"
    import sys

    svc_path = str(REPO / "services" / "mcp-connector-service")
    if svc_path not in sys.path:
        sys.path.insert(0, svc_path)
    # Prefer existing app import from mcp-connector-service; only clear if wrong package
    mod = sys.modules.get("app.main")
    loaded = (getattr(mod, "__file__", "") or "").replace("\\", "/")
    if mod is None or "mcp-connector-service" not in loaded:
        for key in list(sys.modules):
            if key == "app" or key.startswith("app."):
                del sys.modules[key]
    from app.main import app
    from app.service import MCPConnectorService
    from app.settings import MCPConnectorSettings

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
async def test_service_connect_mock_dhan_snapshot_and_caps(mcp_app):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=mcp_app), base_url="http://test") as client:
        conn_resp = await client.post(
            "/mcp/connections",
            headers=headers,
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True, "demo": True}},
        )
        assert conn_resp.status_code == 200
        connection_id = conn_resp.json()["data"]["connection"]["id"]

        snap = await client.get(f"/mcp/connections/{connection_id}/snapshot", headers=headers)
        assert snap.status_code == 200
        body = snap.json()["data"]
        assert "margins_json" in body or "margins" in str(body)

        caps = await client.get("/mcp/providers/dhan/capabilities", headers=headers)
        assert caps.status_code == 200
        assert caps.json()["data"]["live_trading_default"] is False

        status = await client.get("/mcp/dhanlaxmi/provider-status", headers=headers)
        assert status.status_code == 200
        assert status.json()["data"]["live_trading_enabled"] is False
        assert "access_token" not in str(status.json()).lower()

        adv = await client.get("/mcp/advisory/provider-context", headers=headers)
        assert adv.status_code == 200
        assert adv.json()["data"]["live_trading_enabled"] is False
        assert "dhan" in adv.json()["data"]["phase3_providers"]


@pytest.mark.asyncio
async def test_service_live_blocked_paper_allowed_tenant_isolation(mcp_app):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=mcp_app), base_url="http://test") as client:
        paper = await client.post(
            "/mcp/connections",
            headers=headers,
            json={"provider_id": "paper_trading", "credentials": {}},
        )
        paper_id = paper.json()["data"]["connection"]["id"]
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
            json={"order": {"symbol": "RELIANCE", "exchange": "NSE", "side": "BUY", "quantity": 1, "price": 100}},
        )
        assert blocked.status_code == 403

        # Cross-tenant access blocked
        other = await client.get(
            f"/mcp/connections/{dhan_id}",
            headers=_headers(str(uuid4()), str(uuid4())),
        )
        assert other.status_code == 404


@pytest.mark.asyncio
async def test_service_secrets_masked_in_context(mcp_app):
    tenant, user = str(uuid4()), str(uuid4())
    headers = _headers(tenant, user)
    async with AsyncClient(transport=ASGITransport(app=mcp_app), base_url="http://test") as client:
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
        blob = str(ctx.json())
        assert "super-secret-token-xyz" not in blob
        assert ctx.json()["data"]["secrets_included"] is False


@pytest.mark.asyncio
async def test_admin_providers_list(mcp_app):
    tenant, user = str(uuid4()), str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=mcp_app), base_url="http://test") as client:
        resp = await client.get("/admin/mcp/providers", headers=_headers(tenant, user, role="admin"))
        assert resp.status_code == 200
        ids = {p["provider_id"] for p in resp.json()["data"]}
        for pid in PHASE3_IDS:
            assert pid in ids
