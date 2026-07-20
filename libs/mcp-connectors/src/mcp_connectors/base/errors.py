"""Normalized provider error mapping for Indian broker adapters."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ProviderErrorCode(StrEnum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    AUTH_FAILED = "AUTH_FAILED"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    RATE_LIMITED = "RATE_LIMITED"
    INVALID_REQUEST = "INVALID_REQUEST"
    INSTRUMENT_NOT_FOUND = "INSTRUMENT_NOT_FOUND"
    INSUFFICIENT_MARGIN = "INSUFFICIENT_MARGIN"
    ORDER_REJECTED = "ORDER_REJECTED"
    MARKET_CLOSED = "MARKET_CLOSED"
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    TIMEOUT = "TIMEOUT"
    FORBIDDEN = "FORBIDDEN"
    UNKNOWN = "UNKNOWN"


class ProviderError(BaseModel):
    provider_id: str
    code: ProviderErrorCode = ProviderErrorCode.UNKNOWN
    message: str
    http_status: int | None = None
    retryable: bool = False
    raw_code: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class ProviderAPIError(Exception):
    def __init__(self, error: ProviderError):
        self.error = error
        super().__init__(f"{error.provider_id}:{error.code}:{error.message}")


def map_provider_error(
    provider_id: str,
    *,
    raw_code: str | None = None,
    message: str = "",
    http_status: int | None = None,
    mapping: dict[str, ProviderErrorCode] | None = None,
) -> ProviderError:
    table = mapping or {}
    key = (raw_code or "").strip()
    code = table.get(key) or table.get(key.upper()) or table.get(str(http_status) if http_status else "")
    if code is None:
        if http_status == 401:
            code = ProviderErrorCode.AUTH_FAILED
        elif http_status == 403:
            code = ProviderErrorCode.FORBIDDEN
        elif http_status == 429:
            code = ProviderErrorCode.RATE_LIMITED
        elif http_status in (408, 504):
            code = ProviderErrorCode.TIMEOUT
        elif http_status and http_status >= 500:
            code = ProviderErrorCode.UPSTREAM_UNAVAILABLE
        else:
            code = ProviderErrorCode.UNKNOWN
    retryable = code in {
        ProviderErrorCode.RATE_LIMITED,
        ProviderErrorCode.TIMEOUT,
        ProviderErrorCode.UPSTREAM_UNAVAILABLE,
        ProviderErrorCode.TOKEN_EXPIRED,
    }
    return ProviderError(
        provider_id=provider_id,
        code=code,
        message=message or code.value,
        http_status=http_status,
        retryable=retryable,
        raw_code=raw_code,
    )
