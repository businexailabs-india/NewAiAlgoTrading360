"""Error mapping for Upstox API."""

from __future__ import annotations

from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

ERROR_MAP: dict[str, ProviderErrorCode] = {
    "UDAPI100010": ProviderErrorCode.AUTH_FAILED,
    "UDAPI100050": ProviderErrorCode.RATE_LIMITED,
    "UDAPI100012": ProviderErrorCode.INVALID_REQUEST,
}


def map_error(raw_code: str | None = None, message: str = "", http_status: int | None = None):
    return map_provider_error(
        "upstox",
        raw_code=raw_code,
        message=message,
        http_status=http_status,
        mapping=ERROR_MAP,
    )
