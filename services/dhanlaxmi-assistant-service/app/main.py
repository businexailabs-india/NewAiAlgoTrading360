"""DhanLaxmi Assistant FastAPI service."""

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth
from app.service import DhanLaxmiService
from app.store import get_store

app = FastAPI(title="DhanLaxmi Assistant", version="0.1.0")
svc = DhanLaxmiService()
auth = ServiceAuth(os.getenv("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me"))


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


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    language_hint: str | None = None
    mode: str = "web"
    context: dict[str, Any] = Field(default_factory=dict)
    voice: bool = False


class IntentBody(BaseModel):
    message: str


class StrategyDraftBody(BaseModel):
    message: str
    conversation_id: str | None = None
    language_hint: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class PaperTestBody(BaseModel):
    strategy_draft_id: str
    conversation_id: str | None = None


class TradeApprovalBody(BaseModel):
    message: str | None = None
    conversation_id: str | None = None
    order_preview: dict[str, Any] = Field(default_factory=dict)
    language: str = "en"


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "dhanlaxmi-assistant-service"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/dhanlaxmi/chat")
async def chat(body: ChatBody, identity=Depends(require_service)):
    data = await svc.chat(
        str(identity.tenant_id),
        str(identity.user_id),
        body.message,
        conversation_id=body.conversation_id,
        language_hint=body.language_hint,
        mode=body.mode,
        context=body.context,
        voice=body.voice,
    )
    return {"success": True, "data": data}


@app.post("/dhanlaxmi/intent")
async def intent(body: IntentBody, identity=Depends(require_service)):
    from intent_core import IntentClassifier
    from language_core import LanguageDetector

    det = LanguageDetector().detect(body.message)
    intent_res = IntentClassifier().classify(body.message)
    return {
        "success": True,
        "data": {
            "language": det.model_dump(),
            "intent": intent_res.model_dump(),
            "tenant_id": str(identity.tenant_id),
        },
    }


@app.post("/dhanlaxmi/strategy-draft")
async def strategy_draft(body: StrategyDraftBody, identity=Depends(require_service)):
    data = await svc.chat(
        str(identity.tenant_id),
        str(identity.user_id),
        body.message,
        conversation_id=body.conversation_id,
        language_hint=body.language_hint,
        mode="strategy_builder",
        context=body.context,
    )
    return {"success": True, "data": data}


@app.post("/dhanlaxmi/advisory")
async def advisory(body: ChatBody, identity=Depends(require_service)):
    data = await svc.chat(
        str(identity.tenant_id),
        str(identity.user_id),
        body.message,
        conversation_id=body.conversation_id,
        language_hint=body.language_hint,
        mode="advisory_popup",
        context=body.context,
    )
    return {"success": True, "data": data}


@app.post("/dhanlaxmi/paper-test")
async def paper_test(body: PaperTestBody, identity=Depends(require_service)):
    store = get_store()
    draft = store.strategy_drafts.get(body.strategy_draft_id)
    if not draft or draft.get("tenant_id") != str(identity.tenant_id):
        raise HTTPException(status_code=404, detail="Strategy draft not found")
    result = {
        "strategy_draft_id": body.strategy_draft_id,
        "status": "completed",
        "paper_only": True,
        "metrics": {
            "pnl": 0.0,
            "max_drawdown": 0.0,
            "trade_count": 0,
            "qualified_for_live": False,
        },
        "explanation": "Paper test recorded. Live remains blocked until qualification and approval.",
        "disclaimer": "Paper results are simulated and not a guarantee of future performance.",
    }
    store.audit(
        {
            "tenant_id": str(identity.tenant_id),
            "user_id": str(identity.user_id),
            "action": "paper_test_requested",
            "resource": body.strategy_draft_id,
        }
    )
    return {"success": True, "data": result}


@app.post("/dhanlaxmi/trade-approval")
async def trade_approval(body: TradeApprovalBody, identity=Depends(require_service)):
    convo_id = body.conversation_id
    if not convo_id:
        convo = svc.store.create_conversation(
            str(identity.tenant_id), str(identity.user_id), body.language, "approval"
        )
        convo_id = convo["id"]
    approval = svc.create_trade_approval(
        str(identity.tenant_id),
        str(identity.user_id),
        convo_id,
        body.language,
        body.order_preview or {"symbol": "UNKNOWN", "side": "BUY", "quantity": 0},
        {"warnings": ["Explicit approval required"]},
    )
    return {"success": True, "data": approval}


@app.get("/dhanlaxmi/conversation/{conversation_id}")
async def get_conversation(conversation_id: str, identity=Depends(require_service)):
    data = svc.store.get_conversation(
        conversation_id, str(identity.tenant_id), str(identity.user_id)
    )
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True, "data": data}


# Internal approval helpers used by trade-approval-service / gateway
class ApproveBody(BaseModel):
    otp_or_biometric_ok: bool = False
    explicit_confirmation: bool = False
    rms_approved: bool = False
    live_env_enabled: bool = False


@app.post("/approvals/{approval_id}/approve")
async def approve(approval_id: str, body: ApproveBody, identity=Depends(require_service)):
    data = svc.approve(
        str(identity.tenant_id),
        str(identity.user_id),
        approval_id,
        otp_or_biometric_ok=body.otp_or_biometric_ok,
        explicit_confirmation=body.explicit_confirmation,
        rms_approved=body.rms_approved,
        live_env_enabled=body.live_env_enabled,
    )
    return {"success": True, "data": data}


@app.post("/approvals/{approval_id}/reject")
async def reject(approval_id: str, identity=Depends(require_service)):
    data = svc.reject(str(identity.tenant_id), str(identity.user_id), approval_id)
    return {"success": True, "data": data}


@app.get("/approvals/{approval_id}")
async def get_approval(approval_id: str, identity=Depends(require_service)):
    data = svc.store.get_approval(approval_id, str(identity.tenant_id), str(identity.user_id))
    if not data:
        raise HTTPException(status_code=404, detail="Approval not found")
    return {"success": True, "data": data}


@app.post("/approvals/{approval_id}/modify")
async def modify_approval(approval_id: str, request: Request, identity=Depends(require_service)):
    body = await request.json()
    row = svc.store.get_approval(approval_id, str(identity.tenant_id), str(identity.user_id))
    if not row:
        raise HTTPException(status_code=404, detail="Approval not found")
    preview = {**(row.get("order_preview_json") or {}), **(body.get("order_preview") or {})}
    row["order_preview_json"] = preview
    row["approval_status"] = "modified_pending"
    svc.store.save_approval(row)
    return {"success": True, "data": row}
