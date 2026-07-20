"""Auth refresh flow placeholders for Angel One SmartAPI."""

from __future__ import annotations

from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh

AUTH_FLOW = AuthFlowType.LOGIN_TOTP


async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False) -> AuthRefreshResult:
    return await placeholder_refresh(
        "angelone",
        AUTH_FLOW,
        credentials_present=credentials_present,
        refresh_token_present=refresh_token_present,
    )
