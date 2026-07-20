"""Dhan credential schema — never log or return raw secrets."""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, Field

from mcp_connectors.base.secrets import mask_credential, validate_credentials_schema

DHAN_CREDENTIAL_SCHEMA: dict[str, Any] = {
    "provider_id": "dhan",
    "auth_type": ["access_token", "client_id"],
    "required": ["client_id", "access_token"],
    "optional": ["api_key"],
    "env_mapping": {
        "client_id": "DHAN_CLIENT_ID",
        "access_token": "DHAN_ACCESS_TOKEN",
        "api_key": "DHAN_API_KEY",
    },
    "notes": "access_token is short-lived; rotate via Dhan renew-token. Never send to LLMs.",
}


class DhanCredentials(BaseModel):
    client_id: str = Field(min_length=1)
    access_token: str = Field(min_length=1)
    api_key: str | None = None

    def masked(self) -> dict[str, str]:
        out = {
            "client_id": mask_credential(self.client_id),
            "access_token": mask_credential(self.access_token),
        }
        if self.api_key:
            out["api_key"] = mask_credential(self.api_key)
        return out


def dhan_credentials_schema() -> dict[str, Any]:
    return dict(DHAN_CREDENTIAL_SCHEMA)


def validate_dhan_credentials(credentials: dict[str, Any]) -> dict[str, Any]:
    missing = validate_credentials_schema(DHAN_CREDENTIAL_SCHEMA["required"], credentials)
    return {
        "ok": len(missing) == 0,
        "provider_id": "dhan",
        "missing": missing,
        "required": list(DHAN_CREDENTIAL_SCHEMA["required"]),
        "optional": list(DHAN_CREDENTIAL_SCHEMA["optional"]),
        "masked_preview": {
            k: mask_credential(str(v)) for k, v in credentials.items() if v and k in ("client_id", "access_token", "api_key")
        },
    }


def load_dhan_credentials_from_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for field, env_key in DHAN_CREDENTIAL_SCHEMA["env_mapping"].items():
        val = os.getenv(env_key, "").strip()
        if val:
            out[field] = val
    return out


def dhan_env_credentials_configured() -> bool:
    creds = load_dhan_credentials_from_env()
    return bool(creds.get("client_id") and creds.get("access_token"))
