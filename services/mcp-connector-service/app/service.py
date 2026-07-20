"""Business logic for MCP connector service."""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from mcp_connectors.base.models import (
    LiveOrderGateContext,
    NormalizedAccountSnapshot,
    NormalizedOrderRequest,
    ProviderHealthCheck,
)
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.base.secrets import get_secret_manager
from mcp_connectors.india.paper_trading import PaperTradingProvider
from mcp_connectors.registry import MCPProviderRegistry, get_registry

from app.events import MCP_TOPICS, emit
from app.metrics import (
    mcp_live_order_blocked_total,
    mcp_order_previews_total,
    mcp_paper_orders_total,
    mcp_provider_api_errors_total,
    mcp_provider_connection_failures_total,
    mcp_provider_connections_total,
    mcp_provider_health_latency_ms,
    mcp_provider_rate_limit_warnings_total,
    mcp_quotes_received_total,
)
from app.settings import MCPConnectorSettings
from app.store import ConnectionStore


class MCPConnectorService:
    def __init__(self, settings: MCPConnectorSettings | None = None):
        self.settings = settings or MCPConnectorSettings()
        if self.settings.mcp_providers_config_dir:
            os.environ["MCP_PROVIDERS_CONFIG_DIR"] = self.settings.mcp_providers_config_dir
        os.environ.setdefault("LIVE_TRADING_ENABLED", str(self.settings.live_trading_enabled).lower())
        os.environ.setdefault("PAPER_TRADING_ENABLED", str(self.settings.paper_trading_enabled).lower())
        os.environ.setdefault("SECRET_MANAGER_PROVIDER", self.settings.secret_manager_provider)
        os.environ.setdefault("LOCAL_SECRET_KEY", self.settings.local_secret_key)
        # sync enable flags
        os.environ.setdefault("MCP_ENABLE_DHAN", str(self.settings.mcp_enable_dhan).lower())
        os.environ.setdefault("MCP_ENABLE_ZERODHA", str(self.settings.mcp_enable_zerodha).lower())
        os.environ.setdefault("MCP_ENABLE_ANGELONE", str(self.settings.mcp_enable_angelone).lower())
        os.environ.setdefault("MCP_ENABLE_UPSTOX", str(self.settings.mcp_enable_upstox).lower())
        os.environ.setdefault("MCP_ENABLE_FYERS", str(self.settings.mcp_enable_fyers).lower())
        os.environ.setdefault("MCP_ENABLE_ICICI_BREEZE", str(self.settings.mcp_enable_icici_breeze).lower())
        os.environ.setdefault("MCP_ENABLE_KOTAK_NEO", str(self.settings.mcp_enable_kotak_neo).lower())
        os.environ.setdefault("MCP_ENABLE_ALICE_BLUE", str(self.settings.mcp_enable_alice_blue).lower())
        os.environ.setdefault("MCP_ENABLE_FINVASIA_SHOONYA", str(self.settings.mcp_enable_finvasia_shoonya).lower())
        os.environ.setdefault("MCP_ENABLE_MOCK", str(self.settings.mcp_enable_mock).lower())
        os.environ.setdefault(
            "MCP_ENABLE_MOCK_MARKET_DATA", str(self.settings.mcp_enable_mock_market_data).lower()
        )
        os.environ.setdefault("PAPER_TRADING_ENABLED", str(self.settings.paper_trading_enabled).lower())

        self.registry: MCPProviderRegistry = get_registry(reload=True)
        self.store = ConnectionStore(secrets=get_secret_manager(self.settings.secret_manager_provider))

    def reload_providers(self) -> list[dict[str, Any]]:
        self.registry = get_registry(reload=True)
        return [p.model_dump(mode="json") for p in self.registry.list_providers()]

    def list_providers(self, country: str | None = None) -> list[dict[str, Any]]:
        rows = (
            self.registry.list_providers_by_country(country)
            if country
            else self.registry.list_providers()
        )
        return [p.model_dump(mode="json") for p in rows]

    async def create_connection(
        self,
        *,
        tenant_id: str,
        user_id: str,
        provider_id: str,
        credentials: dict[str, str],
        account_alias: str = "",
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        cfg = self.registry._configs.get(provider_id)
        if not cfg:
            mcp_provider_connection_failures_total.labels(provider_id, "unknown_provider").inc()
            raise ValueError(f"Unknown provider: {provider_id}")

        # Demo mock dhan: allow empty credentials with use_mock
        cfg_runtime = dict(config or {})
        if provider_id in ("dhan", "mock_trading", "paper_trading", "mock_market_data"):
            cfg_runtime.setdefault("use_mock", True)
            cfg_runtime.setdefault("demo", True)

        schema = self.registry.validate_credentials_schema(provider_id, credentials)
        if not schema["ok"] and not cfg_runtime.get("use_mock") and provider_id not in (
            "paper_trading",
            "mock_trading",
            "mock_market_data",
        ):
            mcp_provider_connection_failures_total.labels(provider_id, "credentials").inc()
            raise ValueError(f"Missing credentials: {schema['missing']}")

        caps = self.registry.get_provider_capabilities(provider_id)
        conn = self.store.create_connection(
            tenant_id=tenant_id,
            user_id=user_id,
            provider_id=provider_id,
            account_alias=account_alias,
            credentials=credentials,
            capabilities=caps,
        )
        provider = self.registry.get_provider(provider_id, fresh=True)
        result = await provider.connect(credentials, cfg_runtime)
        self.store.provider_instances[conn.id] = provider
        conn.status = "connected" if result.get("ok") else "failed"
        conn.auth_status = "authenticated" if result.get("ok") else "failed"
        conn.health_status = result.get("status", "unknown")
        conn.last_connected_at = datetime.now(timezone.utc) if result.get("ok") else None
        conn.updated_at = datetime.now(timezone.utc)

        if result.get("ok"):
            mcp_provider_connections_total.labels(provider_id, "success").inc()
            await emit(
                MCP_TOPICS.MCP_CONNECTION_CREATED,
                tenant_id=tenant_id,
                user_id=user_id,
                payload={"connection_id": conn.id, "provider_id": provider_id, "status": conn.status},
                bootstrap=self.settings.kafka_bootstrap_servers,
            )
            await emit(
                MCP_TOPICS.MCP_CONNECTION_CONNECTED,
                tenant_id=tenant_id,
                user_id=user_id,
                payload={"connection_id": conn.id, "provider_id": provider_id},
                bootstrap=self.settings.kafka_bootstrap_servers,
            )
        else:
            mcp_provider_connections_total.labels(provider_id, "failed").inc()
            mcp_provider_connection_failures_total.labels(provider_id, str(result.get("status"))).inc()
            await emit(
                MCP_TOPICS.MCP_CONNECTION_FAILED,
                tenant_id=tenant_id,
                user_id=user_id,
                payload={"connection_id": conn.id, "provider_id": provider_id, "result": result},
                bootstrap=self.settings.kafka_bootstrap_servers,
            )

        return {
            "connection": self.store.public_connection(conn),
            "connect_result": result,
        }

    async def test_connection(self, connection_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
        conn = self.store.get_connection(connection_id, tenant_id, user_id)
        if not conn:
            raise LookupError("connection_not_found")
        provider = self.store.provider_instances.get(connection_id) or self.registry.get_provider(
            conn.provider_id, fresh=True
        )
        started = time.perf_counter()
        health = await provider.health_check()
        latency = (time.perf_counter() - started) * 1000
        mcp_provider_health_latency_ms.labels(conn.provider_id).observe(latency)
        if health.get("status") == "rate_limited":
            mcp_provider_rate_limit_warnings_total.labels(conn.provider_id).inc()
            await emit(
                MCP_TOPICS.MCP_PROVIDER_RATE_LIMIT_WARNING,
                tenant_id=tenant_id,
                user_id=user_id,
                payload={"connection_id": connection_id, "provider_id": conn.provider_id},
                bootstrap=self.settings.kafka_bootstrap_servers,
            )
        check = ProviderHealthCheck(
            provider_id=conn.provider_id,
            tenant_id=tenant_id,
            connection_id=connection_id,
            status=str(health.get("status")),
            latency_ms=latency,
            error_message=None if health.get("ok") else str(health.get("status")),
            auth_expiry_warning=bool(health.get("auth_expiry_warning")),
            rate_limit_status="limited" if health.get("status") == "rate_limited" else "ok",
        )
        self.store.record_health(check)
        prev = conn.health_status
        conn.health_status = check.status
        conn.last_health_check_at = check.checked_at
        self.store.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="connection.tested",
            provider_id=conn.provider_id,
            connection_id=connection_id,
            details={"status": check.status, "latency_ms": latency},
        )
        await emit(
            MCP_TOPICS.MCP_CONNECTION_TESTED,
            tenant_id=tenant_id,
            user_id=user_id,
            payload={"connection_id": connection_id, "health": check.model_dump(mode="json")},
            bootstrap=self.settings.kafka_bootstrap_servers,
        )
        if prev != conn.health_status:
            await emit(
                MCP_TOPICS.MCP_CONNECTION_HEALTH_CHANGED,
                tenant_id=tenant_id,
                user_id=user_id,
                payload={"connection_id": connection_id, "from": prev, "to": conn.health_status},
                bootstrap=self.settings.kafka_bootstrap_servers,
            )
        return {"health": check.model_dump(mode="json"), "provider": health}

    async def refresh_session(self, connection_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
        conn = self.store.get_connection(connection_id, tenant_id, user_id)
        if not conn:
            raise LookupError("connection_not_found")
        provider = self.store.provider_instances.get(connection_id) or self.registry.get_provider(conn.provider_id)
        result = await provider.refresh_session()
        self.store.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="connection.refresh_session",
            provider_id=conn.provider_id,
            connection_id=connection_id,
            details={"result_status": result.get("status")},
        )
        return result

    async def account_snapshot(self, connection_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
        conn = self.store.get_connection(connection_id, tenant_id, user_id)
        if not conn:
            raise LookupError("connection_not_found")
        provider = self.store.provider_instances.get(connection_id) or self.registry.get_provider(conn.provider_id)
        # Prefer rich Dhan snapshot when available
        if conn.provider_id == "dhan" and hasattr(provider, "get_account_snapshot"):
            rich = await provider.get_account_snapshot()
            snap = NormalizedAccountSnapshot(
                provider_id="dhan",
                account_id=conn.id,
                user_id=user_id,
                tenant_id=tenant_id,
                profile_json=rich.get("profile") or {},
                margins_json=rich.get("margins") or {},
                holdings_json=rich.get("holdings") or [],
                positions_json=rich.get("positions") or [],
                orders_json=rich.get("orders") or [],
                trades_json=rich.get("trades") or [],
            )
            data = snap.model_dump(mode="json")
            data["health"] = rich.get("health")
            data["live_order_execution"] = False
            data["secrets_included"] = False
        else:
            snap = NormalizedAccountSnapshot(
                provider_id=conn.provider_id,
                account_id=conn.id,
                user_id=user_id,
                tenant_id=tenant_id,
                profile_json=await provider.get_account_profile(),
                margins_json=await provider.get_margins(),
                holdings_json=await provider.get_holdings(),
                positions_json=await provider.get_positions(),
                orders_json=await provider.get_orders(),
                trades_json=await provider.get_trades(),
            )
            data = snap.model_dump(mode="json")
        self.store.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="account.snapshot",
            provider_id=conn.provider_id,
            connection_id=connection_id,
            details={"holdings": len(data.get("holdings_json") or [])},
        )
        await emit(
            MCP_TOPICS.MCP_ACCOUNT_SNAPSHOT_UPDATED,
            tenant_id=tenant_id,
            user_id=user_id,
            payload={"connection_id": connection_id, "provider_id": conn.provider_id},
            bootstrap=self.settings.kafka_bootstrap_servers,
        )
        return data

    async def quotes(self, connection_id: str, tenant_id: str, user_id: str, symbols: list[str]) -> dict[str, Any]:
        conn = self.store.get_connection(connection_id, tenant_id, user_id)
        if not conn:
            raise LookupError("connection_not_found")
        provider = self.store.provider_instances.get(connection_id) or self.registry.get_provider(conn.provider_id)
        data = await provider.get_live_quotes(symbols)
        mcp_quotes_received_total.labels(conn.provider_id).inc()
        await emit(
            MCP_TOPICS.MCP_MARKET_QUOTE_RECEIVED,
            tenant_id=tenant_id,
            user_id=user_id,
            payload={"connection_id": connection_id, "symbols": symbols, "count": len(symbols)},
            bootstrap=self.settings.kafka_bootstrap_servers,
        )
        return data

    async def preview_order(
        self,
        connection_id: str,
        tenant_id: str,
        user_id: str,
        order: dict[str, Any],
    ) -> dict[str, Any]:
        conn = self.store.get_connection(connection_id, tenant_id, user_id)
        if not conn:
            raise LookupError("connection_not_found")
        idem = order.get("idempotency_key") or str(uuid4())
        if idem in self.store.preview_idempotency:
            return {**self.store.preview_idempotency[idem], "duplicate": True}
        provider = self.store.provider_instances.get(connection_id) or self.registry.get_provider(conn.provider_id)
        req = NormalizedOrderRequest(
            tenant_id=tenant_id,
            user_id=user_id,
            provider_id=conn.provider_id,
            account_id=conn.id,
            exchange=str(order.get("exchange") or "NSE"),
            symbol=str(order.get("symbol") or ""),
            side=str(order.get("side") or "BUY"),
            quantity=int(order.get("quantity") or 0),
            order_type=str(order.get("order_type") or "MARKET"),
            product_type=str(order.get("product_type") or "CNC"),
            price=order.get("price"),
            trigger_price=order.get("trigger_price"),
            validity=str(order.get("validity") or "DAY"),
            strategy_id=order.get("strategy_id"),
            bot_id=order.get("bot_id"),
            approval_id=order.get("approval_id"),
            rms_approval_id=order.get("rms_approval_id"),
            idempotency_key=idem,
        )
        result = await provider.preview_order(req)
        mcp_order_previews_total.labels(conn.provider_id).inc()
        self.store.preview_idempotency[idem] = result
        self.store.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="order.preview",
            provider_id=conn.provider_id,
            connection_id=connection_id,
            details={"symbol": req.symbol, "side": req.side, "quantity": req.quantity, "idempotency_key": idem},
        )
        await emit(
            MCP_TOPICS.MCP_ORDER_PREVIEW_CREATED,
            tenant_id=tenant_id,
            user_id=user_id,
            payload={"connection_id": connection_id, "idempotency_key": idem, "symbol": req.symbol},
            bootstrap=self.settings.kafka_bootstrap_servers,
        )
        await emit(
            MCP_TOPICS.COMPLIANCE_AUDIT_CREATED,
            tenant_id=tenant_id,
            user_id=user_id,
            payload={"action": "order.preview", "connection_id": connection_id, "provider_id": conn.provider_id},
            bootstrap=self.settings.kafka_bootstrap_servers,
        )
        return result

    async def execute_live_disabled(
        self,
        connection_id: str,
        tenant_id: str,
        user_id: str,
        role: str,
        order: dict[str, Any],
    ) -> dict[str, Any]:
        conn = self.store.get_connection(connection_id, tenant_id, user_id if role != "oms_service" else None)
        if not conn and role == "oms_service":
            conn = self.store.get_connection(connection_id, tenant_id)
        if not conn:
            raise LookupError("connection_not_found")
        provider = self.store.provider_instances.get(connection_id) or self.registry.get_provider(conn.provider_id)

        # Paper path shortcut
        if conn.provider_id == "paper_trading" and isinstance(provider, PaperTradingProvider):
            resp = await provider.place_paper_order(order)
            mcp_paper_orders_total.labels(conn.provider_id, resp.status).inc()
            return resp.model_dump(mode="json")

        if conn.provider_id == "mock_trading" and hasattr(provider, "place_test_order"):
            resp = await provider.place_test_order(order)
            mcp_paper_orders_total.labels(conn.provider_id, resp.status).inc()
            return resp.model_dump(mode="json")

        gate = LiveOrderGateContext(
            live_trading_enabled=self.settings.live_trading_enabled,
            caller_role=role,
            rms_approval_id=order.get("rms_approval_id"),
            user_approval_id=order.get("approval_id") or order.get("user_approval_id"),
            provider_live_trading_enabled=conn.live_trading_enabled,
            kill_switch_off=not self.settings.kill_switch,
        )
        try:
            resp = await provider.place_order_disabled_by_default(order, gate=gate)
            return resp.model_dump(mode="json")
        except LiveTradingBlockedError as exc:
            mcp_live_order_blocked_total.labels(conn.provider_id, "gates").inc()
            self.store.audit_event(
                tenant_id=tenant_id,
                user_id=user_id,
                action="order.live_blocked",
                provider_id=conn.provider_id,
                connection_id=connection_id,
                details={"reason": str(exc)},
            )
            raise

    async def run_health_monitor_once(self) -> list[dict[str, Any]]:
        results = []
        for conn in list(self.store.connections.values()):
            provider = self.store.provider_instances.get(conn.id)
            if not provider:
                continue
            started = time.perf_counter()
            try:
                health = await provider.health_check()
            except Exception as exc:  # noqa: BLE001
                mcp_provider_api_errors_total.labels(conn.provider_id, "health_check").inc()
                health = {"ok": False, "status": "error", "error": str(exc)}
            latency = (time.perf_counter() - started) * 1000
            mcp_provider_health_latency_ms.labels(conn.provider_id).observe(latency)
            check = ProviderHealthCheck(
                provider_id=conn.provider_id,
                tenant_id=conn.tenant_id,
                connection_id=conn.id,
                status=str(health.get("status")),
                latency_ms=latency,
            )
            self.store.record_health(check)
            results.append(check.model_dump(mode="json"))
            await emit(
                MCP_TOPICS.MCP_CONNECTION_HEALTH_CHANGED,
                tenant_id=conn.tenant_id,
                user_id=conn.user_id,
                payload={"connection_id": conn.id, "health": check.model_dump(mode="json")},
                bootstrap=self.settings.kafka_bootstrap_servers,
            )
        return results

    def dhanlaxmi_context(self, tenant_id: str, user_id: str) -> dict[str, Any]:
        """Safe context for DhanLaxmi — no secrets."""
        from mcp_connectors import phase3_provider_ids, resolve_preferred_provider

        conns = self.store.list_connections(tenant_id, user_id)
        connected = []
        connected_ids: list[str] = []
        for c in conns:
            connected.append(
                {
                    "connection_id": c.id,
                    "provider_id": c.provider_id,
                    "status": c.status,
                    "health_status": c.health_status,
                    "account_alias": c.account_alias,
                    "capabilities": c.capabilities_json,
                    "live_trading_enabled": bool(c.live_trading_enabled),
                }
            )
            if c.status == "connected":
                connected_ids.append(c.provider_id)
        preferred = resolve_preferred_provider(
            {"broker": self.settings.mcp_default_provider},
            registry=self.registry,
            connected_provider_ids=connected_ids,
        )
        return {
            "connected_providers": connected,
            "connected_provider_ids": connected_ids,
            "preferred_broker": preferred,
            "phase3_providers": phase3_provider_ids(self.registry),
            "live_trading_enabled": bool(self.settings.live_trading_enabled),
            "paper_trading_enabled": self.settings.paper_trading_enabled,
            "secrets_included": False,
        }

    def set_connection_live_trading(
        self,
        tenant_id: str,
        actor_user_id: str,
        connection_id: str,
        *,
        enabled: bool,
    ) -> dict[str, Any]:
        """Admin-gated connection live flag. Enabling requires platform LIVE_TRADING_ENABLED."""
        if enabled:
            if not self.settings.live_trading_enabled:
                raise PermissionError("LIVE_TRADING_ENABLED=false — cannot enable connection live trading")
            if self.settings.kill_switch:
                raise PermissionError("kill_switch_active")
        conn = self.store.set_live_trading(
            connection_id, tenant_id, enabled=enabled, actor_user_id=actor_user_id
        )
        if not conn:
            raise LookupError("connection_not_found")
        return self.store.public_connection(conn)

    async def dhan_provider_status(self, tenant_id: str, user_id: str) -> dict[str, Any]:
        """DhanLaxmi Dhan status — delegates to generic YAML-resolved provider status."""
        return await self.provider_status_for_assistant(tenant_id, user_id, provider_id="dhan")

    async def dhan_account_snapshot(self, tenant_id: str, user_id: str, connection_id: str | None = None) -> dict[str, Any]:
        from mcp_connectors.india.dhan import DhanMCPProvider

        if connection_id:
            conn = self.store.get_connection(connection_id, tenant_id, user_id)
            if not conn or conn.provider_id != "dhan":
                raise LookupError("dhan_connection_not_found")
            provider = self.store.provider_instances.get(connection_id)
            if not isinstance(provider, DhanMCPProvider):
                provider = DhanMCPProvider()
                await provider.connect(self.store.load_credentials(conn), {"use_mock": True, "demo": True})
                self.store.provider_instances[connection_id] = provider
        else:
            provider = DhanMCPProvider()
            await provider.connect({}, {"use_mock": True, "demo": True})
        snap = await provider.get_account_snapshot()
        self.store.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="dhan.account_snapshot",
            provider_id="dhan",
            connection_id=connection_id,
            details={"holdings": len(snap.get("holdings") or []), "orders": len(snap.get("orders") or [])},
        )
        return snap

    def advisory_provider_context(self, tenant_id: str, user_id: str) -> dict[str, Any]:
        from mcp_connectors import phase3_provider_ids, resolve_preferred_provider

        ctx = self.dhanlaxmi_context(tenant_id, user_id)
        connected_ids = {c["provider_id"] for c in ctx["connected_providers"] if c["status"] == "connected"}
        brokers = [p for p in self.registry.list_providers() if p.provider_type in ("broker", "simulated_broker", "mock")]
        data_providers = [p for p in self.registry.list_providers() if p.provider_type in ("market_data", "exchange_data")]
        preferred = resolve_preferred_provider(
            {},
            registry=self.registry,
            connected_provider_ids=list(connected_ids),
        )
        broker_connected = any(
            c["provider_id"] not in ("paper_trading", "mock_trading") and c["status"] == "connected"
            for c in ctx["connected_providers"]
        )
        market_data_ids = {
            p.provider_id
            for p in self.registry.list_providers()
            if p.provider_type in ("market_data", "exchange_data")
        }
        market_ok = bool(connected_ids & market_data_ids) or broker_connected
        mode = "live_deployment_locked"
        if broker_connected:
            mode = "broker_context_paper_gated"
        elif not connected_ids or not broker_connected:
            mode = "paper_only"
        if not market_ok:
            mode = "backtest_only_or_no_trade"
        if not self.settings.live_trading_enabled:
            # Live remains locked regardless of connected brokers
            if mode == "live_deployment_locked":
                mode = "live_deployment_locked"
        data_provider = next((pid for pid in connected_ids if pid in market_data_ids), None)
        if not data_provider and preferred in connected_ids:
            data_provider = preferred
        return {
            "preferred_broker": preferred,
            "data_provider": data_provider or ("mock_market_data" if market_ok else None),
            "paper_trading_provider": "paper_trading",
            "fallback_mock_provider": "mock_trading",
            "advisory_mode": mode,
            "dhan_connected": "dhan" in connected_ids,
            "connected_provider_ids": sorted(connected_ids),
            "phase3_providers": phase3_provider_ids(self.registry),
            "available_brokers": [b.provider_id for b in brokers if b.enabled],
            "available_data_providers": [d.provider_id for d in data_providers if d.enabled],
            "live_trading_enabled": False,
        }

    async def provider_status_for_assistant(
        self, tenant_id: str, user_id: str, provider_id: str | None = None
    ) -> dict[str, Any]:
        """Generic DhanLaxmi provider status — YAML-resolved, secrets masked."""
        from mcp_connectors import fetch_provider_account_context, resolve_preferred_provider

        ctx = self.dhanlaxmi_context(tenant_id, user_id)
        pid = provider_id or resolve_preferred_provider(
            {},
            registry=self.registry,
            connected_provider_ids=ctx.get("connected_provider_ids") or [],
        )
        # Prefer persisted connection when available
        matching = [
            c
            for c in self.store.list_connections(tenant_id, user_id)
            if c.provider_id == pid and c.status == "connected"
        ]
        config: dict[str, Any] = {}
        credentials: dict[str, Any] = {}
        connection_id = None
        if matching:
            conn = matching[0]
            connection_id = conn.id
            credentials = self.store.load_credentials(conn)
            if pid == "dhan":
                config = {"use_mock": True, "demo": True}
        elif pid == "dhan":
            config = {"use_mock": True, "demo": True}
        account = await fetch_provider_account_context(pid, credentials=credentials, config=config, registry=self.registry)
        status = account.get("provider_status") or {
            "provider_id": pid,
            "connected": account.get("status") == "connected",
            "health_status": (account.get("health") or {}).get("status"),
            "masked_client_id": ((account.get("account_snapshot") or {}).get("profile") or {}).get("masked_client_id")
            or (account.get("holdings") and "****")
            or "****",
            "available_margin": (account.get("margins") or {}).get("available"),
            "holdings_count": len(account.get("holdings") or []),
            "open_positions_count": len(account.get("positions") or []),
            "live_trading_enabled": False,
        }
        status["connection_id"] = connection_id
        status["persisted"] = connection_id is not None
        status["provider_id"] = pid
        # Report connection flag when persisted; global platform live still gated by env
        conn_live = False
        if matching:
            conn_live = bool(matching[0].live_trading_enabled)
        status["connection_live_trading_enabled"] = conn_live
        status["live_trading_enabled"] = bool(self.settings.live_trading_enabled and conn_live)
        status["platform_live_trading_enabled"] = bool(self.settings.live_trading_enabled)
        status["secrets_included"] = False
        self.store.audit_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="dhanlaxmi.provider_status",
            provider_id=pid,
            connection_id=connection_id,
            details={"connected": status.get("connected"), "persisted": status["persisted"]},
        )
        return status
