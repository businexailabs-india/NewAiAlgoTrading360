"""Unit tests for Indian MCP provider registry and adapters."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from mcp_connectors import get_connector, get_registry
from mcp_connectors.base.mappings import map_order_status, map_order_type, map_product_type, normalize_symbol
from mcp_connectors.base.models import LiveOrderGateContext, NormalizedOrderRequest
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.base.secrets import LocalEncryptedSecretManager, mask_credential
from mcp_connectors.india.dhan import DhanMCPProvider
from mcp_connectors.india.paper_trading import PaperTradingProvider
from mcp_connectors.registry import MCPProviderRegistry

REPO = Path(__file__).resolve().parents[3]
CONFIG = REPO / "config" / "mcp-providers"


@pytest.fixture
def registry():
    os.environ["MCP_PROVIDERS_CONFIG_DIR"] = str(CONFIG)
    os.environ["LIVE_TRADING_ENABLED"] = "false"
    reg = MCPProviderRegistry(config_dir=CONFIG)
    reg.load_providers_from_yaml()
    return reg


def test_registry_loads_yaml(registry: MCPProviderRegistry):
    providers = registry.list_providers()
    ids = {p.provider_id for p in providers}
    assert "dhan" in ids
    assert "zerodha" in ids
    assert "paper_trading" in ids
    assert "truedata" in ids
    assert "mock_market_data" in ids
    assert len(providers) >= 20


def test_provider_capability_validation(registry: MCPProviderRegistry):
    caps = registry.get_provider_capabilities("dhan")
    assert "ACCOUNT_PROFILE" in caps["capabilities"]
    assert caps["live_trading_default"] is False
    result = registry.validate_provider_config("dhan")
    assert result["ok"] is True


def test_list_by_country_and_capability(registry: MCPProviderRegistry):
    india = registry.list_providers_by_country("IN")
    assert all(p.country == "IN" for p in india)
    with_quotes = registry.list_providers_by_capability("LIVE_QUOTES")
    assert any(p.provider_id == "dhan" for p in with_quotes)
    nse = registry.list_providers_by_exchange("NSE")
    assert any(p.provider_id == "zerodha" for p in nse)


@pytest.mark.asyncio
async def test_dhan_mock_connection():
    provider = DhanMCPProvider()
    result = await provider.connect({}, {"use_mock": True, "demo": True})
    assert result["ok"] is True
    assert result["status"] == "connected"
    profile = await provider.get_account_profile()
    assert "masked_client_id" in profile
    margins = await provider.get_margins()
    assert margins["available"] > 0
    holdings = await provider.get_holdings()
    assert holdings[0]["symbol"] == "RELIANCE"


@pytest.mark.asyncio
async def test_zerodha_not_configured_gracefully(registry: MCPProviderRegistry):
    provider = registry.get_provider("zerodha", fresh=True)
    result = await provider.connect({}, {})
    assert result["status"] == "not_configured"
    health = await provider.health_check()
    assert health["status"] == "not_configured"


@pytest.mark.asyncio
async def test_angelone_not_configured_gracefully(registry: MCPProviderRegistry):
    provider = registry.get_provider("angelone", fresh=True)
    health = await provider.health_check()
    assert health["status"] == "not_configured"


@pytest.mark.asyncio
async def test_paper_trading_executes_paper_order():
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
    assert paper.cash < 100000
    assert any(h["symbol"] == "RELIANCE" for h in paper.holdings)


@pytest.mark.asyncio
async def test_live_order_blocked_by_default():
    provider = DhanMCPProvider()
    await provider.connect({}, {"use_mock": True})
    with pytest.raises(LiveTradingBlockedError):
        await provider.place_order_disabled_by_default(
            {"symbol": "RELIANCE", "quantity": 1, "side": "BUY"},
            gate=LiveOrderGateContext(),
        )


def test_credential_masking():
    masked = mask_credential("access-token-123456")
    assert masked.endswith("3456")
    assert "access-token" not in masked
    assert "*" in masked


def test_local_secret_manager_roundtrip():
    sm = LocalEncryptedSecretManager("unit-test-key")
    sm.store("ref1", "super-secret-token")
    assert sm.retrieve("ref1") == "super-secret-token"
    sm.rotate("ref1", "rotated-token")
    assert sm.retrieve("ref1") == "rotated-token"


def test_order_status_and_symbol_mapping():
    assert map_order_status("dhan", "TRADED").value == "FILLED"
    assert map_order_status("zerodha", "COMPLETE").value == "FILLED"
    assert map_product_type("dhan", "INTRADAY").value == "MIS"
    assert map_order_type("zerodha", "SL-M").value == "SL_M"
    assert normalize_symbol("NSE", "reliance") == "NSE:RELIANCE"


@pytest.mark.asyncio
async def test_legacy_get_connector_execute_disabled():
    conn = get_connector("mock")
    with pytest.raises(PermissionError):
        await conn.execute_order_disabled_by_default({"symbol": "RELIANCE", "qty": 1})


@pytest.mark.asyncio
async def test_legacy_zerodha_placeholder():
    conn = get_connector("zerodha")
    health = await conn.health_check()
    assert health["status"] == "not_configured"


def test_get_registry_singleton():
    os.environ["MCP_PROVIDERS_CONFIG_DIR"] = str(CONFIG)
    reg = get_registry(reload=True)
    assert len(reg.list_providers()) >= 20
