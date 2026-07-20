"""YAML-driven provider preference / context helpers (no hardcoded broker IDs)."""

from __future__ import annotations

from typing import Any

from mcp_connectors.registry import MCPProviderRegistry, get_registry


def phase3_provider_ids(registry: MCPProviderRegistry | None = None) -> list[str]:
    reg = registry or get_registry()
    rows = getattr(reg, "phase3_providers", None) or []
    if not rows:
        reg.load_providers_from_yaml()
        rows = getattr(reg, "phase3_providers", []) or []
    return [r["provider_id"] for r in rows]


def resolve_preferred_provider(
    hint: dict[str, Any] | None = None,
    *,
    registry: MCPProviderRegistry | None = None,
    connected_provider_ids: list[str] | None = None,
) -> str:
    """Pick preferred provider from hint + YAML Phase-3 priority (never live-execute)."""
    reg = registry or get_registry()
    if not getattr(reg, "phase3_providers", None):
        reg.load_providers_from_yaml()
    hint = hint or {}
    requested = str(hint.get("broker") or hint.get("provider_id") or "").lower().replace("-", "_")
    aliases = {
        "paper": "paper_trading",
        "mock": "mock_trading",
        "dhanhq": "dhan",
        "kite": "zerodha",
        "angel": "angelone",
        "breeze": "icici_breeze",
        "shoonya": "finvasia_shoonya",
    }
    requested = aliases.get(requested, requested)

    known = {p.provider_id for p in reg.list_providers()}
    if requested and requested in known:
        return requested

    connected = list(connected_provider_ids or [])
    # Prefer highest-priority Phase-3 provider that is connected
    for row in sorted(reg.phase3_providers, key=lambda r: int(r.get("priority") or 99)):
        pid = row["provider_id"]
        if pid in connected:
            return pid

    # Fallback: first enabled Phase-3 provider, else paper_trading
    for row in sorted(reg.phase3_providers, key=lambda r: int(r.get("priority") or 99)):
        cfg = next((p for p in reg.list_providers() if p.provider_id == row["provider_id"]), None)
        if cfg and cfg.enabled:
            return cfg.provider_id
    return "paper_trading"


async def fetch_provider_account_context(
    provider_id: str,
    *,
    credentials: dict[str, Any] | None = None,
    config: dict[str, Any] | None = None,
    registry: MCPProviderRegistry | None = None,
) -> dict[str, Any]:
    """Connect (mock-safe) and return redacted account context for advisory / assistant."""
    reg = registry or get_registry()
    provider = reg.get_provider(provider_id, fresh=True)
    cfg = config or {}
    if provider_id == "dhan" and "use_mock" not in cfg:
        cfg = {**cfg, "use_mock": True, "demo": True}
    result = await provider.connect(credentials or {}, cfg)
    health = await provider.health_check()
    status = "connected" if result.get("ok") or result.get("status") == "connected" else result.get("status") or "disconnected"
    margins = await provider.get_margins() if status == "connected" else {"available": 0.0}
    holdings = await provider.get_holdings() if status == "connected" else []
    positions = await provider.get_positions() if status == "connected" else []
    caps = reg.get_provider_capabilities(provider_id)
    snapshot = None
    if hasattr(provider, "get_account_snapshot") and status == "connected":
        snapshot = await provider.get_account_snapshot()
    assistant_status = None
    if hasattr(provider, "get_provider_status_for_assistant"):
        assistant_status = await provider.get_provider_status_for_assistant()
    return {
        "broker": provider_id,
        "provider_id": provider_id,
        "status": status,
        "health": health,
        "margins": margins,
        "holdings": holdings,
        "positions": positions,
        "account_snapshot": snapshot,
        "provider_status": assistant_status,
        "capabilities": caps,
        "live_order_execution": False,
        "live_trading_enabled": False,
        "secrets_included": False,
    }
