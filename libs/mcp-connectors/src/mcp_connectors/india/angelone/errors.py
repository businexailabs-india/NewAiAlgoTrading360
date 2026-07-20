"""Error mapping for Angel One SmartAPI."""

from __future__ import annotations

from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

ERROR_MAP: dict[str, ProviderErrorCode] = {
    "AG8001": ProviderErrorCode.AUTH_FAILED,
    "AB1007": ProviderErrorCode.TOKEN_EXPIRED,
    "AB1000": ProviderErrorCode.RATE_LIMITED,
    "AB1001": ProviderErrorCode.INVALID_REQUEST,
}


def map_error(raw_code: str | None = None, message: str = "", http_status: int | None = None):
    return map_provider_error(
        "angelone",
        raw_code=raw_code,
        message=message,
        http_status=http_status,
        mapping=ERROR_MAP,
    )
