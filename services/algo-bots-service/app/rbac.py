"""Backend-enforced RBAC for the algo trading platform.

The UI hides controls for convenience; THIS module is the control. Every route declares one permission and the
check runs server-side on every request using a role resolved from `algo.role_assignments`, never from a
client-supplied field.

Separation of duties (deliberate, stricter than a simple hierarchy):
  * only `trading_admin` may enable live trading (matches `LiveModeGate.AUTHORISED_ROLES`); `platform_admin`
    manages users/roles and cannot enable live;
  * only `risk_manager` / `platform_admin` may RELEASE the kill switch; anyone but a viewer may ENGAGE it;
  * revoking live is allowed to the broadest safe set (risk can always pull the plug);
  * nobody can change their own role.
"""

from __future__ import annotations

PLATFORM_ADMIN = "platform_admin"
TRADING_ADMIN = "trading_admin"
TRADER = "trader"
RISK_MANAGER = "risk_manager"
VIEWER = "viewer"
ROLES = (PLATFORM_ADMIN, TRADING_ADMIN, TRADER, RISK_MANAGER, VIEWER)

# Gateway roles (tenant membership) that map to platform_admin ONLY when no explicit assignment exists.
GATEWAY_ADMIN_ROLES = {"owner", "admin"}

PERMISSIONS: dict[str, frozenset[str]] = {
    "read": frozenset(ROLES),
    "bot_control": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, TRADER}),
    "configure": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, TRADER}),  # live-enabled bot: trading_admin (route-level)
    "backtest": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, TRADER}),
    "live_activate": frozenset({TRADING_ADMIN}),
    "live_revoke": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, RISK_MANAGER}),
    "kill_engage": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, TRADER, RISK_MANAGER}),
    "kill_release": frozenset({PLATFORM_ADMIN, RISK_MANAGER}),
    "reports_generate": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, TRADER, RISK_MANAGER}),
    "audit_view": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, RISK_MANAGER}),
    "maintenance": frozenset({PLATFORM_ADMIN, TRADING_ADMIN, RISK_MANAGER}),
    "role_manage": frozenset({PLATFORM_ADMIN}),
}

# Permissions whose DENIAL is audited (read denials would just be noise).
AUDITED_DENIALS = frozenset(PERMISSIONS) - {"read"}


def permissions_for(role: str) -> list[str]:
    return sorted(p for p, roles in PERMISSIONS.items() if role in roles)


def allowed(role: str, permission: str) -> bool:
    return role in PERMISSIONS.get(permission, frozenset())


def resolve_role(store, tenant_id: str, user_id: str, gateway_role: str) -> str:
    """Explicit assignment wins; otherwise tenant owner/admin => platform_admin; otherwise least privilege."""
    row = store.one(
        "SELECT role FROM role_assignments WHERE tenant_id=? AND user_id=? AND revoked_at IS NULL",
        (tenant_id, user_id))
    if row:
        return row["role"]
    revoked = store.one("SELECT 1 FROM role_assignments WHERE tenant_id=? AND user_id=? AND revoked_at IS NOT NULL",
                        (tenant_id, user_id))
    if revoked:  # an explicit revocation must not be undone by the gateway hint
        return VIEWER
    return PLATFORM_ADMIN if gateway_role in GATEWAY_ADMIN_ROLES else VIEWER
