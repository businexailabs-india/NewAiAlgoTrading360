from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth
from advisory_core.settings import AdvisorySettings
from app.engine import PaperTestOrchestrator

settings = AdvisorySettings()
app = FastAPI(title="Paper Test Orchestrator", version="0.1.0")
orch = PaperTestOrchestrator()
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
    return {"status": "ok", "service": "paper-test-orchestrator"}


class PaperTestBody(BaseModel):
    strategy_option: dict[str, Any]
    account_id: str | None = None
    initial_capital: float | None = None


@app.post("/strategy-options/{option_id}/paper-test")
async def paper_test(option_id: str, body: PaperTestBody, identity=Depends(require_service)):
    option = {**body.strategy_option, "id": option_id}
    result = await orch.run(option, str(identity.user_id), body.account_id, body.initial_capital)
    return {"success": True, "data": result}


@app.get("/paper-tests/{result_id}")
async def get_result(result_id: str, identity=Depends(require_service)):
    r = orch.results.get(result_id)
    if not r:
        raise HTTPException(404, "Not found")
    return {"success": True, "data": r}
