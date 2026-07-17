"""In-memory store for DhanLaxmi conversations, messages, voice, approvals, audits."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from advisory_core.security import redact_secrets


class InMemoryDhanLaxmiStore:
    def __init__(self) -> None:
        self.conversations: dict[str, dict[str, Any]] = {}
        self.messages: dict[str, list[dict[str, Any]]] = {}
        self.voice_commands: list[dict[str, Any]] = []
        self.approvals: dict[str, dict[str, Any]] = {}
        self.strategy_drafts: dict[str, dict[str, Any]] = {}
        self.audits: list[dict[str, Any]] = []

    def audit(self, event: dict[str, Any]) -> None:
        self.audits.append(
            {
                **redact_secrets(event),
                "id": str(uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    def create_conversation(
        self, tenant_id: str, user_id: str, language: str, mode: str = "web"
    ) -> dict[str, Any]:
        cid = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": cid,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "language": language,
            "mode": mode,
            "started_at": now,
            "last_message_at": now,
            "status": "active",
        }
        self.conversations[cid] = row
        self.messages[cid] = []
        return row

    def get_conversation(self, conversation_id: str, tenant_id: str, user_id: str) -> dict[str, Any] | None:
        row = self.conversations.get(conversation_id)
        if not row:
            return None
        if row["tenant_id"] != tenant_id or row["user_id"] != user_id:
            return None
        return {**row, "messages": list(self.messages.get(conversation_id, []))}

    def add_message(self, conversation_id: str, message: dict[str, Any]) -> dict[str, Any]:
        msg = {"id": str(uuid4()), **message, "created_at": datetime.now(timezone.utc).isoformat()}
        self.messages.setdefault(conversation_id, []).append(msg)
        if conversation_id in self.conversations:
            self.conversations[conversation_id]["last_message_at"] = msg["created_at"]
        return msg

    def save_draft(self, draft: dict[str, Any]) -> dict[str, Any]:
        draft = {**draft, "id": draft.get("id") or str(uuid4())}
        self.strategy_drafts[draft["id"]] = draft
        return draft

    def save_approval(self, approval: dict[str, Any]) -> dict[str, Any]:
        approval = {**approval, "id": approval.get("id") or str(uuid4())}
        self.approvals[approval["id"]] = approval
        return approval

    def get_approval(self, approval_id: str, tenant_id: str, user_id: str) -> dict[str, Any] | None:
        row = self.approvals.get(approval_id)
        if not row:
            return None
        if row.get("tenant_id") != tenant_id or row.get("user_id") != user_id:
            return None
        return row


_STORE: InMemoryDhanLaxmiStore | None = None


def get_store() -> InMemoryDhanLaxmiStore:
    global _STORE
    if _STORE is None:
        _STORE = InMemoryDhanLaxmiStore()
    return _STORE


def reset_store() -> None:
    global _STORE
    _STORE = InMemoryDhanLaxmiStore()
