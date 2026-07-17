"""Service-to-service HMAC auth and secret redaction."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import time
from typing import Any
from uuid import UUID

from advisory_core.contracts import ServiceIdentity

SECRET_KEY_RE = re.compile(
    r"(access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization|"
    r"client[_-]?id|credentials?|broker[_-]?token)",
    re.I,
)
JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def redact_secrets(value: Any, depth: int = 0) -> Any:
    if depth > 12:
        return "[REDACTED_DEPTH]"
    if value is None or isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, str):
        out = JWT_RE.sub("[REDACTED_JWT]", value)
        out = EMAIL_RE.sub("[REDACTED_EMAIL]", out)
        return out
    if isinstance(value, list):
        return [redact_secrets(v, depth + 1) for v in value]
    if isinstance(value, dict):
        return {
            k: ("[REDACTED]" if SECRET_KEY_RE.search(str(k)) else redact_secrets(v, depth + 1))
            for k, v in value.items()
        }
    return str(value)


def mask_account(value: str | None, visible: int = 4) -> str | None:
    if not value:
        return value
    if len(value) <= visible:
        return "*" * len(value)
    return ("*" * (len(value) - visible)) + value[-visible:]


class ServiceAuth:
    """HMAC signed service headers for gateway ↔ Python services."""

    HEADER_TENANT = "X-Tenant-Id"
    HEADER_USER = "X-User-Id"
    HEADER_ROLE = "X-User-Role"
    HEADER_REQUEST = "X-Request-Id"
    HEADER_TS = "X-Service-Timestamp"
    HEADER_SIG = "X-Service-Signature"

    def __init__(self, secret: str, max_skew_seconds: int = 300):
        if not secret or len(secret) < 16:
            raise ValueError("SERVICE_HMAC_SECRET must be at least 16 characters")
        self.secret = secret.encode("utf-8")
        self.max_skew_seconds = max_skew_seconds

    def sign(
        self,
        tenant_id: UUID | str,
        user_id: UUID | str,
        role: str,
        request_id: str,
        timestamp: int | None = None,
    ) -> dict[str, str]:
        ts = timestamp or int(time.time())
        payload = f"{tenant_id}:{user_id}:{role}:{request_id}:{ts}"
        sig = hmac.new(self.secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return {
            self.HEADER_TENANT: str(tenant_id),
            self.HEADER_USER: str(user_id),
            self.HEADER_ROLE: role,
            self.HEADER_REQUEST: request_id,
            self.HEADER_TS: str(ts),
            self.HEADER_SIG: sig,
        }

    def verify(self, headers: dict[str, str]) -> ServiceIdentity:
        tenant_id = headers.get(self.HEADER_TENANT) or headers.get(self.HEADER_TENANT.lower())
        user_id = headers.get(self.HEADER_USER) or headers.get(self.HEADER_USER.lower())
        role = headers.get(self.HEADER_ROLE) or headers.get(self.HEADER_ROLE.lower()) or "user"
        request_id = headers.get(self.HEADER_REQUEST) or headers.get(self.HEADER_REQUEST.lower())
        ts_raw = headers.get(self.HEADER_TS) or headers.get(self.HEADER_TS.lower())
        sig = headers.get(self.HEADER_SIG) or headers.get(self.HEADER_SIG.lower())
        if not all([tenant_id, user_id, request_id, ts_raw, sig]):
            raise PermissionError("Missing service auth headers")
        ts = int(ts_raw)
        if abs(int(time.time()) - ts) > self.max_skew_seconds:
            raise PermissionError("Service auth timestamp skew too large")
        payload = f"{tenant_id}:{user_id}:{role}:{request_id}:{ts}"
        expected = hmac.new(self.secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise PermissionError("Invalid service signature")
        return ServiceIdentity(
            tenant_id=UUID(str(tenant_id)),
            user_id=UUID(str(user_id)),
            role=role,
            request_id=str(request_id),
            timestamp=ts,
        )


def safe_json(data: Any) -> str:
    return json.dumps(redact_secrets(data), default=str)
