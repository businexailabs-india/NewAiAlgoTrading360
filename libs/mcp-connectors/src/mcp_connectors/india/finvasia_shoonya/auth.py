"""Auth refresh flow placeholders for Finvasia Shoonya API."""

from __future__ import annotations

from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh

AUTH_FLOW = AuthFlowType.VENDOR_LOGIN


async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False) -> AuthRefreshResult:
    return await placeholder_refresh(
        "finvasia_shoonya",
        AUTH_FLOW,
        credentials_present=credentials_present,
        refresh_token_present=refresh_token_present,
    )
