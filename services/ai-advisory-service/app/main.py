"""FastAPI internal API for AI advisory workflows."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth
from advisory_core.settings import AdvisorySettings
from advisory_core.telemetry import configure_logging, start_metrics_server
from app.service import AIAdvisoryService
from app.store import get_store

settings = AdvisorySettings()
configure_logging(settings.otel_service_name)
app = FastAPI(title="AI Advisory Service", version="0.1.0")
svc = AIAdvisoryService(kafka_bootstrap=settings.kafka_bootstrap_servers or "memory://")
auth = ServiceAuth(settings.service_hmac_secret)


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


@app.on_event("startup")
async def startup() -> None:
    if settings.prometheus_enabled:
        start_metrics_server(9101)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-advisory-service"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}


class GenerateBody(BaseModel):
    context: dict[str, Any] = Field(default_factory=dict)


@app.post("/advisory/generate")
async def generate_advisory(body: GenerateBody, identity=Depends(require_service)):
    data = await svc.generate_login_advisory(
        str(identity.user_id), str(identity.tenant_id), body.context
    )
    return {"success": True, "data": data}


@app.get("/advisory/latest")
async def latest_advisory(identity=Depends(require_service)):
    session = get_store().latest_session(str(identity.tenant_id), str(identity.user_id))
    if not session:
        return {
            "success": True,
            "data": {
                "advisory_id": None,
                "status": "preparing",
                "summary": "AI advisory is being prepared",
                "recommendations": [],
            },
        }
    if session.get("status") == "preparing":
        return {
            "success": True,
            "data": {
                "advisory_id": session["id"],
                "status": "preparing",
                "summary": "AI advisory is being prepared",
                "recommendations": [],
            },
        }
    return {"success": True, "data": svc.to_login_response(session)}


@app.get("/advisory/{advisory_id}")
async def get_advisory(advisory_id: str, identity=Depends(require_service)):
    session = get_store().get_session(advisory_id)
    if not session or session["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Advisory not found")
    return {"success": True, "data": svc.to_login_response(session)}


@app.get("/advisory/{advisory_id}/recommendations")
async def list_recs(advisory_id: str, identity=Depends(require_service)):
    session = get_store().get_session(advisory_id)
    if not session or session["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Advisory not found")
    return {"success": True, "data": get_store().list_recommendations(advisory_id)}


@app.post("/advisory/{advisory_id}/recommendations/{recommendation_id}/convert-to-algo")
async def convert(advisory_id: str, recommendation_id: str, identity=Depends(require_service)):
    try:
        option = await svc.convert_to_algo(
            str(identity.tenant_id), str(identity.user_id), advisory_id, recommendation_id
        )
    except (PermissionError, KeyError) as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"success": True, "data": option}


@app.post("/advisory/{advisory_id}/dismiss")
async def dismiss(advisory_id: str, identity=Depends(require_service)):
    session = get_store().get_session(advisory_id)
    if not session or session["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Advisory not found")
    session["status"] = "dismissed"
    get_store().upsert_session(session)
    get_store().audit(
        {
            "tenant_id": str(identity.tenant_id),
            "user_id": str(identity.user_id),
            "action": "advisory_dismissed",
            "resource": f"advisory_session:{advisory_id}",
            "details": {},
            "request_id": identity.request_id,
        }
    )
    return {"success": True, "data": {"advisory_id": advisory_id, "status": "dismissed"}}


@app.post("/advisory/{advisory_id}/refresh")
async def refresh(advisory_id: str, body: GenerateBody, identity=Depends(require_service)):
    data = await svc.generate_login_advisory(
        str(identity.user_id), str(identity.tenant_id), body.context
    )
    return {"success": True, "data": data}


@app.get("/strategy-options")
async def list_options(identity=Depends(require_service)):
    items = [
        o
        for o in get_store().strategy_options.values()
        if o["tenant_id"] == str(identity.tenant_id) and o["user_id"] == str(identity.user_id)
    ]
    return {"success": True, "data": items}


@app.get("/strategy-options/{option_id}")
async def get_option(option_id: str, identity=Depends(require_service)):
    o = get_store().get_strategy_option(option_id)
    if not o or o["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Not found")
    return {"success": True, "data": o}


class UpdateOptionBody(BaseModel):
    entry_rules_json: list[dict[str, Any]] | None = None
    exit_rules_json: list[dict[str, Any]] | None = None
    risk_rules_json: list[dict[str, Any]] | None = None
    position_sizing_json: dict[str, Any] | None = None
    strategy_name: str | None = None


@app.put("/strategy-options/{option_id}")
async def update_option(option_id: str, body: UpdateOptionBody, identity=Depends(require_service)):
    o = get_store().get_strategy_option(option_id)
    if not o or o["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Not found")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = get_store().update_strategy_option(option_id, patch)
    return {"success": True, "data": updated}


@app.post("/strategy-options/{option_id}/save")
async def save_option(option_id: str, identity=Depends(require_service)):
    o = get_store().get_strategy_option(option_id)
    if not o or o["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Not found")
    updated = get_store().update_strategy_option(option_id, {"saved": True, "validation_status": "saved"})
    get_store().audit(
        {
            "tenant_id": str(identity.tenant_id),
            "user_id": str(identity.user_id),
            "action": "strategy_saved",
            "resource": f"strategy_option:{option_id}",
            "details": {},
        }
    )
    return {"success": True, "data": updated}


@app.post("/strategy-options/{option_id}/deploy-paper")
async def deploy_paper(option_id: str, identity=Depends(require_service)):
    o = get_store().get_strategy_option(option_id)
    if not o or o["tenant_id"] != str(identity.tenant_id):
        raise HTTPException(404, "Not found")
    if not o.get("saved"):
        raise HTTPException(400, "Save strategy before paper deploy")
    results = [r for r in get_store().paper_results.values() if r["strategy_option_id"] == option_id]
    if not results:
        raise HTTPException(400, "Run paper test before paper deploy")
    updated = get_store().update_strategy_option(option_id, {"paper_deployed": True})
    get_store().approvals.append(
        {
            "strategy_option_id": option_id,
            "user_id": str(identity.user_id),
            "approval_type": "paper_deploy",
            "risk_disclosure_accepted": True,
            "approval_text": "Deployed to paper trading bot",
        }
    )
    return {"success": True, "data": updated}


class LiveApprovalBody(BaseModel):
    risk_disclosure_accepted: bool = False
    explicit_confirmation: bool = False
    paper_qualified: bool = False
    kill_switch: bool = False
    live_env_enabled: bool = False
    admin_approved: bool = False


@app.post("/strategy-options/{option_id}/request-live-approval")
async def request_live(option_id: str, body: LiveApprovalBody, request: Request, identity=Depends(require_service)):
    req = svc.request_live_approval(
        str(identity.tenant_id),
        str(identity.user_id),
        option_id,
        risk_disclosure_accepted=body.risk_disclosure_accepted,
        explicit_confirmation=body.explicit_confirmation,
        ip_address=request.client.host if request.client else None,
        paper_qualified=body.paper_qualified,
        kill_switch=body.kill_switch,
        live_env_enabled=body.live_env_enabled,
        admin_approved=body.admin_approved,
    )
    return {"success": True, "data": req}


# Internal login event hook for gateway/tests
class LoginEventBody(BaseModel):
    tenant_id: str
    user_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None


@app.post("/internal/events/user.login.success")
async def login_event(body: LoginEventBody):
    from advisory_core.events import EventEnvelope, KafkaTopics

    event = EventEnvelope.create(
        KafkaTopics.USER_LOGIN_SUCCESS,
        body.tenant_id,
        body.user_id,
        body.payload,
        idempotency_key=body.idempotency_key or f"login:{body.user_id}:{uuid4()}",
    )
    data = await svc.handle_login_event(event)
    return {"success": True, "data": data if "status" in (data or {}) else svc.to_login_response(data)}
