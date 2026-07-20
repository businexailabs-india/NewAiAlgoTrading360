"""Auth refresh flow placeholders for ICICI Direct Breeze API."""

from __future__ import annotations

from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh

AUTH_FLOW = AuthFlowType.SESSION_TOKEN


async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False) -> AuthRefreshResult:
    return await placeholder_refresh(
        "icici_breeze",
        AUTH_FLOW,
        credentials_present=credentials_present,
        refresh_token_present=refresh_token_present,
    )
