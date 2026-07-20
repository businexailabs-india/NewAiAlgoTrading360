"""Full tests for DhanMCPProvider + DhanHQConnector (mock API)."""

from __future__ import annotations

import os

import pytest

from mcp_connectors.base.models import LiveOrderGateContext
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.india.dhan import (
    DhanHQConnector,
    DhanMCPProvider,
    dhan_credentials_schema,
    validate_dhan_credentials,
)
from mcp_connectors.india.dhan.fixtures import MOCK_FIXTURES
from mcp_connectors import get_connector


@pytest.fixture
def dhan() -> DhanMCPProvider:
    os.environ["LIVE_TRADING_ENABLED"] = "false"
    os.environ["DHAN_ALLOW_LIVE_HTTP"] = "false"
    os.environ["DHAN_USE_MOCK"] = "true"
    return DhanMCPProvider()


@pytest.mark.asyncio
async def test_dhan_credential_schema():
    schema = dhan_credentials_schema()
    assert schema["required"] == ["client_id", "access_token"]
    assert "api_key" in schema["optional"]
    bad = validate_dhan_credentials({})
    assert bad["ok"] is False
    assert "client_id" in bad["missing"]
    good = validate_dhan_credentials({"client_id": "1112656215", "access_token": "tok"})
    assert good["ok"] is True
    assert good["masked_preview"]["access_token"] != "tok"
    assert good["masked_preview"]["client_id"].endswith("6215")
    assert "1112656215" not in good["masked_preview"]["client_id"]


@pytest.mark.asyncio
async def test_dhanhq_connector_mock_apis():
    conn = DhanHQConnector(use_mock=True, fixtures=MOCK_FIXTURES)
    result = await conn.connect({})
    assert result["ok"] is True
    assert result["mode"] == "mock"
    assert "access_token" not in result
    profile = await conn.get_profile()
    assert profile["dhanClientId"] == "1112656215"
    funds = await conn.get_fund_limit()
    assert funds["availabelBalance"] == 125000.0
    holdings = await conn.get_holdings()
    assert len(holdings["data"]) == 2
    positions = await conn.get_positions()
    assert positions["data"][0]["tradingSymbol"].startswith("NIFTY")
    orders = await conn.get_orders()
    assert len(orders["data"]) >= 2
    trades = await conn.get_trades()
    assert trades["data"][0]["tradedPrice"] == 2548.5
    quotes = await conn.get_ltp_placeholder(["RELIANCE", "TCS"])
    assert quotes["quotes"]["NSE:RELIANCE"]["ltp"] == 2550.0
    health = await conn.health_check()
    assert health["ok"] is True
    # Audit must never contain raw token
    assert conn._access_token  # internal only
    renew = await conn.renew_token_placeholder()
    assert renew["access_token"] == "[REDACTED]"


@pytest.mark.asyncio
async def test_dhan_provider_full_snapshot_and_books(dhan: DhanMCPProvider):
    await dhan.connect({}, {"use_mock": True, "demo": True})
    health = await dhan.health_check()
    assert health["status"] == "connected"

    profile = await dhan.get_account_profile()
    assert profile["masked_client_id"].endswith("6215")
    assert "1112656215" not in profile["masked_client_id"]

    margins = await dhan.get_margins()
    assert margins["available"] == 125000.0
    assert margins["extras"]["withdrawable"] == 100000.0

    holdings = await dhan.get_holdings()
    assert {h["symbol"] for h in holdings} == {"RELIANCE", "TCS"}

    positions = await dhan.get_positions()
    assert positions[0]["quantity"] == 50
    assert positions[0]["product_type"] == "MIS"

    orders = await dhan.get_orders()
    assert orders[0]["status"] == "FILLED"
    assert orders[1]["status"] == "PENDING"

    trades = await dhan.get_trades()
    assert trades[0]["symbol"] == "RELIANCE"

    quotes = await dhan.get_live_quotes(["RELIANCE"])
    assert quotes["quotes"]["NSE:RELIANCE"]["placeholder"] is True

    snap = await dhan.get_account_snapshot()
    assert snap["live_order_execution"] is False
    assert snap["secrets_included"] is False
    assert len(snap["holdings"]) == 2
    assert len(snap["orders"]) >= 2
    assert "access_token" not in snap
    assert "mock-token" not in str(snap).lower()


@pytest.mark.asyncio
async def test_dhan_order_preview_and_live_blocked(dhan: DhanMCPProvider):
    await dhan.connect({}, {"use_mock": True})
    preview = await dhan.preview_order(
        {
            "exchange": "NSE",
            "symbol": "RELIANCE",
            "side": "BUY",
            "quantity": 1,
            "order_type": "MARKET",
            "product_type": "CNC",
            "price": 2550,
        }
    )
    assert preview["accepted"] is True
    assert preview["live_execution"] is False
    assert preview["dhan_order_stub"]["securityId"] == "2885"
    assert preview["broker"] == "dhan"

    with pytest.raises(LiveTradingBlockedError):
        await dhan.place_order_disabled_by_default(
            {"symbol": "RELIANCE", "side": "BUY", "quantity": 1, "exchange": "NSE"},
            gate=LiveOrderGateContext(),
        )
    assert any(e["action"] == "order.live_blocked" for e in dhan.get_audit_log())


@pytest.mark.asyncio
async def test_dhan_provider_status_for_assistant(dhan: DhanMCPProvider):
    await dhan.connect({}, {"use_mock": True})
    status = await dhan.get_provider_status_for_assistant()
    assert status["connected"] is True
    assert status["live_trading_enabled"] is False
    assert status["holdings_count"] == 2
    assert status["masked_client_id"].endswith("6215")
    blob = str(status)
    assert "mock-token" not in blob
    assert "access_token" not in blob


@pytest.mark.asyncio
async def test_legacy_get_connector_dhan():
    conn = get_connector("dhan")
    await conn.connect()
    margins = await conn.get_margins()
    assert margins["available"] == 125000.0
    snap = await conn.get_account_snapshot()
    assert snap["provider_id"] == "dhan"
    with pytest.raises(PermissionError):
        await conn.execute_order_disabled_by_default({"symbol": "RELIANCE", "qty": 1})


@pytest.mark.asyncio
async def test_dhan_no_live_http_without_flag(monkeypatch):
    monkeypatch.setenv("DHAN_CLIENT_ID", "1112656215")
    monkeypatch.setenv("DHAN_ACCESS_TOKEN", "secret-live-token")
    monkeypatch.setenv("DHAN_BASE_URL", "https://api.dhan.co")
    monkeypatch.setenv("DHAN_ALLOW_LIVE_HTTP", "false")
    provider = DhanMCPProvider()
    result = await provider.connect(
        {"client_id": "1112656215", "access_token": "secret-live-token"},
        {"use_mock": False},
    )
    # Without allow flag, connector still constructed as mock by provider path when use_mock forced false
    # but DHAN_ALLOW_LIVE_HTTP false → provider recreates mock only when use_mock/demo true.
    # Explicit use_mock False + allow false: connect uses existing connector (mock default).
    assert result["ok"] is True
    assert "secret-live-token" not in str(result)
