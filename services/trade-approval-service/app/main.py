"""Trade approval service — user confirm → RMS → OMS gate (no direct broker)."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth, redact_secrets

app = FastAPI(title="Trade Approval Service", version="0.1.0")
auth = ServiceAuth(os.getenv("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me"))

_APPROVALS: dict[str, dict[str, Any]] = {}
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


class CreateApprovalBody(BaseModel):
    conversation_id: str | None = None
    strategy_id: str | None = None
    order_preview: dict[str, Any]
    risk_summary: dict[str, Any] = Field(default_factory=dict)
    margin_estimate: dict[str, Any] = Field(default_factory=dict)
    approval_language: str = "en"
    approval_text: str = "Please review and approve. Trading involves risk."
    ip_address: str | None = None
    device_id: str | None = None


class DecisionBody(BaseModel):
    explicit_confirmation: bool = False
    otp_or_biometric_ok: bool = False
    rms_approved: bool = False
    live_env_enabled: bool = False
    kill_switch: bool = False


@app.get("/health")
async def health():
    return {"status": "ok", "service": "trade-approval-service"}


@app.post("/approvals/trade")
async def create_trade_approval(body: CreateApprovalBody, identity=Depends(require_service)):
    aid = str(uuid4())
    row = {
        "id": aid,
        "tenant_id": str(identity.tenant_id),
        "user_id": str(identity.user_id),
        "conversation_id": body.conversation_id,
        "strategy_id": body.strategy_id,
        "order_preview_json": redact_secrets(body.order_preview),
        "risk_summary_json": body.risk_summary,
        "margin_estimate_json": body.margin_estimate,
        "approval_status": "pending",
        "approval_language": body.approval_language,
        "approval_text": body.approval_text,
        "approved_at": None,
        "rejected_at": None,
        "ip_address": body.ip_address,
        "device_id": body.device_id,
        "rms_status": "not_submitted",
        "oms_status": "not_submitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _APPROVALS[aid] = row
    _AUDITS.append({"action": "trade_approval_requested", "approval_id": aid})
    return {"success": True, "data": row}


@app.get("/approvals/{approval_id}")
async def get_approval(approval_id: str, identity=Depends(require_service)):
    row = _APPROVALS.get(approval_id)
    if not row or row["tenant_id"] != str(identity.tenant_id) or row["user_id"] != str(identity.user_id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True, "data": row}


@app.post("/approvals/{approval_id}/approve")
async def approve(approval_id: str, body: DecisionBody, identity=Depends(require_service)):
    row = _APPROVALS.get(approval_id)
    if not row or row["tenant_id"] != str(identity.tenant_id) or row["user_id"] != str(identity.user_id):
        raise HTTPException(status_code=404, detail="Not found")
    if body.kill_switch:
        row["approval_status"] = "blocked"
        row["oms_status"] = "blocked"
        _AUDITS.append({"action": "blocked_kill_switch", "approval_id": approval_id})
        return {"success": True, "data": {**row, "status": "blocked", "block_reasons": ["kill_switch"]}}
    if not body.explicit_confirmation:
        return {"success": True, "data": {**row, "status": "blocked", "block_reasons": ["explicit_confirmation_required"]}}
    if not body.otp_or_biometric_ok:
        return {"success": True, "data": {**row, "status": "blocked", "block_reasons": ["otp_or_biometric_required"]}}

    row["approval_status"] = "user_approved"
    row["approved_at"] = datetime.now(timezone.utc).isoformat()
    _AUDITS.append({"action": "approval_accepted", "approval_id": approval_id})

    if not body.rms_approved:
        row["rms_status"] = "rejected"
        row["oms_status"] = "blocked"
        _AUDITS.append({"action": "rms_rejected_blocks_oms", "approval_id": approval_id})
        return {
            "success": True,
            "data": {**row, "status": "blocked", "block_reasons": ["rms_rejection_blocks_oms"]},
        }

    if not body.live_env_enabled:
        row["rms_status"] = "approved"
        row["oms_status"] = "blocked"
        return {
            "success": True,
            "data": {**row, "status": "blocked", "block_reasons": ["live_trading_disabled"]},
        }

    row["rms_status"] = "approved"
    row["oms_status"] = "created"
    row["approval_status"] = "oms_created"
    _AUDITS.append({"action": "oms_created", "approval_id": approval_id})
    return {"success": True, "data": {**row, "status": "approved_oms_created"}}


@app.post("/approvals/{approval_id}/reject")
async def reject(approval_id: str, identity=Depends(require_service)):
    row = _APPROVALS.get(approval_id)
    if not row or row["tenant_id"] != str(identity.tenant_id) or row["user_id"] != str(identity.user_id):
        raise HTTPException(status_code=404, detail="Not found")
    row["approval_status"] = "rejected"
    row["rejected_at"] = datetime.now(timezone.utc).isoformat()
    _AUDITS.append({"action": "approval_rejected", "approval_id": approval_id})
    return {"success": True, "data": row}


@app.post("/approvals/{approval_id}/modify")
async def modify(approval_id: str, body: CreateApprovalBody, identity=Depends(require_service)):
    row = _APPROVALS.get(approval_id)
    if not row or row["tenant_id"] != str(identity.tenant_id) or row["user_id"] != str(identity.user_id):
        raise HTTPException(status_code=404, detail="Not found")
    row["order_preview_json"] = redact_secrets(body.order_preview)
    row["risk_summary_json"] = body.risk_summary
    row["margin_estimate_json"] = body.margin_estimate
    row["approval_status"] = "modified_pending"
    _AUDITS.append({"action": "approval_modified", "approval_id": approval_id})
    return {"success": True, "data": row}
