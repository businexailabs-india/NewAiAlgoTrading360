from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error

ERROR_MAP = {"401": ProviderErrorCode.AUTH_FAILED, "429": ProviderErrorCode.RATE_LIMITED}


def map_error(raw_code=None, message="", http_status=None):
    return map_provider_error("bse_direct", raw_code=raw_code, message=message, http_status=http_status, mapping=ERROR_MAP)
