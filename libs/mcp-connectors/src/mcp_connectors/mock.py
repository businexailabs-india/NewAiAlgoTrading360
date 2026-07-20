"""Backward-compatible MockTradingMCPConnector export."""

from mcp_connectors.india.mock import MockTradingProvider
from mcp_connectors.legacy import LegacyConnectorAdapter


class MockTradingMCPConnector(LegacyConnectorAdapter):
    name = "mock"

    def __init__(self, connected: bool = True, stale: bool = False):
        provider = MockTradingProvider(connected=connected, stale=stale)
        super().__init__(provider)
