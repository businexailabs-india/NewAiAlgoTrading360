"""In-memory connection/credential/audit store with tenant isolation."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from advisory_core.security import redact_secrets
from mcp_connectors.base.models import MCPConnection, ProviderCredential, ProviderHealthCheck
from mcp_connectors.base.secrets import SecretManager, get_secret_manager, mask_credential


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConnectionStore:
    def __init__(self, secrets: SecretManager | None = None):
        self.secrets = secrets or get_secret_manager()
        self.connections: dict[str, MCPConnection] = {}
        self.credentials: dict[str, ProviderCredential] = {}
        self.health: list[ProviderHealthCheck] = []
        self.audit: list[dict[str, Any]] = []
        self.provider_instances: dict[str, Any] = {}  # connection_id -> provider
        self.preview_idempotency: dict[str, dict[str, Any]] = {}

    def audit_event(
        self,
        *,
        tenant_id: str,
        user_id: str,
        action: str,
        provider_id: str | None = None,
        connection_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        event = {
            "id": str(uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "provider_id": provider_id,
            "connection_id": connection_id,
            "details": redact_secrets(details or {}),
            "created_at": _utcnow().isoformat(),
        }
        self.audit.append(event)
        return event

    def create_connection(
        self,
        *,
        tenant_id: str,
        user_id: str,
        provider_id: str,
        account_alias: str,
        credentials: dict[str, str],
        capabilities: dict[str, Any],
    ) -> MCPConnection:
        conn = MCPConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            provider_id=provider_id,
            account_alias=account_alias or provider_id,
            status="created",
            capabilities_json=capabilities,
        )
        # Encrypt each credential; never keep plaintext in connection model
        for ctype, value in credentials.items():
            if value is None or value == "":
                continue
            ref = f"{tenant_id}:{user_id}:{provider_id}:{ctype}:{uuid4()}"
            self.secrets.store(ref, str(value))
            cred = ProviderCredential(
                tenant_id=tenant_id,
                user_id=user_id,
                provider_id=provider_id,
                credential_type=ctype,
                encrypted_value=ref,  # store ref only
                masked_value=mask_credential(str(value)),
            )
            self.credentials[cred.id] = cred
            conn.encrypted_credentials_ref = conn.encrypted_credentials_ref or ref
        self.connections[conn.id] = conn
        self.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="connection.created",
            provider_id=provider_id,
            connection_id=conn.id,
            details={"account_alias": account_alias, "credential_types": list(credentials.keys())},
        )
        return conn

    def get_connection(self, connection_id: str, tenant_id: str, user_id: str | None = None) -> MCPConnection | None:
        conn = self.connections.get(connection_id)
        if not conn:
            return None
        if conn.tenant_id != tenant_id:
            return None
        if user_id and conn.user_id != user_id:
            return None
        return conn

    def list_connections(self, tenant_id: str, user_id: str | None = None) -> list[MCPConnection]:
        rows = [c for c in self.connections.values() if c.tenant_id == tenant_id]
        if user_id:
            rows = [c for c in rows if c.user_id == user_id]
        return rows

    def delete_connection(self, connection_id: str, tenant_id: str, user_id: str) -> bool:
        conn = self.get_connection(connection_id, tenant_id, user_id)
        if not conn:
            return False
        # delete credential refs
        for cred in list(self.credentials.values()):
            if cred.tenant_id == tenant_id and cred.user_id == user_id and cred.provider_id == conn.provider_id:
                self.secrets.delete(cred.encrypted_value)
                del self.credentials[cred.id]
        self.provider_instances.pop(connection_id, None)
        del self.connections[connection_id]
        self.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="connection.deleted",
            provider_id=conn.provider_id,
            connection_id=connection_id,
        )
        return True

    def load_credentials(self, conn: MCPConnection) -> dict[str, str]:
        out: dict[str, str] = {}
        for cred in self.credentials.values():
            if (
                cred.tenant_id == conn.tenant_id
                and cred.user_id == conn.user_id
                and cred.provider_id == conn.provider_id
            ):
                val = self.secrets.retrieve(cred.encrypted_value)
                if val is not None:
                    out[cred.credential_type] = val
        return out

    def masked_credentials(self, conn: MCPConnection) -> list[dict[str, str]]:
        return [
            {
                "credential_type": c.credential_type,
                "masked_value": c.masked_value,
                "id": c.id,
            }
            for c in self.credentials.values()
            if c.tenant_id == conn.tenant_id
            and c.user_id == conn.user_id
            and c.provider_id == conn.provider_id
        ]

    def record_health(self, check: ProviderHealthCheck) -> ProviderHealthCheck:
        self.health.append(check)
        return check

    def set_live_trading(
        self,
        connection_id: str,
        tenant_id: str,
        *,
        enabled: bool,
        actor_user_id: str,
    ) -> MCPConnection | None:
        conn = self.connections.get(connection_id)
        if not conn or conn.tenant_id != tenant_id:
            return None
        conn.live_trading_enabled = bool(enabled)
        conn.updated_at = _utcnow()
        self.connections[connection_id] = conn
        self.audit_event(
            tenant_id=tenant_id,
            user_id=actor_user_id,
            action="connection.live_trading_updated",
            provider_id=conn.provider_id,
            connection_id=connection_id,
            details={"live_trading_enabled": conn.live_trading_enabled},
        )
        return conn

    def public_connection(self, conn: MCPConnection) -> dict[str, Any]:
        data = conn.model_dump(mode="json")
        # never expose encrypted refs as secrets
        data["encrypted_credentials_ref"] = "[REDACTED_REF]" if conn.encrypted_credentials_ref else None
        data["credentials_masked"] = self.masked_credentials(conn)
        return data
