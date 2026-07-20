"""OMS execution service — gated live path only."""

from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth, redact_secrets
from live_risk_gate import LiveRiskControls, evaluate_live_order

from app.settings import OMSSettings

settings = OMSSettings()
app = FastAPI(title="OMS Execution Service", version="0.1.0")
auth = ServiceAuth(os.getenv("SERVICE_HMAC_SECRET", settings.service_hmac_secret))

_KILL_SWITCH = bool(settings.kill_switch)
_AUDITS: list[dict[str, Any]] = []


def require_service(
    x_tenant_id: str = Header(alias="X-Tenant-Id"),
    x_user_id: str = Header(alias="X-User-Id"),
    x_user_role: str = Header(default="user", alias="X-User-Role"),
    x_request_id: str = Header(alias="X-Request-Id"),
    x_service_timestamp: str = Header(alias="X-Service-Timestamp"),
    x_service_signature: str = Header(alias="X-Service-Signature"),
):
    try:
        return auth.verify(
            {
                "X-Tenant-Id": x_tenant_id,
                "X-User-Id": x_user_id,
                "X-User-Role": x_user_role,
                "X-Request-Id": x_request_id,
                "X-Service-Timestamp": x_service_timestamp,
                "X-Service-Signature": x_service_signature,
            }
        )
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


class ExecuteBody(BaseModel):
    connection_id: str
    order: dict[str, Any]
    user_approval_id: str
    rms_approval_id: str | None = None
    account: dict[str, Any] = Field(default_factory=dict)
    run_rms: bool = True


class KillSwitchBody(BaseModel):
    active: bool = True


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "oms-execution-service",
        "live_trading_enabled": settings.live_trading_enabled,
        "kill_switch": _KILL_SWITCH,
    }


@app.post("/oms/kill-switch")
async def kill_switch(body: KillSwitchBody, identity=Depends(require_service)):
    global _KILL_SWITCH
    if identity.role not in ("admin", "oms_service"):
        raise HTTPException(403, "admin or oms_service required")
    _KILL_SWITCH = bool(body.active)
    _AUDITS.append(
        {
            "action": "kill_switch_set",
            "active": _KILL_SWITCH,
            "tenant_id": str(identity.tenant_id),
            "user_id": str(identity.user_id),
        }
    )
    return {"success": True, "data": {"kill_switch": _KILL_SWITCH}}


@app.post("/oms/execute")
async def execute(body: ExecuteBody, identity=Depends(require_service)):
    """Validate approvals + RMS, then call MCP as oms_service."""
    live_env = os.getenv("LIVE_TRADING_ENABLED", str(settings.live_trading_enabled)).lower() in (
        "1",
        "true",
        "yes",
    )
    if not live_env:
        raise HTTPException(403, "LIVE_TRADING_ENABLED=false")
    if _KILL_SWITCH:
        raise HTTPException(403, "kill_switch_active")
    if not body.user_approval_id:
        raise HTTPException(400, "user_approval_id required")

    rms_id = body.rms_approval_id
    if body.run_rms or not rms_id:
        decision = evaluate_live_order(
            body.order,
            account=body.account,
            controls=LiveRiskControls(kill_switch=_KILL_SWITCH),
        )
        if not decision.allowed:
            _AUDITS.append(
                {
                    "action": "rms_rejected",
                    "reasons": decision.reasons,
                    "tenant_id": str(identity.tenant_id),
                }
            )
            raise HTTPException(403, detail={"status": "rms_blocked", "reasons": decision.reasons})
        rms_id = decision.rms_approval_id

    order_payload = {
        **body.order,
        "approval_id": body.user_approval_id,
        "user_approval_id": body.user_approval_id,
        "rms_approval_id": rms_id,
    }
    headers = auth.sign(
        str(identity.tenant_id),
        str(identity.user_id),
        "oms_service",
        str(uuid4()),
    )
    url = f"{settings.mcp_connector_url.rstrip('/')}/mcp/connections/{body.connection_id}/orders/execute-disabled"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json={"order": order_payload})
    _AUDITS.append(
        {
            "action": "oms_execute_attempt",
            "connection_id": body.connection_id,
            "status_code": resp.status_code,
            "tenant_id": str(identity.tenant_id),
        }
    )
    if resp.status_code >= 400:
        detail = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
        raise HTTPException(resp.status_code, detail=redact_secrets({"mcp": detail}))
    data = resp.json().get("data") if resp.headers.get("content-type", "").startswith("application/json") else resp.json()
    return {"success": True, "data": redact_secrets(data or {})}


@app.get("/oms/audit")
async def audit(identity=Depends(require_service)):
    if identity.role not in ("admin", "oms_service"):
        raise HTTPException(403, "admin or oms_service required")
    return {"success": True, "data": _AUDITS[-200:]}
