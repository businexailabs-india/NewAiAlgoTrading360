"""Auth refresh flow placeholders for Fyers API."""

from __future__ import annotations

from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh

AUTH_FLOW = AuthFlowType.OAUTH2


async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False) -> AuthRefreshResult:
    return await placeholder_refresh(
        "fyers",
        AUTH_FLOW,
        credentials_present=credentials_present,
        refresh_token_present=refresh_token_present,
    )
