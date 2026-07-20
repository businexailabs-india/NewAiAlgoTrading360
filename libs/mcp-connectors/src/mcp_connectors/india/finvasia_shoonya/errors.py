"""Error mapping for Finvasia Shoonya API."""

from __future__ import annotations

from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

ERROR_MAP: dict[str, ProviderErrorCode] = {
    "401": ProviderErrorCode.AUTH_FAILED,
    "429": ProviderErrorCode.RATE_LIMITED,
    "400": ProviderErrorCode.INVALID_REQUEST,
}


def map_error(raw_code: str | None = None, message: str = "", http_status: int | None = None):
    return map_provider_error(
        "finvasia_shoonya",
        raw_code=raw_code,
        message=message,
        http_status=http_status,
        mapping=ERROR_MAP,
    )
