"""TradingView MCP provider — paper/signal only."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.registry import MCPProviderRegistry
from mcp_connectors.tradingview import TradingViewMCPProvider
from mcp_connectors.tradingview.signal import normalize_alert_payload, preview_signal
from mcp_connectors.tradingview.symbols import map_symbol


REPO = Path(__file__).resolve().parents[3]
CONFIG = REPO / "config" / "mcp-providers"


@pytest.fixture
def registry(monkeypatch: pytest.MonkeyPatch) -> MCPProviderRegistry:
    monkeypatch.setenv("MCP_PROVIDERS_CONFIG_DIR", str(CONFIG))
    monkeypatch.setenv("MCP_ENABLE_TRADINGVIEW", "true")
    monkeypatch.setenv("LIVE_TRADING_ENABLED", "false")
    reg = MCPProviderRegistry(config_dir=CONFIG)
    reg.load_providers_from_yaml()
    return reg


def test_registry_loads_tradingview(registry: MCPProviderRegistry):
    cfg = registry._configs.get("tradingview")
    assert cfg is not None
    assert cfg.enabled is True
    assert cfg.live_trading_default is False
    assert cfg.paper_trading_default is True
    assert "mcp_connectors.tradingview.TradingViewMCPProvider" in cfg.adapter_class


def test_alias_tv(registry: MCPProviderRegistry):
    p = registry.get_provider("tv")
    assert isinstance(p, TradingViewMCPProvider)
    assert p.provider_id == "tradingview"


@pytest.mark.asyncio
async def test_connect_preview_and_no_live(registry: MCPProviderRegistry):
    p = registry.get_provider("tradingview", fresh=True)
    conn = await p.connect({}, {"name": "tv-test"})
    assert conn["ok"] is True
    assert "webhook_secret" in conn
    secret = conn["webhook_secret"]

    templates = await p.get_payload_templates()
    assert len(templates) >= 5
    assert all(t.get("live_trading_disabled") for t in templates)

    mapped = await p.map_tv_symbol("NSE:RELIANCE")
    assert mapped["symbol"] == "RELIANCE"
    assert mapped["exchange"] == "NSE"

    preview = await p.preview_alert(
        {
            "secret": secret,
            "symbol": "RELIANCE",
            "exchange": "NSE",
            "side": "BUY",
            "quantity": 1,
            "price": 1300,
            "mode": "LIVE",  # must be forced to paper
        }
    )
    assert preview["preview"] is True
    assert preview["accepted"] is True
    assert preview["mode"] == "PAPER"
    assert preview["live_trading_disabled"] is True
    assert "live_mode_rejected_forced_paper" in preview["warnings"]

    with pytest.raises(LiveTradingBlockedError):
        await p.place_order_disabled_by_default({"symbol": "RELIANCE", "side": "BUY", "quantity": 1})


def test_map_symbol_helpers():
    assert map_symbol("RELIANCE.NS")["exchange"] == "NSE"
    assert map_symbol("BANKNIFTY")["segment"] == "IDX"


def test_normalize_alert():
    n = normalize_alert_payload({"ticker": "TCS", "action": "LONG", "qty": 2, "close": 3500})
    assert n["symbol"] == "TCS"
    assert n["side"] == "BUY"
    assert n["quantity"] == 2
    assert n["live_trading_disabled"] is True


def test_preview_secret_mismatch():
    r = preview_signal({"symbol": "INFY", "side": "BUY", "secret": "wrong"}, expected_secret="right")
    assert r["accepted"] is False
    assert "webhook_secret_mismatch" in r["warnings"]
