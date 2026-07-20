"""IBKR provider facade for mcp-connector-service."""

from __future__ import annotations

from mcp_connectors.ibkr import IBKRMCPProvider, MockIBKRClient
from mcp_connectors.registry import get_registry


def get_ibkr_provider(*, fresh: bool = True) -> IBKRMCPProvider:
    provider = get_registry().get_provider("ibkr", fresh=fresh)
    if not isinstance(provider, IBKRMCPProvider):
        return IBKRMCPProvider()
    return provider


def get_mock_ibkr_provider() -> IBKRMCPProvider:
    return IBKRMCPProvider(client=MockIBKRClient())


__all__ = ["IBKRMCPProvider", "get_ibkr_provider", "get_mock_ibkr_provider"]
