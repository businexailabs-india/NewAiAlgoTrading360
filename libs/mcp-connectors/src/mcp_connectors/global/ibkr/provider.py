"""IBKRMCPProvider — Interactive Brokers MCP adapter (paper-first)."""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any
from uuid import uuid4

from mcp_connectors.base.models import (
    LiveOrderGateContext,
    NormalizedOrderRequest,
    NormalizedOrderResponse,
    ProviderConfig,
)
from mcp_connectors.base.provider import BaseTradingMCPProvider, LiveTradingBlockedError

from .config import IBKRConnectionConfig
from .contract_mapper import denormalize_symbol, normalize_symbol, search_mock_contracts, to_contract_request
from .errors import (
    IBKRError,
    IBKRLiveTradingBlockedError,
    IBKRPaperGateError,
)
from .ibkr_client import IBKRClient, MockIBKRClient, build_ibkr_client
from .models import IBKROrderRequest
from .order_mapper import (
    map_order_status,
    map_order_type,
    map_product_type,
    to_ibkr_order_request,
)


_AI_ROLES = frozenset(
    {
        "ai",
        "ai_advisory",
        "ai_advisory_service",
        "dhanlaxmi",
        "dhanlaxmi_assistant",
        "dhanlaxmi_assistant_service",
        "advisory",
        "user",
        "strategy_service_direct",
    }
)


