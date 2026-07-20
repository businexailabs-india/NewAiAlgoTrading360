"""Backward-compatible PaperTradingMCPConnector export."""

from mcp_connectors.india.paper_trading import PaperTradingProvider
from mcp_connectors.legacy import LegacyConnectorAdapter


class PaperTradingMCPConnector(LegacyConnectorAdapter):
    name = "paper"

    def __init__(self, initial_cash: float = 100000.0):
        provider = PaperTradingProvider(initial_cash=initial_cash)
        super().__init__(provider)
        self.cash = provider.cash
