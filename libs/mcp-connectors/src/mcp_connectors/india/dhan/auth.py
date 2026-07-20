"""Auth refresh flow placeholders for Dhan / DhanHQ."""

from __future__ import annotations

from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh

AUTH_FLOW = AuthFlowType.API_KEY_TOKEN


async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False) -> AuthRefreshResult:
    return await placeholder_refresh(
        "dhan",
        AUTH_FLOW,
        credentials_present=credentials_present,
        refresh_token_present=refresh_token_present,
    )
