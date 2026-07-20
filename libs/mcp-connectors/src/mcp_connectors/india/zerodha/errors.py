"""Error mapping for Zerodha Kite Connect."""

from __future__ import annotations

from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

ERROR_MAP: dict[str, ProviderErrorCode] = {
    "TokenException": ProviderErrorCode.TOKEN_EXPIRED,
    "InputException": ProviderErrorCode.INVALID_REQUEST,
    "NetworkException": ProviderErrorCode.UPSTREAM_UNAVAILABLE,
    "429": ProviderErrorCode.RATE_LIMITED,
}


def map_error(raw_code: str | None = None, message: str = "", http_status: int | None = None):
    return map_provider_error(
        "zerodha",
        raw_code=raw_code,
        message=message,
        http_status=http_status,
        mapping=ERROR_MAP,
    )
