"""Unit + simulation tests for IBKR MCP provider (MockIBKRClient)."""

from __future__ import annotations

import importlib

import pytest

from mcp_connectors.base.models import LiveOrderGateContext
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.ibkr import (
    IBKRConnectionConfig,
    IBKRMCPProvider,
    IBKRPaperGateError,
    MockIBKRClient,
)
from mcp_connectors.registry import get_registry

_ibkr_errors = importlib.import_module("mcp_connectors.global.ibkr.errors")
_ibkr_models = importlib.import_module("mcp_connectors.global.ibkr.models")


@pytest.fixture(autouse=True)
def _ibkr_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "false")
    monkeypatch.setenv("IBKR_LIVE_TRADING_ENABLED", "false")
    monkeypatch.setenv("IBKR_MODE", "paper")
    monkeypatch.setenv("IBKR_USE_MOCK", "true")
    monkeypatch.setenv("IBKR_PORT", "7497")
    monkeypatch.setenv("IBKR_HOST", "127.0.0.1")
    monkeypatch.setenv("IBKR_CLIENT_ID", "1001")
    monkeypatch.delenv("IBKR_ACCOUNT_ID", raising=False)
    monkeypatch.setenv("MCP_ENABLE_IBKR", "true")
    get_registry(reload=True)
    yield
    get_registry(reload=True)


@pytest.fixture
def ibkr() -> IBKRMCPProvider:
    return IBKRMCPProvider(client=MockIBKRClient())


def test_provider_config_loads():
    reg = get_registry(reload=True)
    cfg = next(p for p in reg.list_providers() if p.provider_id == "ibkr")
    assert cfg.provider_name == "Interactive Brokers"
    assert cfg.country == "GLOBAL"
    assert cfg.paper_trading_default is True
    assert cfg.live_trading_default is False
    assert "paper_order_execution" in cfg.capabilities
    provider = reg.get_provider("ibkr", fresh=True)
    assert isinstance(provider, IBKRMCPProvider)


def test_paper_port_default():
    cfg = IBKRConnectionConfig.from_env_and_overrides()
    assert cfg.port == 7497
    assert cfg.mode == "paper"
    assert cfg.live_trading_enabled is False


