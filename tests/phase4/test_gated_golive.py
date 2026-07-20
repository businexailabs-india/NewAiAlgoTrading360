"""Phase 4 — gated go-live tests (live OFF by default)."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest

from live_risk_gate import LiveRiskControls, evaluate_live_order
from mcp_connectors.base.http_client import ProviderHTTPClient
from mcp_connectors.base.models import LiveOrderGateContext, NormalizedOrderRequest
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.india.dhan.connector import DhanHQConnector
from mcp_connectors.india.dhan.fixtures import MOCK_FIXTURES
from mcp_connectors.india.dhan.provider import DhanMCPProvider
from schemas.strategy import StrategyConfig

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / "config" / "mcp-providers"


@pytest.fixture(autouse=True)
def _safe_env(monkeypatch):
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "false")
    monkeypatch.setenv("ALLOW_STRATEGY_LIVE", "false")
    monkeypatch.setenv("DHAN_USE_MOCK", "true")
    monkeypatch.setenv("DHAN_ALLOW_LIVE_HTTP", "false")
    monkeypatch.setenv("MCP_PROVIDERS_CONFIG_DIR", str(CONFIG))


@pytest.mark.asyncio
async def test_live_order_blocked_by_default():
    provider = DhanMCPProvider()
    await provider.connect({}, {"use_mock": True})
    with pytest.raises(LiveTradingBlockedError):
        await provider.place_order_disabled_by_default(
            {
                "symbol": "RELIANCE",
                "quantity": 1,
                "side": "BUY",
                "exchange": "NSE",
                "tenant_id": "t",
                "user_id": "u",
                "provider_id": "dhan",
            },
            gate=LiveOrderGateContext(),
        )


@pytest.mark.asyncio
async def test_gates_incomplete_blocked():
    provider = DhanMCPProvider()
    await provider.connect({}, {"use_mock": True})
    with pytest.raises(LiveTradingBlockedError) as exc:
        await provider.place_order_disabled_by_default(
            NormalizedOrderRequest(
                tenant_id="t1",
                user_id="u1",
                provider_id="dhan",
                exchange="NSE",
                symbol="RELIANCE",
                side="BUY",
                quantity=1,
            ),
            gate=LiveOrderGateContext(
                live_trading_enabled=True,
                caller_role="oms_service",
                # missing approvals
            ),
        )
    assert "approval" in str(exc.value).lower() or "LIVE" in str(exc.value)


@pytest.mark.asyncio
async def test_all_gates_and_live_sim_place_succeeds(monkeypatch):
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "true")
    http = ProviderHTTPClient(use_mock=True, fixtures=MOCK_FIXTURES)
    connector = DhanHQConnector(use_mock=False, http=http)
    # Force non-mock mode for provider refuse check, but HTTP stays fixture-backed
    connector.use_mock = False
    await connector.connect({"client_id": "1112656215", "access_token": "test-token"})
    provider = DhanMCPProvider(connector=connector)
    provider._connected = True
    gate = LiveOrderGateContext(
        live_trading_enabled=True,
        caller_role="oms_service",
        rms_approval_id="rms-1",
        user_approval_id="user-1",
        provider_live_trading_enabled=True,
        kill_switch_off=True,
    )
    resp = await provider.place_order_disabled_by_default(
        NormalizedOrderRequest(
            tenant_id="t1",
            user_id="u1",
            provider_id="dhan",
            exchange="NSE",
            symbol="RELIANCE",
            side="BUY",
            quantity=1,
        ),
        gate=gate,
    )
    assert resp.provider_order_id
    assert resp.provider_id == "dhan"


@pytest.mark.asyncio
async def test_use_mock_refuses_live_place_even_if_gates_pass(monkeypatch):
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "true")
    provider = DhanMCPProvider()
    await provider.connect({}, {"use_mock": True})
    gate = LiveOrderGateContext(
        live_trading_enabled=True,
        caller_role="oms_service",
        rms_approval_id="rms-1",
        user_approval_id="user-1",
        provider_live_trading_enabled=True,
        kill_switch_off=True,
    )
    with pytest.raises(LiveTradingBlockedError) as exc:
        await provider.place_order_disabled_by_default(
            NormalizedOrderRequest(
                tenant_id="t1",
                user_id="u1",
                provider_id="dhan",
                exchange="NSE",
                symbol="RELIANCE",
                side="BUY",
                quantity=1,
            ),
            gate=gate,
        )
    assert "use_mock" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_kill_switch_blocks(monkeypatch):
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "true")
    provider = DhanMCPProvider()
    await provider.connect({}, {"use_mock": True})
    with pytest.raises(LiveTradingBlockedError):
        await provider.place_order_disabled_by_default(
            NormalizedOrderRequest(
                tenant_id="t1",
                user_id="u1",
                provider_id="dhan",
                exchange="NSE",
                symbol="RELIANCE",
                side="BUY",
                quantity=1,
            ),
            gate=LiveOrderGateContext(
                live_trading_enabled=True,
                caller_role="oms_service",
                rms_approval_id="r",
                user_approval_id="u",
                provider_live_trading_enabled=True,
                kill_switch_off=False,
            ),
        )


def test_rms_gate_evaluates():
    bad = evaluate_live_order({"quantity": 0, "side": "BUY"}, controls=LiveRiskControls())
    assert bad.allowed is False
    ok = evaluate_live_order(
        {"quantity": 1, "side": "BUY", "price": 100, "product_type": "CNC"},
        account={"available": 10000},
        controls=LiveRiskControls(),
    )
    assert ok.allowed is True
    assert ok.rms_approval_id


def test_strategy_unlock_requires_flags(monkeypatch):
    s = StrategyConfig(strategy_name="t", strategy_type="vwap_breakout", symbols=["RELIANCE"])
    assert s.live_trading_enabled is False
    with pytest.raises(PermissionError):
        s.unlock_live(paper_qualified=True, admin_approved=True)
    monkeypatch.setenv("ALLOW_STRATEGY_LIVE", "true")
    s2 = StrategyConfig(strategy_name="t2", strategy_type="vwap_breakout", symbols=["RELIANCE"])
    s2.unlock_live(paper_qualified=True, admin_approved=True)
    assert s2.live_trading_enabled is True


@pytest.fixture
def mcp_live_app(monkeypatch):
    os.environ.setdefault("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me")
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "true")
    monkeypatch.setenv("MCP_PROVIDERS_CONFIG_DIR", str(CONFIG))
    import sys

    svc_path = str(REPO / "services" / "mcp-connector-service")
    while svc_path in sys.path:
        sys.path.remove(svc_path)
    sys.path.insert(0, svc_path)
    for key in list(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]
    from app.main import app
    from app.service import MCPConnectorService
    from app.settings import MCPConnectorSettings

    settings = MCPConnectorSettings(
        live_trading_enabled=True,
        paper_trading_enabled=True,
        mcp_enable_dhan=True,
        kill_switch=False,
        kafka_bootstrap_servers="memory://",
    )
    monkeypatch.setattr("app.main.svc", MCPConnectorService(settings))
    monkeypatch.setattr("app.main.settings", settings)
    return app


@pytest.mark.asyncio
async def test_oms_role_required_on_mcp(mcp_live_app):
    from advisory_core.security import ServiceAuth
    from httpx import ASGITransport, AsyncClient

    auth = ServiceAuth(os.environ["SERVICE_HMAC_SECRET"])
    tenant, user = str(uuid4()), str(uuid4())
    user_headers = auth.sign(tenant, user, "user", str(uuid4()))
    async with AsyncClient(transport=ASGITransport(app=mcp_live_app), base_url="http://test") as client:
        conn = await client.post(
            "/mcp/connections",
            headers=user_headers,
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True}},
        )
        cid = conn.json()["data"]["connection"]["id"]
        blocked = await client.post(
            f"/mcp/connections/{cid}/orders/execute-disabled",
            headers=user_headers,
            json={"order": {"symbol": "RELIANCE", "side": "BUY", "quantity": 1, "exchange": "NSE"}},
        )
        assert blocked.status_code in (403, 400, 422) or (
            blocked.status_code == 200 and blocked.json().get("data", {}).get("status") != "FILLED"
        )


@pytest.mark.asyncio
async def test_admin_connection_live_toggle(mcp_live_app):
    from advisory_core.security import ServiceAuth
    from httpx import ASGITransport, AsyncClient

    auth = ServiceAuth(os.environ["SERVICE_HMAC_SECRET"])
    tenant, user = str(uuid4()), str(uuid4())
    headers = auth.sign(tenant, user, "admin", str(uuid4()))
    async with AsyncClient(transport=ASGITransport(app=mcp_live_app), base_url="http://test") as client:
        conn = await client.post(
            "/mcp/connections",
            headers=auth.sign(tenant, user, "user", str(uuid4())),
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True}},
        )
        cid = conn.json()["data"]["connection"]["id"]
        toggle = await client.put(
            f"/admin/mcp/connections/{cid}/live-trading",
            headers=headers,
            json={"enabled": True},
        )
        assert toggle.status_code == 200
        assert toggle.json()["data"]["live_trading_enabled"] is True


@pytest.mark.asyncio
async def test_cross_tenant_connection_blocked(mcp_live_app):
    from advisory_core.security import ServiceAuth
    from httpx import ASGITransport, AsyncClient

    auth = ServiceAuth(os.environ["SERVICE_HMAC_SECRET"])
    tenant_a, user_a = str(uuid4()), str(uuid4())
    tenant_b, user_b = str(uuid4()), str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=mcp_live_app), base_url="http://test") as client:
        conn = await client.post(
            "/mcp/connections",
            headers=auth.sign(tenant_a, user_a, "user", str(uuid4())),
            json={"provider_id": "dhan", "credentials": {}, "config": {"use_mock": True}},
        )
        cid = conn.json()["data"]["connection"]["id"]
        other = await client.get(
            f"/mcp/connections/{cid}/snapshot",
            headers=auth.sign(tenant_b, user_b, "user", str(uuid4())),
        )
        assert other.status_code in (403, 404)
