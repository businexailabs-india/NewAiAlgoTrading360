"""MCP Connector Service — Indian broker/data provider APIs for TradeOS360."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth, redact_secrets
from mcp_connectors.base.provider import LiveTradingBlockedError

from app.metrics import start_metrics
from app.service import MCPConnectorService
from app.settings import MCPConnectorSettings

settings = MCPConnectorSettings()
svc = MCPConnectorService(settings)
auth = ServiceAuth(settings.service_hmac_secret)
_monitor_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _monitor_task
    if settings.prometheus_enabled:
        start_metrics(9104)

    async def _loop():
        while True:
            try:
                await svc.run_health_monitor_once()
            except Exception:  # noqa: BLE001
                pass
            await asyncio.sleep(settings.health_check_interval_seconds)

    _monitor_task = asyncio.create_task(_loop())
    yield
    if _monitor_task:
        _monitor_task.cancel()


app = FastAPI(
    title="BusineXAi TradeOS360 MCP Connector Service",
    version="0.2.0",
    lifespan=lifespan,
)


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


def require_admin(identity=Depends(require_service)):
    if identity.role != "admin":
        raise HTTPException(403, "admin role required")
    return identity


# ---------------------------------------------------------------------------
# Health + legacy connector routes (advisory compatibility)
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "mcp-connector-service",
        "live_trading_enabled": False,
        "paper_trading_enabled": settings.paper_trading_enabled,
        "providers_loaded": len(svc.registry.list_providers()),
    }


@app.get("/mcp/connectors")
async def legacy_connectors(identity=Depends(require_service)):
    return {
        "success": True,
        "data": [
            {"name": p["provider_id"], "live_execution_from_advisory": False, **p}
            for p in svc.list_providers()
        ],
    }


# ---------------------------------------------------------------------------
# Provider Registry APIs
# ---------------------------------------------------------------------------


@app.get("/mcp/providers")
async def list_providers(country: str | None = Query(default=None), identity=Depends(require_service)):
    return {"success": True, "data": svc.list_providers(country=country)}


@app.get("/mcp/providers/{provider_id}")
async def get_provider(provider_id: str, identity=Depends(require_service)):
    rows = [p for p in svc.list_providers() if p["provider_id"] == provider_id]
    if not rows:
        raise HTTPException(404, "provider not found")
    return {"success": True, "data": rows[0]}


@app.get("/mcp/providers/{provider_id}/capabilities")
async def provider_capabilities(provider_id: str, identity=Depends(require_service)):
    return {"success": True, "data": svc.registry.get_provider_capabilities(provider_id)}


@app.get("/mcp/providers/{provider_id}/required-credentials")
async def required_credentials(provider_id: str, identity=Depends(require_service)):
    cfg = svc.registry._configs.get(provider_id)
    if not cfg:
        raise HTTPException(404, "provider not found")
    return {
        "success": True,
        "data": {
            "provider_id": provider_id,
            "credentials_required": cfg.credentials_required,
            "auth_type": cfg.auth_type,
        },
    }


class ValidateConfigBody(BaseModel):
    credentials: dict[str, Any] = Field(default_factory=dict)


@app.post("/mcp/providers/{provider_id}/validate-config")
async def validate_config(provider_id: str, body: ValidateConfigBody, identity=Depends(require_service)):
    cfg_result = svc.registry.validate_provider_config(provider_id)
    cred_result = svc.registry.validate_credentials_schema(provider_id, body.credentials)
    return {"success": True, "data": {"config": cfg_result, "credentials": cred_result}}


@app.post("/mcp/providers/reload")
async def reload_providers(identity=Depends(require_service)):
    if identity.role not in ("admin", "oms_service"):
        raise HTTPException(403, "admin or oms_service required")
    data = svc.reload_providers()
    return {"success": True, "data": {"count": len(data), "providers": data}}


# ---------------------------------------------------------------------------
# Connection APIs
# ---------------------------------------------------------------------------


class ConnectBody(BaseModel):
    provider_id: str
    credentials: dict[str, str] = Field(default_factory=dict)
    account_alias: str = ""
    config: dict[str, Any] = Field(default_factory=dict)


@app.post("/mcp/connections")
async def create_connection(body: ConnectBody, identity=Depends(require_service)):
    try:
        # Never log body.credentials
        data = await svc.create_connection(
            tenant_id=str(identity.tenant_id),
            user_id=str(identity.user_id),
            provider_id=body.provider_id,
            credentials=body.credentials,
            account_alias=body.account_alias,
            config=body.config,
        )
        return {"success": True, "data": redact_secrets(data)}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/mcp/connections")
async def list_connections(identity=Depends(require_service)):
    rows = svc.store.list_connections(str(identity.tenant_id), str(identity.user_id))
    return {"success": True, "data": [svc.store.public_connection(c) for c in rows]}


@app.get("/mcp/connections/{connection_id}")
async def get_connection(connection_id: str, identity=Depends(require_service)):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    return {"success": True, "data": svc.store.public_connection(conn)}


@app.delete("/mcp/connections/{connection_id}")
async def delete_connection(connection_id: str, identity=Depends(require_service)):
    ok = svc.store.delete_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not ok:
        raise HTTPException(404, "connection not found")
    return {"success": True, "data": {"deleted": True}}


@app.post("/mcp/connections/{connection_id}/test")
async def test_connection(connection_id: str, identity=Depends(require_service)):
    try:
        data = await svc.test_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/mcp/connections/{connection_id}/refresh-session")
async def refresh_session(connection_id: str, identity=Depends(require_service)):
    try:
        data = await svc.refresh_session(connection_id, str(identity.tenant_id), str(identity.user_id))
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/mcp/connections/{connection_id}/health")
async def connection_health(connection_id: str, identity=Depends(require_service)):
    try:
        data = await svc.test_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/mcp/connections/{connection_id}/capabilities")
async def connection_capabilities(connection_id: str, identity=Depends(require_service)):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    return {"success": True, "data": conn.capabilities_json}


# ---------------------------------------------------------------------------
# Account APIs
# ---------------------------------------------------------------------------


async def _account_field(connection_id: str, identity, field: str):
    try:
        snap = await svc.account_snapshot(connection_id, str(identity.tenant_id), str(identity.user_id))
        return {"success": True, "data": snap.get(field) if field != "snapshot" else snap}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/mcp/connections/{connection_id}/profile")
async def profile(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "profile_json")


@app.get("/mcp/connections/{connection_id}/margins")
async def margins(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "margins_json")


@app.get("/mcp/connections/{connection_id}/holdings")
async def holdings(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "holdings_json")


@app.get("/mcp/connections/{connection_id}/positions")
async def positions(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "positions_json")


@app.get("/mcp/connections/{connection_id}/orders")
async def orders(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "orders_json")


@app.get("/mcp/connections/{connection_id}/trades")
async def trades(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "trades_json")


@app.get("/mcp/connections/{connection_id}/snapshot")
async def snapshot(connection_id: str, identity=Depends(require_service)):
    return await _account_field(connection_id, identity, "snapshot")


# Legacy account routes
@app.get("/mcp/accounts")
async def legacy_accounts(identity=Depends(require_service)):
    rows = svc.store.list_connections(str(identity.tenant_id), str(identity.user_id))
    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "broker": c.provider_id,
                "masked_client_id": "****",
                "status": c.status,
            }
            for c in rows
        ]
        or [
            {"id": "paper", "broker": "paper_trading", "masked_client_id": "PAPER****", "status": "available"},
            {"id": "mock", "broker": "mock_trading", "masked_client_id": "****6215", "status": "available"},
        ],
    }


@app.get("/mcp/accounts/{account_id}/snapshot")
async def legacy_account_snapshot(account_id: str, identity=Depends(require_service)):
    # Prefer connection id; else create ephemeral paper/mock snapshot
    conn = svc.store.get_connection(account_id, str(identity.tenant_id), str(identity.user_id))
    if conn:
        return await _account_field(account_id, identity, "snapshot")
    provider_id = "paper_trading" if account_id in ("paper", "paper_trading") else "mock_trading"
    created = await svc.create_connection(
        tenant_id=str(identity.tenant_id),
        user_id=str(identity.user_id),
        provider_id=provider_id,
        credentials={},
        account_alias=account_id,
        config={"use_mock": True, "demo": True},
    )
    return await _account_field(created["connection"]["id"], identity, "snapshot")


# ---------------------------------------------------------------------------
# Market Data APIs
# ---------------------------------------------------------------------------


@app.get("/mcp/connections/{connection_id}/quote/{symbol}")
async def quote(connection_id: str, symbol: str, identity=Depends(require_service)):
    try:
        data = await svc.quotes(connection_id, str(identity.tenant_id), str(identity.user_id), [symbol])
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


class QuotesBody(BaseModel):
    symbols: list[str] = Field(default_factory=list)


@app.post("/mcp/connections/{connection_id}/quotes")
async def quotes(connection_id: str, body: QuotesBody, identity=Depends(require_service)):
    try:
        data = await svc.quotes(connection_id, str(identity.tenant_id), str(identity.user_id), body.symbols)
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/mcp/connections/{connection_id}/subscribe-ticks")
async def subscribe_ticks(connection_id: str, body: QuotesBody, identity=Depends(require_service)):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    provider = svc.store.provider_instances.get(connection_id) or svc.registry.get_provider(conn.provider_id)
    return {"success": True, "data": await provider.subscribe_ticks(body.symbols)}


@app.post("/mcp/connections/{connection_id}/unsubscribe-ticks")
async def unsubscribe_ticks(connection_id: str, body: QuotesBody, identity=Depends(require_service)):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    provider = svc.store.provider_instances.get(connection_id) or svc.registry.get_provider(conn.provider_id)
    return {"success": True, "data": await provider.unsubscribe_ticks(body.symbols)}


@app.get("/mcp/connections/{connection_id}/historical-data")
async def historical_data(
    connection_id: str,
    symbol: str = Query(...),
    timeframe: str = Query(default="1d"),
    from_date: str = Query(default="2024-01-01"),
    to_date: str = Query(default="2024-12-31"),
    identity=Depends(require_service),
):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    provider = svc.store.provider_instances.get(connection_id) or svc.registry.get_provider(conn.provider_id)
    data = await provider.get_historical_data(symbol, timeframe, from_date, to_date)
    return {"success": True, "data": data}


@app.get("/mcp/connections/{connection_id}/option-chain")
async def option_chain(
    connection_id: str,
    symbol: str = Query(...),
    expiry: str = Query(...),
    identity=Depends(require_service),
):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    provider = svc.store.provider_instances.get(connection_id) or svc.registry.get_provider(conn.provider_id)
    return {"success": True, "data": await provider.get_option_chain(symbol, expiry)}


# ---------------------------------------------------------------------------
# Order Preview + gated live orders
# ---------------------------------------------------------------------------


class OrderBody(BaseModel):
    order: dict[str, Any] = Field(default_factory=dict)


@app.post("/mcp/connections/{connection_id}/orders/preview")
async def order_preview(connection_id: str, body: OrderBody, identity=Depends(require_service)):
    try:
        data = await svc.preview_order(
            connection_id, str(identity.tenant_id), str(identity.user_id), body.order
        )
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/mcp/connections/{connection_id}/orders/execute-disabled")
async def execute_disabled(connection_id: str, body: OrderBody, identity=Depends(require_service)):
    try:
        data = await svc.execute_live_disabled(
            connection_id,
            str(identity.tenant_id),
            str(identity.user_id),
            identity.role,
            body.order,
        )
        return {"success": True, "data": data}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except LiveTradingBlockedError as exc:
        raise HTTPException(403, str(exc)) from exc


@app.put("/mcp/connections/{connection_id}/orders/{order_id}/modify-disabled")
async def modify_disabled(
    connection_id: str, order_id: str, body: OrderBody, identity=Depends(require_service)
):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    provider = svc.store.provider_instances.get(connection_id) or svc.registry.get_provider(conn.provider_id)
    from mcp_connectors.base.models import LiveOrderGateContext

    gate = LiveOrderGateContext(
        live_trading_enabled=settings.live_trading_enabled,
        caller_role=identity.role,
        rms_approval_id=body.order.get("rms_approval_id"),
        user_approval_id=body.order.get("approval_id"),
        provider_live_trading_enabled=conn.live_trading_enabled,
        kill_switch_off=not settings.kill_switch,
    )
    try:
        resp = await provider.modify_order_disabled_by_default(order_id, body.order, gate=gate)
        return {"success": True, "data": resp.model_dump(mode="json")}
    except LiveTradingBlockedError as exc:
        raise HTTPException(403, str(exc)) from exc


@app.delete("/mcp/connections/{connection_id}/orders/{order_id}/cancel-disabled")
async def cancel_disabled(connection_id: str, order_id: str, identity=Depends(require_service)):
    conn = svc.store.get_connection(connection_id, str(identity.tenant_id), str(identity.user_id))
    if not conn:
        raise HTTPException(404, "connection not found")
    provider = svc.store.provider_instances.get(connection_id) or svc.registry.get_provider(conn.provider_id)
    from mcp_connectors.base.models import LiveOrderGateContext

    gate = LiveOrderGateContext(
        live_trading_enabled=settings.live_trading_enabled,
        caller_role=identity.role,
        kill_switch_off=not settings.kill_switch,
        provider_live_trading_enabled=conn.live_trading_enabled,
    )
    try:
        resp = await provider.cancel_order_disabled_by_default(order_id, gate=gate)
        return {"success": True, "data": resp.model_dump(mode="json")}
    except LiveTradingBlockedError as exc:
        raise HTTPException(403, str(exc)) from exc


# Legacy routes
@app.post("/mcp/connectors/{connector}/connect")
async def legacy_connect(connector: str, identity=Depends(require_service)):
    data = await svc.create_connection(
        tenant_id=str(identity.tenant_id),
        user_id=str(identity.user_id),
        provider_id="paper_trading" if connector == "paper" else ("mock_trading" if connector == "mock" else connector),
        credentials={},
        config={"use_mock": True, "demo": True},
    )
    return {"success": True, "data": data["connect_result"]}


@app.get("/mcp/connectors/{connector}/health")
async def legacy_connector_health(connector: str, identity=Depends(require_service)):
    provider = svc.registry.get_provider(
        "paper_trading" if connector == "paper" else ("mock_trading" if connector == "mock" else connector)
    )
    return {"success": True, "data": await provider.health_check()}


@app.get("/mcp/connectors/{connector}/capabilities")
async def legacy_capabilities(connector: str, identity=Depends(require_service)):
    pid = "paper_trading" if connector == "paper" else ("mock_trading" if connector == "mock" else connector)
    return {"success": True, "data": svc.registry.get_provider_capabilities(pid)}


@app.post("/mcp/connectors/{connector}/order-preview")
async def legacy_preview(connector: str, body: OrderBody, identity=Depends(require_service)):
    created = await svc.create_connection(
        tenant_id=str(identity.tenant_id),
        user_id=str(identity.user_id),
        provider_id="paper_trading" if connector == "paper" else ("mock_trading" if connector == "mock" else connector),
        credentials={},
        config={"use_mock": True, "demo": True},
    )
    data = await svc.preview_order(
        created["connection"]["id"], str(identity.tenant_id), str(identity.user_id), body.order
    )
    return {"success": True, "data": data}


@app.post("/mcp/connectors/{connector}/execute")
async def legacy_execute_blocked(connector: str, body: OrderBody, identity=Depends(require_service)):
    raise HTTPException(
        403,
        "execute_order_disabled_by_default: AI advisory must never place trades. "
        "Route through OMS + RMS after explicit user approval.",
    )


# ---------------------------------------------------------------------------
# DhanLaxmi + AI Advisory context (no secrets)
# ---------------------------------------------------------------------------


@app.get("/mcp/dhanlaxmi/context")
async def dhanlaxmi_context(identity=Depends(require_service)):
    return {
        "success": True,
        "data": svc.dhanlaxmi_context(str(identity.tenant_id), str(identity.user_id)),
    }


@app.get("/mcp/dhanlaxmi/dhan-status")
async def dhanlaxmi_dhan_status(identity=Depends(require_service)):
    """Answer 'mera Dhan account status batao' — masked provider status only."""
    data = await svc.dhan_provider_status(str(identity.tenant_id), str(identity.user_id))
    return {"success": True, "data": redact_secrets(data)}


@app.get("/mcp/dhanlaxmi/provider-status")
async def dhanlaxmi_provider_status(
    provider_id: str | None = None, identity=Depends(require_service)
):
    """Generic provider status for DhanLaxmi — YAML-resolved, secrets masked."""
    data = await svc.provider_status_for_assistant(
        str(identity.tenant_id), str(identity.user_id), provider_id=provider_id
    )
    return {"success": True, "data": redact_secrets(data)}


@app.get("/mcp/dhan/snapshot")
async def dhan_snapshot(connection_id: str | None = None, identity=Depends(require_service)):
    try:
        data = await svc.dhan_account_snapshot(
            str(identity.tenant_id), str(identity.user_id), connection_id
        )
        return {"success": True, "data": redact_secrets(data)}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/mcp/providers/dhan/credential-schema")
async def dhan_credential_schema(identity=Depends(require_service)):
    from mcp_connectors.india.dhan import dhan_credentials_schema

    return {"success": True, "data": dhan_credentials_schema()}


# ---------------------------------------------------------------------------
# Interactive Brokers (IBKR) — paper-first global broker
# ---------------------------------------------------------------------------


def _ibkr_provider():
    from providers.ibkr_provider import get_ibkr_provider

    # Reuse registry singleton so connect state persists across IBKR routes
    return get_ibkr_provider(fresh=False)


class IBKRConnectBody(BaseModel):
    credentials: dict[str, str] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)


@app.post("/mcp/providers/ibkr/connect")
async def ibkr_connect(body: IBKRConnectBody, identity=Depends(require_service)):
    provider = _ibkr_provider()
    cfg = dict(body.config or {})
    cfg.setdefault("use_mock", True)
    result = await provider.connect(body.credentials or {}, cfg)
    return {"success": True, "data": redact_secrets(result)}


@app.get("/mcp/providers/ibkr/health")
async def ibkr_health(identity=Depends(require_service)):
    provider = _ibkr_provider()
    return {"success": True, "data": await provider.health_check()}


@app.get("/mcp/providers/ibkr/account-summary")
async def ibkr_account_summary(identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    profile = await provider.get_account_profile()
    return {"success": True, "data": redact_secrets(profile)}


@app.get("/mcp/providers/ibkr/positions")
async def ibkr_positions(identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    return {"success": True, "data": redact_secrets(await provider.get_positions())}


@app.get("/mcp/providers/ibkr/orders")
async def ibkr_orders(identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    return {"success": True, "data": redact_secrets(await provider.get_orders())}


@app.get("/mcp/providers/ibkr/executions")
async def ibkr_executions(identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    return {"success": True, "data": redact_secrets(await provider.get_trades())}


@app.get("/mcp/providers/ibkr/contract-search")
async def ibkr_contract_search(query: str = Query(...), identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    return {"success": True, "data": await provider.search_instruments(query)}


@app.get("/mcp/providers/ibkr/quote/{symbol}")
async def ibkr_quote(symbol: str, identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    data = await provider.get_live_quotes([symbol])
    return {"success": True, "data": data}


@app.get("/mcp/providers/ibkr/historical-data")
async def ibkr_historical(
    symbol: str = Query(...),
    timeframe: str = Query("1d"),
    from_date: str = Query(...),
    to_date: str = Query(...),
    identity=Depends(require_service),
):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    bars = await provider.get_historical_data(symbol, timeframe, from_date, to_date)
    return {"success": True, "data": bars}


class IBKROrderBody(BaseModel):
    symbol: str
    side: str = "BUY"
    quantity: float = 1
    order_type: str = "MARKET"
    price: float | None = None
    trigger_price: float | None = None
    exchange: str = "SMART"
    currency: str = "USD"
    idempotency_key: str | None = None
    oms_order_id: str | None = None
    rms_approval_id: str | None = None
    user_approval_id: str | None = None
    approval_id: str | None = None
    caller_role: str | None = None
    strategy_id: str | None = None


@app.post("/mcp/providers/ibkr/orders/preview")
async def ibkr_order_preview(body: IBKROrderBody, identity=Depends(require_service)):
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    payload = {
        "tenant_id": str(identity.tenant_id),
        "user_id": str(identity.user_id),
        "provider_id": "ibkr",
        "exchange": body.exchange,
        "symbol": body.symbol,
        "side": body.side,
        "quantity": int(body.quantity),
        "order_type": body.order_type,
        "price": body.price,
        "trigger_price": body.trigger_price,
        "currency": body.currency,
        "idempotency_key": body.idempotency_key,
    }
    return {"success": True, "data": await provider.preview_order(payload)}


@app.post("/mcp/providers/ibkr/orders/paper")
async def ibkr_paper_order(body: IBKROrderBody, identity=Depends(require_service)):
    """OMS-approved paper order only. AI/DhanLaxmi callers are rejected."""
    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    role = body.caller_role or identity.role
    payload = {
        "tenant_id": str(identity.tenant_id),
        "user_id": str(identity.user_id),
        "provider_id": "ibkr",
        "exchange": body.exchange,
        "symbol": body.symbol,
        "side": body.side,
        "quantity": int(body.quantity),
        "order_type": body.order_type,
        "price": body.price,
        "trigger_price": body.trigger_price,
        "currency": body.currency,
        "idempotency_key": body.idempotency_key,
        "oms_order_id": body.oms_order_id,
        "rms_approval_id": body.rms_approval_id,
        "user_approval_id": body.user_approval_id or body.approval_id,
        "caller_role": role,
        "strategy_id": body.strategy_id,
    }
    try:
        result = await provider.place_paper_order(payload)
        return {"success": True, "data": result.model_dump(mode="json")}
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, str(exc)) from exc


@app.post("/mcp/providers/ibkr/orders/live-disabled")
async def ibkr_live_order_disabled(body: IBKROrderBody, identity=Depends(require_service)):
    """Explicit live endpoint — always blocked unless IBKR_LIVE_TRADING_ENABLED + full gates."""
    from mcp_connectors.base.models import LiveOrderGateContext
    from mcp_connectors.base.provider import LiveTradingBlockedError

    provider = _ibkr_provider()
    if not provider._connected:
        await provider.connect({}, {"use_mock": True})
    payload = {
        "tenant_id": str(identity.tenant_id),
        "user_id": str(identity.user_id),
        "provider_id": "ibkr",
        "exchange": body.exchange,
        "symbol": body.symbol,
        "side": body.side,
        "quantity": int(body.quantity),
        "order_type": body.order_type,
        "price": body.price,
        "idempotency_key": body.idempotency_key,
        "oms_order_id": body.oms_order_id,
        "rms_approval_id": body.rms_approval_id,
        "user_approval_id": body.user_approval_id or body.approval_id,
        "caller_role": body.caller_role or identity.role,
    }
    gate = LiveOrderGateContext(
        live_trading_enabled=False,
        caller_role=payload["caller_role"],
        rms_approval_id=body.rms_approval_id,
        user_approval_id=body.user_approval_id or body.approval_id,
        provider_live_trading_enabled=False,
        kill_switch_off=True,
    )
    try:
        await provider.place_order_disabled_by_default(payload, gate=gate)
    except LiveTradingBlockedError as exc:
        return {
            "success": False,
            "blocked": True,
            "error": str(exc),
            "data": {"live_trading_enabled": False, "provider_id": "ibkr"},
        }
    raise HTTPException(500, "live order unexpectedly accepted")


@app.get("/mcp/advisory/provider-context")
async def advisory_context(identity=Depends(require_service)):
    return {
        "success": True,
        "data": svc.advisory_provider_context(str(identity.tenant_id), str(identity.user_id)),
    }


# ---------------------------------------------------------------------------
# Admin APIs
# ---------------------------------------------------------------------------


@app.get("/admin/mcp/providers")
async def admin_providers(identity=Depends(require_admin)):
    return {"success": True, "data": svc.list_providers()}


class EnableBody(BaseModel):
    enabled: bool = True


@app.put("/admin/mcp/providers/{provider_id}/enable")
async def admin_enable(provider_id: str, identity=Depends(require_admin)):
    cfg = svc.registry.set_enabled(provider_id, True)
    if not cfg:
        raise HTTPException(404, "provider not found")
    return {"success": True, "data": cfg.model_dump(mode="json")}


@app.put("/admin/mcp/providers/{provider_id}/disable")
async def admin_disable(provider_id: str, identity=Depends(require_admin)):
    cfg = svc.registry.set_enabled(provider_id, False)
    if not cfg:
        raise HTTPException(404, "provider not found")
    return {"success": True, "data": cfg.model_dump(mode="json")}


class CapsBody(BaseModel):
    capabilities: list[str] = Field(default_factory=list)


@app.put("/admin/mcp/providers/{provider_id}/capabilities")
async def admin_caps(provider_id: str, body: CapsBody, identity=Depends(require_admin)):
    cfg = svc.registry._configs.get(provider_id)
    if not cfg:
        raise HTTPException(404, "provider not found")
    cfg.capabilities = body.capabilities
    return {"success": True, "data": svc.registry.get_provider_capabilities(provider_id)}


@app.get("/admin/mcp/provider-health")
async def admin_health(identity=Depends(require_admin)):
    return {"success": True, "data": [h.model_dump(mode="json") for h in svc.store.health[-100:]]}


class LiveTradingBody(BaseModel):
    enabled: bool = False


@app.put("/admin/mcp/connections/{connection_id}/live-trading")
async def admin_connection_live_trading(
    connection_id: str, body: LiveTradingBody, identity=Depends(require_admin)
):
    """Enable/disable live trading on a connection (admin only; env must allow)."""
    try:
        data = svc.set_connection_live_trading(
            str(identity.tenant_id),
            str(identity.user_id),
            connection_id,
            enabled=body.enabled,
        )
        return {"success": True, "data": data}
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/admin/mcp/connections")
async def admin_connections(identity=Depends(require_admin)):
    rows = [c for c in svc.store.connections.values() if c.tenant_id == str(identity.tenant_id)]
    return {"success": True, "data": [svc.store.public_connection(c) for c in rows]}


@app.get("/admin/mcp/audit")
async def admin_audit(identity=Depends(require_admin)):
    rows = [a for a in svc.store.audit if a["tenant_id"] == str(identity.tenant_id)]
    return {"success": True, "data": redact_secrets(rows[-200:])}