@pytest.mark.asyncio
async def test_account_summary_mapping(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    profile = await ibkr.get_account_profile()
    assert profile["provider_id"] == "ibkr"
    assert profile["account_id_masked"]
    assert "DU1234567" not in profile.get("account_id_masked", "") or "*" in profile["account_id_masked"]
    assert profile["net_liquidation"] == 250000.0


@pytest.mark.asyncio
async def test_position_mapping(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    positions = await ibkr.get_positions()
    assert any(p["symbol"] == "AAPL" for p in positions)


@pytest.mark.asyncio
async def test_order_mapping_and_preview(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    assert ibkr.map_order_type("LMT") == "LIMIT"
    assert ibkr.map_order_status("Filled") == "FILLED"
    preview = await ibkr.preview_order(
        {
            "tenant_id": "t",
            "user_id": "u",
            "provider_id": "ibkr",
            "exchange": "SMART",
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 10,
            "order_type": "MARKET",
        }
    )
    assert preview["accepted"] is True
    assert preview["live_execution"] is False
    assert preview["mode"] == "paper"


@pytest.mark.asyncio
async def test_live_order_rejected_by_default(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    with pytest.raises(LiveTradingBlockedError):
        await ibkr.place_order_disabled_by_default(
            {
                "tenant_id": "t",
                "user_id": "u",
                "provider_id": "ibkr",
                "exchange": "SMART",
                "symbol": "AAPL",
                "side": "BUY",
                "quantity": 1,
                "caller_role": "oms_service",
                "rms_approval_id": "rms-1",
                "user_approval_id": "user-1",
                "oms_order_id": "oms-1",
                "idempotency_key": "idem-live-1",
            },
            gate=LiveOrderGateContext(
                live_trading_enabled=True,
                caller_role="oms_service",
                rms_approval_id="rms-1",
                user_approval_id="user-1",
                provider_live_trading_enabled=True,
                kill_switch_off=True,
            ),
        )


@pytest.mark.asyncio
async def test_paper_order_accepted_with_mock(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    resp = await ibkr.place_paper_order(
        {
            "tenant_id": "t",
            "user_id": "u",
            "provider_id": "ibkr",
            "exchange": "SMART",
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 10,
            "order_type": "MARKET",
            "caller_role": "oms_service",
            "rms_approval_id": "rms-1",
            "user_approval_id": "user-1",
            "oms_order_id": "oms-1",
            "idempotency_key": "idem-paper-1",
        }
    )
    assert resp.provider_id == "ibkr"
    assert resp.provider_order_id
    assert resp.status in ("FILLED", "PARTIAL")


@pytest.mark.asyncio
async def test_direct_ai_order_rejected(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    with pytest.raises(IBKRPaperGateError):
        await ibkr.place_paper_order(
            {
                "tenant_id": "t",
                "user_id": "u",
                "provider_id": "ibkr",
                "exchange": "SMART",
                "symbol": "AAPL",
                "side": "BUY",
                "quantity": 1,
                "caller_role": "dhanlaxmi_assistant_service",
                "rms_approval_id": "rms-1",
                "user_approval_id": "user-1",
                "oms_order_id": "oms-1",
                "idempotency_key": "idem-ai-1",
            }
        )


@pytest.mark.asyncio
async def test_secrets_masked_and_audit(ibkr: IBKRMCPProvider, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IBKR_ACCOUNT_ID", "DU99887766")
    client = MockIBKRClient(config=IBKRConnectionConfig.from_env_and_overrides({"use_mock": True}))
    provider = IBKRMCPProvider(client=client)
    await provider.connect({"account_id": "DU99887766"}, {"use_mock": True, "account_id": "DU99887766"})
    profile = await provider.get_account_profile()
    blob = str(profile)
    assert "DU99887766" not in blob
    assert profile["account_id_masked"].endswith("7766")
    audit = provider.get_audit_log()
    assert any(a["action"] in ("provider.connect", "ibkr.connect") for a in audit)
    assert "DU99887766" not in str(audit)


@pytest.mark.asyncio
async def test_integration_paper_flow(ibkr: IBKRMCPProvider):
    await ibkr.connect({}, {"use_mock": True})
    summary = await ibkr.get_account_profile()
    assert summary["net_liquidation"] > 0
    positions = await ibkr.get_positions()
    assert positions
    contracts = await ibkr.search_instruments("AAPL")
    assert contracts[0]["symbol"] == "AAPL"
    quote = await ibkr.get_live_quotes(["AAPL"])
    assert quote["quotes"]["AAPL"]["last"] == 190.0
    preview = await ibkr.preview_order(
        {
            "tenant_id": "t",
            "user_id": "u",
            "provider_id": "ibkr",
            "exchange": "SMART",
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 5,
            "order_type": "MARKET",
        }
    )
    assert preview["accepted"] is True
    order = await ibkr.place_paper_order(
        {
            "tenant_id": "t",
            "user_id": "u",
            "provider_id": "ibkr",
            "exchange": "SMART",
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 5,
            "caller_role": "oms_service",
            "rms_approval_id": "rms-2",
            "user_approval_id": "user-2",
            "oms_order_id": "oms-2",
            "idempotency_key": "idem-flow-1",
        }
    )
    execs = await ibkr.get_trades()
    assert any(e["provider_order_id"] == order.provider_order_id for e in execs)
    positions2 = await ibkr.get_positions()
    aapl = next(p for p in positions2 if p["symbol"] == "AAPL")
    assert aapl["position"] >= 100
    assert any(a["action"] == "order.paper_placed" for a in ibkr.get_audit_log())


@pytest.mark.asyncio
async def test_sim_tws_disconnected():
    client = MockIBKRClient(simulate_disconnect=True)
    with pytest.raises(_ibkr_errors.IBKRConnectionError):
        await client.connect_to_tws_or_gateway()


@pytest.mark.asyncio
async def test_sim_timeout():
    client = MockIBKRClient(simulate_timeout=True)
    with pytest.raises(_ibkr_errors.IBKRTimeoutError):
        await client.connect_to_tws_or_gateway()


@pytest.mark.asyncio
async def test_sim_duplicate_order_id():
    client = MockIBKRClient()
    await client.connect_to_tws_or_gateway()
    req = _ibkr_models.IBKROrderRequest(
        symbol="AAPL",
        side="BUY",
        quantity=1,
        idempotency_key="dup-key",
        oms_order_id="o1",
        rms_approval_id="r1",
        user_approval_id="u1",
        caller_role="oms_service",
    )
    await client.place_paper_order(req)
    with pytest.raises(_ibkr_errors.IBKRDuplicateOrderError):
        await client.place_paper_order(req)


@pytest.mark.asyncio
async def test_sim_market_data_unavailable():
    client = MockIBKRClient(market_data_down=True)
    await client.connect_to_tws_or_gateway()
    with pytest.raises(_ibkr_errors.IBKRMarketDataUnavailableError):
        await client.request_market_data("AAPL")


@pytest.mark.asyncio
async def test_sim_contract_not_found():
    client = MockIBKRClient()
    await client.connect_to_tws_or_gateway()
    with pytest.raises(_ibkr_errors.IBKRContractNotFoundError):
        await client.request_contract_details(
            _ibkr_models.IBKRContractRequest(symbol="!!!", sec_type="STK")
        )


@pytest.mark.asyncio
async def test_sim_order_rejected_bracket():
    client = MockIBKRClient()
    await client.connect_to_tws_or_gateway()
    with pytest.raises(_ibkr_errors.IBKROrderRejectedError):
        await client.place_paper_order(
            _ibkr_models.IBKROrderRequest(
                symbol="AAPL", side="BUY", quantity=1, order_type="BRACKET"
            )
        )


@pytest.mark.asyncio
async def test_sim_partial_fill():
    client = MockIBKRClient()
    await client.connect_to_tws_or_gateway()
    resp = await client.place_paper_order(
        _ibkr_models.IBKROrderRequest(symbol="AAPL", side="BUY", quantity=51, order_type="MARKET")
    )
    assert resp.status == "PARTIAL"
    assert resp.filled_qty == 25
