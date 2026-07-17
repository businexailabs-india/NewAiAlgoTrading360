from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth
from advisory_core.settings import AdvisorySettings
from app.discovery import ExternalAlgoDiscoveryService

settings = AdvisorySettings()
app = FastAPI(title="External Algo Discovery Service", version="0.1.0")
svc = ExternalAlgoDiscoveryService()
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
        raise HTTPException(401, str(exc)) from exc


@app.get("/health")
async def health():
    return {"status": "ok", "service": "external-algo-discovery-service"}


@app.get("/external-algos/sources")
async def sources(identity=Depends(require_service)):
    return {"success": True, "data": svc.discover_sources()}


@app.post("/external-algos/discover")
async def discover(identity=Depends(require_service)):
    data = svc.fetch_public_strategies(str(identity.tenant_id), str(identity.user_id))
    return {"success": True, "data": data}


@app.get("/external-algos/candidates")
async def candidates(identity=Depends(require_service)):
    items = [
        c
        for c in svc.candidates.values()
        if c.get("tenant_id") in (None, str(identity.tenant_id))
    ]
    return {"success": True, "data": svc.rank_candidates()}


@app.get("/external-algos/candidates/{candidate_id}")
async def get_candidate(candidate_id: str, identity=Depends(require_service)):
    c = svc.candidates.get(candidate_id)
    if not c:
        raise HTTPException(404, "Not found")
    return {"success": True, "data": c}


@app.post("/external-algos/candidates/{candidate_id}/normalize")
async def normalize(candidate_id: str, identity=Depends(require_service)):
    try:
        return {"success": True, "data": svc.normalize_strategy(candidate_id)}
    except (KeyError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/external-algos/candidates/{candidate_id}/risk-scan")
async def risk_scan(candidate_id: str, identity=Depends(require_service)):
    try:
        return {"success": True, "data": svc.risk_scan_strategy(candidate_id)}
    except (KeyError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc


class UploadBody(BaseModel):
    strategy: dict[str, Any]


@app.post("/external-algos/upload")
async def upload(body: UploadBody, identity=Depends(require_service)):
    try:
        data = svc.ingest_upload(body.model_dump(), str(identity.tenant_id), str(identity.user_id))
        return {"success": True, "data": data}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/external-algos/candidates/{candidate_id}/save-as-strategy")
async def save_as_strategy(candidate_id: str, identity=Depends(require_service)):
    c = svc.candidates.get(candidate_id)
    if not c:
        raise HTTPException(404, "Not found")
    if c.get("verification_status") != "paper_test_ready":
        raise HTTPException(400, "Candidate must be paper_test_ready")
    # Return strategy option seed — gateway/advisory persists
    return {
        "success": True,
        "data": {
            "strategy_name": c["title"],
            "strategy_type": (c.get("normalized_strategy_json") or {}).get("strategy_type"),
            "source_type": "third_party_strategy_candidate",
            "source_name": c["source_name"],
            "source_license_status": c["license_status"],
            "paper_test_required": True,
            "live_enabled": False,
            "normalized": c.get("normalized_strategy_json"),
            "warnings": c.get("risk_warnings"),
        },
    }


@app.get("/external-algos/candidates/{candidate_id}/live-eligibility")
async def live_eligibility(candidate_id: str, identity=Depends(require_service)):
    ok, blocks = svc.can_request_live(candidate_id)
    return {"success": True, "data": {"allowed": ok, "block_reasons": blocks}}
