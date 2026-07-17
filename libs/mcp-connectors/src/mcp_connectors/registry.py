from __future__ import annotations

from mcp_connectors.base import BaseTradingMCPConnector, NotConfiguredConnector
from mcp_connectors.mock import MockTradingMCPConnector
from mcp_connectors.paper import PaperTradingMCPConnector


def list_connectors() -> list[str]:
    return [
        "dhan",
        "zerodha",
        "angelone",
        "upstox",
        "interactive_brokers",
        "alpaca",
        "paper",
        "mock",
    ]


def get_connector(name: str, **kwargs) -> BaseTradingMCPConnector:
    key = name.lower().replace("-", "_").replace(" ", "_")
    if key in ("paper", "paper_trading"):
        return PaperTradingMCPConnector(**{k: v for k, v in kwargs.items() if k == "initial_cash"})
    if key == "mock":
        return MockTradingMCPConnector(
            connected=kwargs.get("connected", True),
            stale=kwargs.get("stale", False),
        )
    # Dhan uses gateway context aggregation in production; placeholder until wired
    if key == "dhan":
        return NotConfiguredConnector("dhan") if not kwargs.get("configured") else MockTradingMCPConnector()
    if key in ("zerodha", "angelone", "upstox", "interactive_brokers", "alpaca", "ibkr"):
        return NotConfiguredConnector(key)
    raise ValueError(f"Unknown connector: {name}")


# Aliases matching plan names
DhanMCPConnector = lambda **kw: get_connector("dhan", **kw)  # noqa: E731
ZerodhaMCPConnector = lambda **kw: get_connector("zerodha", **kw)  # noqa: E731
AngelOneMCPConnector = lambda **kw: get_connector("angelone", **kw)  # noqa: E731
UpstoxMCPConnector = lambda **kw: get_connector("upstox", **kw)  # noqa: E731
InteractiveBrokersMCPConnector = lambda **kw: get_connector("interactive_brokers", **kw)  # noqa: E731
AlpacaMCPConnector = lambda **kw: get_connector("alpaca", **kw)  # noqa: E731
