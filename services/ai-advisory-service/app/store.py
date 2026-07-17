"""In-memory + optional SQLAlchemy-backed store for advisory vertical slice."""

from __future__ import annotations

import copy
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4


class InMemoryAdvisoryStore:
    """Deterministic store used by unit tests and local fallback without DB."""

    def __init__(self) -> None:
        self.sessions: dict[str, dict[str, Any]] = {}
        self.recommendations: dict[str, dict[str, Any]] = {}
        self.strategy_options: dict[str, dict[str, Any]] = {}
        self.paper_results: dict[str, dict[str, Any]] = {}
        self.approvals: list[dict[str, Any]] = []
        self.audits: list[dict[str, Any]] = []
        self.external: dict[str, dict[str, Any]] = {}
        self.live_requests: dict[str, dict[str, Any]] = {}
        self.inbox: set[str] = set()
        self.strategy_configs: dict[str, dict[str, Any]] = {}

    def seen_event(self, idempotency_key: str) -> bool:
        if idempotency_key in self.inbox:
            return True
        self.inbox.add(idempotency_key)
        return False

    def get_daily_session(self, tenant_id: str, user_id: str, day: date) -> dict[str, Any] | None:
        for s in self.sessions.values():
            if s["tenant_id"] == tenant_id and s["user_id"] == user_id and s["advisory_date"] == day.isoformat():
                return s
        return None

    def upsert_session(self, data: dict[str, Any]) -> dict[str, Any]:
        sid = data.get("id") or str(uuid4())
        data["id"] = sid
        self.sessions[sid] = data
        return data

    def add_recommendation(self, data: dict[str, Any]) -> dict[str, Any]:
        rid = data.get("id") or str(uuid4())
        data["id"] = rid
        self.recommendations[rid] = data
        return data

    def list_recommendations(self, session_id: str) -> list[dict[str, Any]]:
        return [r for r in self.recommendations.values() if r["advisory_session_id"] == session_id]

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        return self.sessions.get(session_id)

    def latest_session(self, tenant_id: str, user_id: str) -> dict[str, Any] | None:
        items = [
            s
            for s in self.sessions.values()
            if s["tenant_id"] == tenant_id and s["user_id"] == user_id
        ]
        if not items:
            return None
        return sorted(items, key=lambda x: x.get("created_at") or "", reverse=True)[0]

    def add_strategy_option(self, data: dict[str, Any]) -> dict[str, Any]:
        oid = data.get("id") or str(uuid4())
        data["id"] = oid
        data.setdefault("version", 1)
        self.strategy_options[oid] = data
        return data

    def get_strategy_option(self, option_id: str) -> dict[str, Any] | None:
        return self.strategy_options.get(option_id)

    def update_strategy_option(self, option_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        cur = self.strategy_options[option_id]
        cur.update(patch)
        cur["version"] = int(cur.get("version") or 1) + 1
        cur["updated_at"] = datetime.now(timezone.utc).isoformat()
        return cur

    def audit(self, event: dict[str, Any]) -> dict[str, Any]:
        event = {**event, "id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
        # Never persist secrets
        details = event.get("details") or {}
        for k in list(details.keys()):
            if any(x in k.lower() for x in ("token", "secret", "password", "credential")):
                details[k] = "[REDACTED]"
        event["details"] = details
        self.audits.append(event)
        return event


STORE = InMemoryAdvisoryStore()


def get_store() -> InMemoryAdvisoryStore:
    return STORE


def reset_store() -> InMemoryAdvisoryStore:
    global STORE
    STORE = InMemoryAdvisoryStore()
    return STORE
