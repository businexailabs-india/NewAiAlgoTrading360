from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth, mask_account
from advisory_core.settings import AdvisorySettings
from mcp_connectors import get_connector, list_connectors

settings = AdvisorySettings()
app = FastAPI(title="MCP Connector Service", version="0.1.0")
auth = ServiceAuth(settings.service_hmac_secret)
_sessions: dict[str, Any] = {}


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
    return {"status": "ok", "service": "mcp-connector-service"}


@app.get("/mcp/connectors")
async def connectors(identity=Depends(require_service)):
    return {
        "success": True,
        "data": [{"name": n, "live_execution_from_advisory": False} for n in list_connectors()],
    }


@app.post("/mcp/connectors/{connector}/connect")
async def connect(connector: str, identity=Depends(require_service)):
    conn = get_connector(connector, configured=connector in ("paper", "mock"))
    result = await conn.connect()
    _sessions[f"{identity.user_id}:{connector}"] = conn
    return {"success": True, "data": result}


@app.get("/mcp/connectors/{connector}/health")
async def connector_health(connector: str, identity=Depends(require_service)):
    conn = _sessions.get(f"{identity.user_id}:{connector}") or get_connector(
        connector, configured=connector in ("paper", "mock")
    )
    return {"success": True, "data": await conn.health_check()}


@app.get("/mcp/connectors/{connector}/capabilities")
async def capabilities(connector: str, identity=Depends(require_service)):
    conn = get_connector(connector, configured=connector in ("paper", "mock", "dhan"))
    caps = await conn.get_broker_capabilities()
    return {"success": True, "data": caps.model_dump()}


@app.get("/mcp/accounts")
async def accounts(identity=Depends(require_service)):
    # Snapshot list — real accounts come from gateway context aggregation
    return {
        "success": True,
        "data": [
            {"id": "paper", "broker": "paper", "masked_client_id": "PAPER****", "status": "connected"},
            {"id": "mock", "broker": "mock", "masked_client_id": mask_account("1112656215"), "status": "connected"},
        ],
    }


@app.get("/mcp/accounts/{account_id}/snapshot")
async def account_snapshot(account_id: str, identity=Depends(require_service)):
    conn = get_connector(account_id if account_id in ("paper", "mock") else "paper")
    await conn.connect()
    profile = await conn.get_account_profile()
    if profile.get("masked_client_id"):
        profile["masked_client_id"] = mask_account(str(profile["masked_client_id"]).replace("*", "1")[-4:].rjust(8, "x"))
    return {
        "success": True,
        "data": {
            "account_id": account_id,
            "profile": profile,
            "margins": await conn.get_margins(),
            "holdings": await conn.get_holdings(),
            "positions": await conn.get_positions(),
            "market_status": await conn.get_market_status(),
            "capabilities": (await conn.get_broker_capabilities()).model_dump(),
            "order_execution_from_advisory": False,
        },
    }


class PreviewBody(BaseModel):
    order: dict[str, Any] = Field(default_factory=dict)


@app.post("/mcp/connectors/{connector}/order-preview")
async def order_preview(connector: str, body: PreviewBody, identity=Depends(require_service)):
    conn = get_connector(connector, configured=True)
    return {"success": True, "data": await conn.place_order_preview(body.order)}


@app.post("/mcp/connectors/{connector}/execute")
async def execute_blocked(connector: str, body: PreviewBody, identity=Depends(require_service)):
    conn = get_connector(connector, configured=True)
    try:
        await conn.execute_order_disabled_by_default(body.order)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
