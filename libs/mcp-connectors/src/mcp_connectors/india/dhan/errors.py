"""Error mapping for Dhan / DhanHQ."""

from __future__ import annotations

from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

ERROR_MAP: dict[str, ProviderErrorCode] = {
    "DH-901": ProviderErrorCode.AUTH_FAILED,
    "DH-905": ProviderErrorCode.TOKEN_EXPIRED,
    "429": ProviderErrorCode.RATE_LIMITED,
    "DH-101": ProviderErrorCode.INVALID_REQUEST,
}


def map_error(raw_code: str | None = None, message: str = "", http_status: int | None = None):
    return map_provider_error(
        "dhan",
        raw_code=raw_code,
        message=message,
        http_status=http_status,
        mapping=ERROR_MAP,
    )
