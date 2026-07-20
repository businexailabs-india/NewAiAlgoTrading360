"""Interactive Brokers MCP provider package.

Note: the parent package name ``global`` is a Python keyword, so prefer:

    import importlib
    ibkr = importlib.import_module("mcp_connectors.global.ibkr")

or the public shim:

    from mcp_connectors.ibkr import IBKRMCPProvider
"""

from .config import IBKRConnectionConfig
from .errors import IBKRError, IBKRLiveTradingBlockedError, IBKRPaperGateError
from .ibkr_client import IBKRClient, MockIBKRClient, RealIBKRClient, build_ibkr_client, ibapi_available
from .provider import IBKRMCPProvider

__all__ = [
    "IBKRConnectionConfig",
    "IBKRClient",
    "IBKRMCPProvider",
    "IBKRError",
    "IBKRLiveTradingBlockedError",
    "IBKRPaperGateError",
    "MockIBKRClient",
    "RealIBKRClient",
    "build_ibkr_client",
    "ibapi_available",
]
