"""Auth / session refresh flow placeholders for Indian brokers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AuthFlowType(StrEnum):
    NONE = "none"
    API_KEY_TOKEN = "api_key_token"
    OAUTH2 = "oauth2"
    LOGIN_TOTP = "login_totp"
    SESSION_TOKEN = "session_token"
    VENDOR_LOGIN = "vendor_login"


class AuthSessionState(BaseModel):
    provider_id: str
    flow: AuthFlowType = AuthFlowType.API_KEY_TOKEN
    authenticated: bool = False
    access_token_present: bool = False
    refresh_token_present: bool = False
    expires_at: datetime | None = None
    last_refreshed_at: datetime | None = None
    feed_token_present: bool = False
    notes: str = "Phase-2 placeholder — wire real refresh against broker auth endpoints"


class AuthRefreshResult(BaseModel):
    ok: bool
    status: str
    provider_id: str
    session: AuthSessionState
    next_action: str = ""
    details: dict[str, Any] = Field(default_factory=dict)


def build_session(
    provider_id: str,
    flow: AuthFlowType,
    *,
    has_access: bool = False,
    has_refresh: bool = False,
    ttl_seconds: int = 86400,
) -> AuthSessionState:
    now = datetime.now(timezone.utc)
    return AuthSessionState(
        provider_id=provider_id,
        flow=flow,
        authenticated=has_access,
        access_token_present=has_access,
        refresh_token_present=has_refresh,
        expires_at=now + timedelta(seconds=ttl_seconds) if has_access else None,
        last_refreshed_at=now if has_access else None,
    )


async def placeholder_refresh(
    provider_id: str,
    flow: AuthFlowType,
    *,
    credentials_present: bool,
    refresh_token_present: bool = False,
) -> AuthRefreshResult:
    """Do not call broker auth APIs here — readiness stub only."""
    if not credentials_present:
        session = build_session(provider_id, flow, has_access=False)
        return AuthRefreshResult(
            ok=False,
            status="not_configured",
            provider_id=provider_id,
            session=session,
            next_action="configure_credentials",
        )
    session = build_session(
        provider_id,
        flow,
        has_access=True,
        has_refresh=refresh_token_present,
    )
    return AuthRefreshResult(
        ok=True,
        status="refresh_placeholder_ok",
        provider_id=provider_id,
        session=session,
        next_action="implement_broker_token_exchange",
        details={"phase": 2, "live_auth_call": False},
    )
