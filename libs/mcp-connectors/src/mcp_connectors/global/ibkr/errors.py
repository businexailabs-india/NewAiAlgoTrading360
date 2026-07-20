"""IBKR connector errors."""

from __future__ import annotations


class IBKRError(Exception):
    """Base IBKR connector error."""

    def __init__(self, message: str, code: str = "IBKR_ERROR"):
        super().__init__(message)
        self.code = code


class IBKRConnectionError(IBKRError):
    def __init__(self, message: str = "IBKR TWS/Gateway unavailable"):
        super().__init__(message, code="IBKR_CONNECTION")


class IBKRTimeoutError(IBKRError):
    def __init__(self, message: str = "IBKR API timeout"):
        super().__init__(message, code="IBKR_TIMEOUT")


class IBKRContractNotFoundError(IBKRError):
    def __init__(self, message: str = "IBKR contract not found"):
        super().__init__(message, code="IBKR_CONTRACT_NOT_FOUND")


class IBKRMarketDataUnavailableError(IBKRError):
    def __init__(self, message: str = "IBKR market data unavailable"):
        super().__init__(message, code="IBKR_MARKET_DATA")


class IBKROrderRejectedError(IBKRError):
    def __init__(self, message: str = "IBKR order rejected"):
        super().__init__(message, code="IBKR_ORDER_REJECTED")


class IBKRDuplicateOrderError(IBKRError):
    def __init__(self, message: str = "Duplicate IBKR order id / idempotency key"):
        super().__init__(message, code="IBKR_DUPLICATE_ORDER")


class IBKRLiveTradingBlockedError(IBKRError, PermissionError):
    def __init__(self, message: str = "IBKR live trading blocked"):
        super().__init__(message, code="IBKR_LIVE_BLOCKED")


class IBKRPaperGateError(IBKRError, PermissionError):
    def __init__(self, message: str = "IBKR paper order gate failed"):
        super().__init__(message, code="IBKR_PAPER_GATE")
