"""Gateway -> service request authentication.

Wire format is identical to `advisory_core.security.ServiceAuth` so the existing Express gateway pattern works
unchanged:  HMAC-SHA256(secret, "tenant:user:role:request_id:timestamp").

Hardening over the shared helper:
  * the service REFUSES to start without a secret (>= 16 chars): there is no development default;
  * identity fields are strictly validated (a ':' inside a field would let one signature cover two payloads);
  * constant-time comparison, bounded clock skew, and single-use request ids (replay rejection);
  * every failure returns the same opaque error so callers cannot tell which check failed.

Known limits (documented, not hidden): the signature covers identity only - not the HTTP method, path or body.
Single-use request ids stop a captured header set being reused, but not tampering by a party that can modify a
request in flight before it reaches us, so keep the gateway->service hop on a private network / mTLS.
The replay cache is per-process; with multiple replicas move it to Redis (or sticky-route per tenant).
"""

from __future__ import annotations

import hashlib
import hmac
import re
import threading
import time
from dataclasses import dataclass

TENANT_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
ROLE_RE = re.compile(r"^[a-z_]{1,32}$")
REQUEST_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


class AuthError(Exception):
    """Raised for any authentication failure. The message is intentionally generic."""


@dataclass(frozen=True)
class Identity:
    tenant_id: str
    user_id: str
    gateway_role: str
    request_id: str


class GatewayAuth:
    def __init__(self, secret: str, max_skew_seconds: int = 120, clock=time.time):
        if not secret or len(secret) < 16:
            raise ValueError("SERVICE_HMAC_SECRET must be set and at least 16 characters")
        self._secret = secret.encode("utf-8")
        self.skew = max_skew_seconds
        self._clock = clock
        self._seen: dict[str, float] = {}
        self._lock = threading.Lock()

    def sign(self, tenant_id: str, user_id: str, role: str, request_id: str, ts: int | None = None) -> dict[str, str]:
        """Used by tests and tooling only."""
        ts = ts if ts is not None else int(self._clock())
        sig = self._mac(tenant_id, user_id, role, request_id, ts)
        return {"X-Tenant-Id": tenant_id, "X-User-Id": user_id, "X-User-Role": role, "X-Request-Id": request_id,
                "X-Service-Timestamp": str(ts), "X-Service-Signature": sig}

    def _mac(self, tenant: str, user: str, role: str, req: str, ts: int) -> str:
        return hmac.new(self._secret, f"{tenant}:{user}:{role}:{req}:{ts}".encode(), hashlib.sha256).hexdigest()

    def verify(self, headers) -> Identity:
        g = headers.get
        tenant, user, role = g("x-tenant-id"), g("x-user-id"), g("x-user-role") or ""
        req, ts_raw, sig = g("x-request-id"), g("x-service-timestamp"), g("x-service-signature")
        if not (tenant and user and req and ts_raw and sig):
            raise AuthError("unauthorised")
        if not (TENANT_RE.match(tenant) and TENANT_RE.match(user) and REQUEST_RE.match(req)
                and ROLE_RE.match(role)):
            raise AuthError("unauthorised")
        try:
            ts = int(ts_raw)
        except ValueError:
            raise AuthError("unauthorised") from None
        now = self._clock()
        if abs(now - ts) > self.skew:
            raise AuthError("unauthorised")
        if not hmac.compare_digest(self._mac(tenant, user, role, req, ts), sig):
            raise AuthError("unauthorised")
        # replay check only AFTER the signature is proven valid (so attackers cannot fill the cache)
        with self._lock:
            horizon = now - 2 * self.skew
            if len(self._seen) > 50_000:
                self._seen = {k: v for k, v in self._seen.items() if v >= horizon}
            key = f"{tenant}:{req}"
            if key in self._seen and self._seen[key] >= horizon:
                raise AuthError("unauthorised")
            self._seen[key] = now
        return Identity(tenant, user, role, req)