class IBKRMCPProvider(BaseTradingMCPProvider):
    """Global broker connector for Interactive Brokers (TWS / IB Gateway)."""

    provider_id = "ibkr"
    provider_name = "Interactive Brokers"
    provider_type = "global_broker"
    country = "GLOBAL"
    supported_exchanges = ["SMART", "NYSE", "NASDAQ", "ARCA", "IDEALPRO"]
    supported_segments = ["equity", "options", "futures", "forex", "bonds"]
    supported_asset_classes = ["stocks", "etfs", "options", "futures", "forex", "bonds"]

    def __init__(
        self,
        config: ProviderConfig | None = None,
        client: IBKRClient | None = None,
        **kwargs: Any,
    ):
        super().__init__(config)
        self._audit_events: list[dict[str, Any]] = []
        self._ibkr_config = IBKRConnectionConfig.from_env_and_overrides()
        self.client: IBKRClient = client or MockIBKRClient(
            config=self._ibkr_config, audit_hook=self._on_client_audit
        )
        self._mode = "not_configured"

    def _on_client_audit(self, action: str, details: dict[str, Any]) -> None:
        self._audit_events.append({"action": action, "details": details, "provider_id": "ibkr"})

    def get_audit_log(self) -> list[dict[str, Any]]:
        return list(self._audit_events)

    def _audit(self, action: str, details: dict[str, Any]) -> None:
        self._audit_events.append({"action": action, "details": details, "provider_id": "ibkr"})

    # ---- session -----------------------------------------------------------

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        overrides = dict(config or {})
        # Credentials may carry account_id but never store secrets in plaintext responses
        if credentials.get("account_id") and not overrides.get("account_id"):
            overrides["account_id"] = credentials["account_id"]
        if credentials.get("host"):
            overrides["host"] = credentials["host"]
        if credentials.get("port"):
            overrides["port"] = credentials["port"]
        if credentials.get("client_id"):
            overrides["client_id"] = credentials["client_id"]

        self._ibkr_config = IBKRConnectionConfig.from_env_and_overrides(overrides)
        # Default paper port when unset in env (config already defaults 7497)
        self.client = build_ibkr_client(self._ibkr_config, audit_hook=self._on_client_audit)
        result = await self.client.connect_to_tws_or_gateway()
        self._connected = bool(result.get("ok"))
        self._mode = "paper" if self._ibkr_config.mode == "paper" else "live_locked"
        self._credentials = {"_present": "true"} if self._connected else {}
        self._runtime_config = {
            **self._ibkr_config.masked_dict(),
            "secrets_included": False,
        }
        self._audit(
            "provider.connect",
            {"ok": result.get("ok"), "mode": self._mode, **self._ibkr_config.masked_dict()},
        )
        return {
            **result,
            "provider_id": "ibkr",
            "live_trading_enabled": False,
            "paper_trading_default": True,
            "config": self._ibkr_config.masked_dict(),
        }

    async def disconnect(self) -> dict[str, Any]:
        result = await self.client.disconnect()
        self._connected = False
        self._mode = "disconnected"
        self._audit("provider.disconnect", {"ok": True})
        return result

    async def authenticate(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": "not_configured", "provider_id": "ibkr"}
        return {"ok": True, "status": "authenticated", "provider_id": "ibkr", "mode": self._mode}

    async def refresh_session(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": "not_configured"}
        # TWS sessions are socket-based; re-health is sufficient for mock/paper
        health = await self.health_check()
        return {"ok": health.get("ok", False), "status": health.get("status"), "provider_id": "ibkr"}

    async def health_check(self) -> dict[str, Any]:
        if not self._connected:
            return {
                "ok": False,
                "status": "disconnected",
                "provider_id": "ibkr",
                "mode": self._ibkr_config.mode,
                "port": self._ibkr_config.port,
            }
        return {
            "ok": True,
            "status": "connected",
            "provider_id": "ibkr",
            "mode": self._mode,
            "connection_mode": self._ibkr_config.connection_mode,
            "port": self._ibkr_config.port,
            "live_trading_enabled": False,
        }

    async def get_provider_status(self) -> dict[str, Any]:
        base = await super().get_provider_status()
        base.update(
            {
                "mode": self._mode,
                "paper_trading_default": True,
                "live_trading_default": False,
                "config": self._ibkr_config.masked_dict(),
            }
        )
        return base

    # ---- account / portfolio -----------------------------------------------

    async def get_account_profile(self) -> dict[str, Any]:
        summary = await self.client.request_account_summary()
        return {
            "provider_id": "ibkr",
            "account_id_masked": summary.account_id_masked,
            "currency": summary.currency,
            "mode": summary.mode,
            "net_liquidation": summary.net_liquidation,
            "profile": summary.model_dump(),
        }

    async def get_accounts(self) -> list[dict[str, Any]]:
        summary = await self.client.request_account_summary()
        return [
            {
                "account_id_masked": summary.account_id_masked,
                "currency": summary.currency,
                "mode": "paper",
                "provider_id": "ibkr",
            }
        ]

    async def get_margins(self) -> dict[str, Any]:
        summary = await self.client.request_account_summary()
        return {
            "available": summary.available_funds,
            "buying_power": summary.buying_power,
            "used": summary.init_margin,
            "maintenance_margin": summary.maintenance_margin,
            "excess_liquidity": summary.excess_liquidity,
            "currency": summary.currency,
            "provider_id": "ibkr",
        }

    async def get_holdings(self) -> list[dict[str, Any]]:
        positions = await self.client.request_positions()
        return [
            {
                "symbol": p.symbol,
                "quantity": p.position,
                "avg_price": p.avg_cost,
                "market_price": p.market_price,
                "market_value": p.market_value,
                "currency": p.currency,
                "sec_type": p.sec_type,
                "account_id_masked": p.account_id_masked,
            }
            for p in positions
            if p.position != 0
        ]

    async def get_positions(self) -> list[dict[str, Any]]:
        return [p.model_dump() for p in await self.client.request_positions()]

    async def get_orders(self) -> list[dict[str, Any]]:
        return await self.client.request_open_orders()

    async def get_trades(self) -> list[dict[str, Any]]:
        return [e.model_dump() for e in await self.client.request_executions()]

    # ---- instruments / market data -----------------------------------------

    async def get_instruments(self) -> list[dict[str, Any]]:
        return [c.to_dict() for c in search_mock_contracts("AAPL") + search_mock_contracts("MSFT") + search_mock_contracts("SPY")]

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        contracts = await self.client.request_contract_details(to_contract_request(query))
        return [c.to_dict() for c in contracts]

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        quotes: dict[str, Any] = {}
        for sym in symbols:
            tick = await self.client.request_market_data(sym)
            quotes[normalize_symbol(sym)] = tick.model_dump()
        return {"quotes": quotes, "provider_id": "ibkr", "delayed": True}

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        for s in symbols:
            self._subscribed.add(normalize_symbol(s))
        return {"ok": True, "subscribed": sorted(self._subscribed), "provider_id": "ibkr"}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        for s in symbols:
            self._subscribed.discard(normalize_symbol(s))
        return {"ok": True, "subscribed": sorted(self._subscribed), "provider_id": "ibkr"}

    async def get_historical_data(
        self,
        symbol: str,
        timeframe: str,
        from_date: date | datetime,
        to_date: date | datetime,
    ) -> list[dict[str, Any]]:
        fd = from_date.isoformat() if hasattr(from_date, "isoformat") else str(from_date)
        td = to_date.isoformat() if hasattr(to_date, "isoformat") else str(to_date)
        bars = await self.client.request_historical_data(symbol, timeframe, fd, td)
        return [b.model_dump() for b in bars]

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        # Placeholder chain for paper/demo
        underlying = normalize_symbol(symbol)
        strikes = [180.0, 185.0, 190.0, 195.0, 200.0]
        chain = []
        for k in strikes:
            for right in ("C", "P"):
                chain.append(
                    {
                        "symbol": underlying,
                        "sec_type": "OPT",
                        "expiry": expiry,
                        "strike": k,
                        "right": right,
                        "exchange": "SMART",
                        "currency": "USD",
                        "multiplier": "100",
                    }
                )
        return {"symbol": underlying, "expiry": expiry, "options": chain, "provider_id": "ibkr"}

    # ---- orders ------------------------------------------------------------

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        req = to_ibkr_order_request(order_request)
        margins = await self.get_margins() if self._connected else {"available": 0}
        est_price = float(req.limit_price or 190.0)
        estimated = abs(req.quantity) * est_price
        accepted = self._connected and req.quantity > 0 and bool(req.symbol)
        if accepted and estimated > float(margins.get("available") or 0) * 2:
            accepted = False
        out = {
            "accepted": accepted,
            "provider_id": "ibkr",
            "mode": "paper",
            "live_execution": False,
            "estimated_margin": estimated,
            "normalized_symbol": self.normalize_symbol(req.symbol),
            "mapped_order_type": req.order_type,
            "mapped_product_type": map_product_type("DAY"),
            "order_redacted": {
                "symbol": req.symbol,
                "side": req.side,
                "quantity": req.quantity,
                "order_type": req.order_type,
                "limit_price": req.limit_price,
                "idempotency_key": req.idempotency_key,
            },
            "warnings": [] if accepted else ["preview_rejected_or_insufficient_buying_power"],
        }
        self._audit("order.preview", {"symbol": req.symbol, "accepted": accepted, "side": req.side})
        return out

    def _assert_paper_gates(self, order: IBKROrderRequest) -> None:
        role = (order.caller_role or "user").lower()
        if role in _AI_ROLES or "dhanlaxmi" in role or "advisory" in role:
            self._audit("order.ai_direct_rejected", {"caller_role": role, "symbol": order.symbol})
            raise IBKRPaperGateError(
                "Direct IBKR orders from AI Advisory / DhanLaxmi are forbidden. "
                "Route: User Approval → RMS → OMS → IBKR Connector."
            )
        if role != "oms_service":
            self._audit("order.non_oms_rejected", {"caller_role": role})
            raise IBKRPaperGateError("Only OMS service may submit IBKR orders")
        if not order.rms_approval_id:
            raise IBKRPaperGateError("RMS approval id required")
        if not order.user_approval_id:
            raise IBKRPaperGateError("User approval id required")
        if not order.oms_order_id:
            raise IBKRPaperGateError("OMS order id required")
        if not order.idempotency_key:
            raise IBKRPaperGateError("Idempotency key required")
        mode = (os.getenv("IBKR_MODE") or self._ibkr_config.mode or "paper").lower()
        if mode != "paper":
            raise IBKRLiveTradingBlockedError(
                "Paper order path requires IBKR_MODE=paper. "
                "Live orders use place_order_disabled_by_default with full gates."
            )

    async def place_paper_order(
        self,
        order_request: NormalizedOrderRequest | dict[str, Any] | IBKROrderRequest,
    ) -> NormalizedOrderResponse:
        """OMS-approved paper order path (IBKR_MODE=paper)."""
        if isinstance(order_request, IBKROrderRequest):
            req = order_request
        else:
            req = to_ibkr_order_request(order_request)
        try:
            self._assert_paper_gates(req)
            resp = await self.client.place_paper_order(req)
            self._audit(
                "order.paper_placed",
                {
                    "provider_order_id": resp.provider_order_id,
                    "symbol": req.symbol,
                    "oms_order_id": req.oms_order_id,
                    "rms_approval_id": req.rms_approval_id,
                    "status": resp.status,
                },
            )
            return NormalizedOrderResponse(
                provider_id="ibkr",
                provider_order_id=resp.provider_order_id,
                status=resp.status,
                message=resp.message,
                raw_response_redacted=resp.raw_response_redacted,
            )
        except (IBKRPaperGateError, IBKRLiveTradingBlockedError, IBKRError) as exc:
            self._audit("order.paper_failed", {"reason": str(exc), "symbol": req.symbol})
            raise

    async def place_order_disabled_by_default(
        self,
        order_request: NormalizedOrderRequest | dict[str, Any],
        gate: LiveOrderGateContext | None = None,
    ) -> NormalizedOrderResponse:
        """Live path — blocked by default."""
        req = to_ibkr_order_request(order_request)
        live_flag = os.getenv("IBKR_LIVE_TRADING_ENABLED", "false").lower() in ("1", "true", "yes")
        mode = (os.getenv("IBKR_MODE") or self._ibkr_config.mode or "paper").lower()
        if not live_flag or mode != "live":
            self._audit(
                "order.live_blocked",
                {
                    "reason": "IBKR_LIVE_TRADING_ENABLED=false or IBKR_MODE!=live",
                    "caller_role": req.caller_role,
                    "symbol": req.symbol,
                },
            )
            raise LiveTradingBlockedError(
                "IBKR live order blocked: IBKR_LIVE_TRADING_ENABLED=false (paper default). "
                "Route: User Approval → RMS → OMS → IBKR Connector."
            )
        role = (req.caller_role or (gate.caller_role if gate else "user")).lower()
        if role in _AI_ROLES or "dhanlaxmi" in role or "advisory" in role:
            self._audit("order.ai_direct_rejected", {"caller_role": role})
            raise LiveTradingBlockedError("AI Advisory / DhanLaxmi cannot place IBKR orders directly")
        try:
            return await super().place_order_disabled_by_default(order_request, gate=gate)
        except LiveTradingBlockedError as exc:
            self._audit("order.live_blocked", {"reason": str(exc)})
            raise

    async def modify_order_disabled_by_default(
        self,
        order_id: str,
        modify_request: dict[str, Any],
        gate: LiveOrderGateContext | None = None,
    ) -> NormalizedOrderResponse:
        if os.getenv("IBKR_LIVE_TRADING_ENABLED", "false").lower() not in ("1", "true", "yes"):
            raise LiveTradingBlockedError("IBKR live modify blocked by default")
        return await super().modify_order_disabled_by_default(order_id, modify_request, gate=gate)

    async def cancel_order_disabled_by_default(
        self,
        order_id: str,
        gate: LiveOrderGateContext | None = None,
    ) -> NormalizedOrderResponse:
        if os.getenv("IBKR_LIVE_TRADING_ENABLED", "false").lower() not in ("1", "true", "yes"):
            # Allow paper cancel via client without live flag
            if self._ibkr_config.mode == "paper" and isinstance(self.client, MockIBKRClient):
                resp = await self.client.cancel_order(order_id)
                return NormalizedOrderResponse(
                    provider_id="ibkr",
                    provider_order_id=resp.provider_order_id,
                    status=resp.status,
                    message=resp.message,
                    raw_response_redacted=resp.raw_response_redacted,
                )
            raise LiveTradingBlockedError("IBKR live cancel blocked by default")
        return await super().cancel_order_disabled_by_default(order_id, gate=gate)

    async def _place_live_order(
        self, order_request: NormalizedOrderRequest | dict[str, Any]
    ) -> NormalizedOrderResponse:
        raise LiveTradingBlockedError(
            "IBKR live _place_live_order not enabled in this build. Use paper path."
        )

    async def _modify_live_order(
        self, order_id: str, modify_request: dict[str, Any]
    ) -> NormalizedOrderResponse:
        raise LiveTradingBlockedError("IBKR live modify not enabled")

    async def _cancel_live_order(self, order_id: str) -> NormalizedOrderResponse:
        raise LiveTradingBlockedError("IBKR live cancel not enabled")

    # ---- mapping helpers ---------------------------------------------------

    def normalize_symbol(self, provider_symbol: str, exchange: str = "SMART") -> str:
        return f"IBKR:{normalize_symbol(provider_symbol)}"

    def denormalize_symbol(self, normalized_symbol: str) -> str:
        return denormalize_symbol(normalized_symbol)

    def map_order_status(self, provider_status: str) -> str:
        return map_order_status(provider_status)

    def map_product_type(self, provider_product_type: str) -> str:
        return map_product_type(provider_product_type)

    def map_order_type(self, provider_order_type: str) -> str:
        return map_order_type(provider_order_type)

    def get_required_credentials(self) -> list[str]:
        # TWS/Gateway uses local socket auth; account_id optional from env
        return []

    def get_credential_schema(self) -> dict[str, Any]:
        return {
            "required": [],
            "optional": ["account_id", "host", "port", "client_id"],
            "notes": "TWS/IB Gateway socket credentials come from IBKR_* env vars; paper default port 7497",
        }
