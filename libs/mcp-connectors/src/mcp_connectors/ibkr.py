"""Public import shim for IBKR (avoids `from mcp_connectors.global...` keyword issue)."""

from __future__ import annotations

import importlib
from typing import Any

_ibkr = importlib.import_module("mcp_connectors.global.ibkr")

IBKRMCPProvider = _ibkr.IBKRMCPProvider
IBKRConnectionConfig = _ibkr.IBKRConnectionConfig
IBKRClient = _ibkr.IBKRClient
MockIBKRClient = _ibkr.MockIBKRClient
RealIBKRClient = _ibkr.RealIBKRClient
build_ibkr_client = _ibkr.build_ibkr_client
ibapi_available = _ibkr.ibapi_available
IBKRError = _ibkr.IBKRError
IBKRLiveTradingBlockedError = _ibkr.IBKRLiveTradingBlockedError
IBKRPaperGateError = _ibkr.IBKRPaperGateError

__all__ = [
    "IBKRMCPProvider",
    "IBKRConnectionConfig",
    "IBKRClient",
    "MockIBKRClient",
    "RealIBKRClient",
    "build_ibkr_client",
    "ibapi_available",
    "IBKRError",
    "IBKRLiveTradingBlockedError",
    "IBKRPaperGateError",
]


def __getattr__(name: str) -> Any:
    return getattr(_ibkr, name)
