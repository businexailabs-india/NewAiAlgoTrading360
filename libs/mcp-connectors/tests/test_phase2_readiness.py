"""Phase-2 readiness tests — DTOs, fixtures, auth refresh, certification."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from mcp_connectors.base.certification import run_provider_certification, write_certification_report
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.india.dhan import DhanMCPProvider
from mcp_connectors.india.dhan.errors import map_error as dhan_map_error
from mcp_connectors.india.zerodha import ZerodhaMCPProvider
from mcp_connectors.india.zerodha.fixtures import MOCK_FIXTURES as ZERODHA_FIXTURES
from mcp_connectors.india.angelone import AngelOneMCPProvider
from mcp_connectors.registry import MCPProviderRegistry

REPO = Path(__file__).resolve().parents[3]
CONFIG = REPO / "config" / "mcp-providers"
REPORTS = REPO / "reports" / "provider-certification"


@pytest.fixture
def registry():
    os.environ["MCP_PROVIDERS_CONFIG_DIR"] = str(CONFIG)
    os.environ["LIVE_TRADING_ENABLED"] = "false"
    os.environ["PROVIDER_ALLOW_LIVE_HTTP"] = "false"
    reg = MCPProviderRegistry(config_dir=CONFIG)
    reg.load_providers_from_yaml()
    return reg


@pytest.mark.asyncio
async def test_zerodha_phase2_fixtures_and_dtos():
    p = ZerodhaMCPProvider()
    assert "GET /user/profile" in ZERODHA_FIXTURES
    connected = await p.connect({}, {"use_mock": True})
    assert connected["ok"] is True
    assert connected["mode"] == "mock"
    profile = await p.get_account_profile()
    assert profile["masked_client_id"].endswith("1234")
    margins = await p.get_margins()
    assert margins["available"] == 150000.0
    holdings = await p.get_holdings()
    assert holdings[0]["symbol"] == "RELIANCE"
    quotes = await p.get_live_quotes(["RELIANCE"])
    assert "NSE:RELIANCE" in quotes["quotes"]
    refresh = await p.refresh_session()
    assert refresh["status"] == "refresh_placeholder_ok"
    assert refresh["live_http"] is False
    limits = p.get_rate_limits()
    assert limits["provider_id"] == "zerodha"
    assert limits["orders_per_second"] == 3
    err = p.map_error(raw_code="TokenException", message="expired")
    assert err["code"] == ProviderErrorCode.TOKEN_EXPIRED.value
    stub = await p.stub_place_order_request({"symbol": "RELIANCE", "side": "BUY", "quantity": 1})
    assert stub["executed"] is False


@pytest.mark.asyncio
async def test_angelone_and_dhan_phase2():
    angel = AngelOneMCPProvider()
    await angel.connect({}, {"use_mock": True})
    margins = await angel.get_margins()
    assert margins["available"] == 120000.0
    quotes = await angel.get_live_quotes(["RELIANCE"])
    assert quotes["quotes"]["NSE:RELIANCE"]["ltp"] == 2550.0

    dhan = DhanMCPProvider()
    await dhan.connect({}, {"use_mock": True})
    preview = await dhan.preview_order(
        {"exchange": "NSE", "symbol": "RELIANCE", "side": "BUY", "quantity": 1, "price": 100}
    )
    assert preview["accepted"] is True
    assert preview["live_execution"] is False
    assert preview["dhan_order_stub"]["securityId"] == "2885"
    assert dhan_map_error(raw_code="DH-905").code == ProviderErrorCode.TOKEN_EXPIRED


@pytest.mark.asyncio
async def test_no_live_http_without_allow_flag(monkeypatch):
    monkeypatch.setenv("ZERODHA_API_KEY", "k")
    monkeypatch.setenv("ZERODHA_API_SECRET", "s")
    monkeypatch.setenv("ZERODHA_BASE_URL", "https://api.kite.trade")
    monkeypatch.delenv("ZERODHA_ALLOW_LIVE_HTTP", raising=False)
    monkeypatch.delenv("PROVIDER_ALLOW_LIVE_HTTP", raising=False)
    p = ZerodhaMCPProvider()
    result = await p.connect({"api_key": "k", "api_secret": "s"}, {})
    assert result["mode"] == "credentials_configured_mock"
    assert p.http.use_mock is True


@pytest.mark.asyncio
async def test_certification_checklist_and_report(registry):
    provider = registry.get_provider("dhan", fresh=True)
    checklist = await run_provider_certification(
        provider,
        provider_name="Dhan / DhanHQ",
        credentials_env_configured=False,
    )
    assert checklist.overall_passed is True
    assert checklist.score >= 70
    from mcp_connectors.base.certification import CertItemId

    item_ids = {i.item_id for i in checklist.items}
    assert CertItemId.LIVE_EXECUTION_DISABLED_BY_DEFAULT in item_ids
    path = write_certification_report(checklist, REPORTS)
    assert path.exists()
    assert (REPORTS / "dhan-latest.md").exists()


@pytest.mark.asyncio
async def test_all_brokers_have_phase2_modules(registry):
    brokers = [
        p.provider_id
        for p in registry.list_providers()
        if p.provider_type in ("broker", "simulated_broker", "mock")
    ]
    for pid in brokers:
        folder = "mock" if pid == "mock_trading" else pid
        base = REPO / "libs" / "mcp-connectors" / "src" / "mcp_connectors" / "india" / folder
        for name in ("errors.py", "rate_limits.py", "auth.py", "fixtures.py", "dtos.py"):
            assert (base / name).exists(), f"missing {folder}/{name}"
