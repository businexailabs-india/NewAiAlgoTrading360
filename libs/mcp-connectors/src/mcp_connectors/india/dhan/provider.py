"""DhanMCPProvider — first-priority Indian MCP broker adapter."""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any, ClassVar
from uuid import uuid4

from mcp_connectors.base.auth_refresh import AuthFlowType
from mcp_connectors.base.dtos import AccountProfileDTO, MarginsDTO, OrderPreviewResponseDTO
from mcp_connectors.base.errors import ProviderErrorCode
from mcp_connectors.base.models import LiveOrderGateContext, NormalizedOrderRequest, ProviderConfig
from mcp_connectors.base.provider import LiveTradingBlockedError
from mcp_connectors.base.secrets import mask_credential
from mcp_connectors.india.dhan.auth import AUTH_FLOW
from mcp_connectors.india.dhan.connector import DhanHQConnector
from mcp_connectors.india.dhan.credentials import (
    dhan_credentials_schema,
    dhan_env_credentials_configured,
    validate_dhan_credentials,
)
from mcp_connectors.india.dhan.dtos import DhanAccountSnapshotDTO, DhanOrderStub, DhanProviderStatusDTO
from mcp_connectors.india.dhan.errors import ERROR_MAP
from mcp_connectors.india.dhan.fixtures import DHAN_SYMBOL_SECURITY_IDS, MOCK_FIXTURES
from mcp_connectors.india.dhan.rate_limits import RATE_LIMIT
from mcp_connectors.india.phase2 import Phase2BrokerProvider


class DhanMCPProvider(Phase2BrokerProvider):
    """Full Dhan account/market read path + gated live orders (disabled by default)."""

    provider_id = "dhan"
    provider_name = "Dhan / DhanHQ"
    provider_type = "broker"
    country = "IN"
    symbol_style = "dhan"
    supported_exchanges = ["NSE", "BSE", "MCX"]
    supported_segments = ["equity", "equity_derivatives", "currency", "commodity"]
    supported_asset_classes = ["stocks", "futures", "options", "commodities"]
    auth_flow: ClassVar[AuthFlowType] = AUTH_FLOW
    env_credential_keys: ClassVar[list[str]] = [
        "DHAN_CLIENT_ID",
        "DHAN_ACCESS_TOKEN",
        "DHAN_API_KEY_OPTIONAL",
    ]
    env_base_url_key: ClassVar[str] = "DHAN_BASE_URL"
    env_allow_live_key: ClassVar[str] = "DHAN_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = ERROR_MAP
    rate_limit = RATE_LIMIT
    mock_fixtures: ClassVar[dict[str, Any]] = MOCK_FIXTURES
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/v2/profile",
        "margins": "/v2/fundlimit",
        "holdings": "/v2/holdings",
        "positions": "/v2/positions",
        "orders": "/v2/orders",
        "trades": "/v2/trades",
        "quotes": "/v2/marketfeed/ltp",
        "preview": "/v2/orders",
        "refresh": "/v2/RenewToken",
    }

    def __init__(self, config: ProviderConfig | None = None, connector: DhanHQConnector | None = None, **kwargs: Any):
        # Phase2 sets http; we prefer dedicated DhanHQConnector
        super().__init__(config=config, **kwargs)
        self._audit_events: list[dict[str, Any]] = []
        self.connector = connector or DhanHQConnector(
            use_mock=True,
            fixtures=MOCK_FIXTURES,
            audit_hook=self._on_connector_audit,
        )
        self.http = self.connector.http
        self._mode = "not_configured"

    def _on_connector_audit(self, action: str, details: dict[str, Any]) -> None:
        self._audit_events.append({"action": action, "details": details, "provider_id": "dhan"})

    def get_audit_log(self) -> list[dict[str, Any]]:
        return list(self._audit_events)

    def get_credential_schema(self) -> dict[str, Any]:
        return dhan_credentials_schema()

    def get_required_credentials(self) -> list[str]:
        return list(dhan_credentials_schema()["required"])

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        cfg = dict(config or {})
        if "use_mock" in cfg:
            use_mock = bool(cfg["use_mock"])
        elif "demo" in cfg:
            use_mock = bool(cfg["demo"])
        else:
            use_mock = True
        allow_live = os.getenv("DHAN_ALLOW_LIVE_HTTP", "false").lower() in ("1", "true", "yes")
        if allow_live and not use_mock and (
            dhan_env_credentials_configured()
            or (credentials.get("client_id") and credentials.get("access_token"))
        ):
            self.connector = DhanHQConnector(
                use_mock=False,
                audit_hook=self._on_connector_audit,
            )
            self.http = self.connector.http
        else:
            # Default / safe path — mock fixtures only
            self.connector = DhanHQConnector(
                use_mock=True,
                fixtures=MOCK_FIXTURES,
                audit_hook=self._on_connector_audit,
            )
            self.http = self.connector.http

        result = await self.connector.connect(credentials)
        self._connected = bool(result.get("ok"))
        self._mode = str(result.get("mode") or ("mock" if self._connected else "not_configured"))
        self._credentials = {"_present": "true"} if self._connected else {}
        self._runtime_config = cfg
        self._audit_events.append(
            {
                "action": "provider.connect",
                "details": {
                    "ok": result.get("ok"),
                    "mode": self._mode,
                    "masked_client_id": result.get("masked_client_id"),
                },
                "provider_id": "dhan",
            }
        )
        return result

    async def disconnect(self) -> dict[str, Any]:
        result = await self.connector.disconnect()
        self._connected = False
        self._mode = "disconnected"
        return result

    async def authenticate(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": "not_configured", "provider_id": "dhan"}
        return {"ok": True, "status": "authenticated", "provider_id": "dhan", "mode": self._mode}

    async def refresh_session(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": "not_configured"}
        return await self.connector.renew_token_placeholder()

    async def health_check(self) -> dict[str, Any]:
        health = await self.connector.health_check()
        self._audit_events.append({"action": "health_check", "details": {"status": health.get("status")}, "provider_id": "dhan"})
        return health

    async def get_account_profile(self) -> dict[str, Any]:
        if not self._connected:
            return {"status": "not_configured", "provider_id": "dhan"}
        raw = await self.connector.get_profile()
        client = str(raw.get("dhanClientId") or "0000")
        dto = AccountProfileDTO(
            provider_id="dhan",
            masked_client_id=mask_credential(client),
            mode=self._mode,
            segments=["EQ", "FNO", "CURRENCY", "COMMODITY"],
            extras={
                "active_segment": raw.get("activeSegment"),
                "token_validity": raw.get("tokenValidity"),
                "data_plan": raw.get("dataPlan"),
            },
        )
        return dto.model_dump(mode="json")

    async def get_accounts(self) -> list[dict[str, Any]]:
        profile = await self.get_account_profile()
        if profile.get("status") == "not_configured":
            return []
        return [{"account_id": "dhan-primary", "profile": profile}]

    async def get_margins(self) -> dict[str, Any]:
        if not self._connected:
            return {"available": 0, "status": "not_configured"}
        raw = await self.connector.get_fund_limit()
        dto = MarginsDTO(
            available=float(raw.get("availabelBalance") or raw.get("availableBalance") or 0),
            utilized=float(raw.get("utilizedAmount") or 0),
            currency="INR",
            mode=self._mode,
            extras={
                "sod_limit": raw.get("sodLimit"),
                "withdrawable": raw.get("withdrawableBalance"),
                "collateral": raw.get("collateralAmount"),
            },
        )
        return dto.model_dump(mode="json")

    async def get_holdings(self) -> list[dict[str, Any]]:
        if not self._connected:
            return []
        raw = await self.connector.get_holdings()
        out = []
        for h in raw.get("data") or []:
            symbol = str(h.get("tradingSymbol") or "")
            exchange = str(h.get("exchange") or "NSE")
            out.append(
                {
                    "symbol": symbol,
                    "exchange": exchange,
                    "quantity": int(h.get("totalQty") or h.get("quantity") or 0),
                    "available_qty": int(h.get("availableQty") or h.get("totalQty") or 0),
                    "average_price": h.get("avgCostPrice"),
                    "last_price": h.get("lastTradedPrice"),
                    "isin": h.get("isin"),
                    "security_id": h.get("securityId"),
                    "normalized_symbol": self.normalize_symbol(symbol, exchange),
                }
            )
        return out

    async def get_positions(self) -> list[dict[str, Any]]:
        if not self._connected:
            return []
        raw = await self.connector.get_positions()
        out = []
        for p in raw.get("data") or []:
            out.append(
                {
                    "symbol": p.get("tradingSymbol"),
                    "exchange_segment": p.get("exchangeSegment"),
                    "product_type": self.map_product_type(str(p.get("productType") or "INTRADAY")),
                    "quantity": int(p.get("netQty") or 0),
                    "average_price": p.get("costPrice") or p.get("netPrice"),
                    "last_price": p.get("lastTradedPrice"),
                    "unrealized_pnl": p.get("unrealizedProfit"),
                    "realized_pnl": p.get("realizedProfit"),
                    "position_type": p.get("positionType"),
                    "normalized_status": "OPEN" if int(p.get("netQty") or 0) != 0 else "CLOSED",
                }
            )
        return out

    async def get_orders(self) -> list[dict[str, Any]]:
        """Order book — normalized statuses."""
        if not self._connected:
            return []
        raw = await self.connector.get_orders()
        out = []
        for o in raw.get("data") or []:
            out.append(
                {
                    "provider_order_id": o.get("orderId"),
                    "exchange_order_id": o.get("exchangeOrderId"),
                    "symbol": o.get("tradingSymbol"),
                    "side": o.get("transactionType"),
                    "quantity": o.get("quantity"),
                    "filled_qty": o.get("filledQty"),
                    "price": o.get("price"),
                    "product_type": self.map_product_type(str(o.get("productType") or "CNC")),
                    "order_type": self.map_order_type(str(o.get("orderType") or "MARKET")),
                    "status": self.map_order_status(str(o.get("orderStatus") or "UNKNOWN")),
                    "raw_status": o.get("orderStatus"),
                    "created_at": o.get("createTime"),
                    "updated_at": o.get("updateTime"),
                }
            )
        return out

    async def get_trades(self) -> list[dict[str, Any]]:
        """Trade book."""
        if not self._connected:
            return []
        raw = await self.connector.get_trades()
        out = []
        for t in raw.get("data") or []:
            out.append(
                {
                    "provider_order_id": t.get("orderId"),
                    "exchange_trade_id": t.get("exchangeTradeId"),
                    "symbol": t.get("tradingSymbol"),
                    "side": t.get("transactionType"),
                    "quantity": t.get("tradedQuantity"),
                    "price": t.get("tradedPrice"),
                    "product_type": self.map_product_type(str(t.get("productType") or "CNC")),
                    "traded_at": t.get("createTime"),
                }
            )
        return out

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        if not self._connected:
            return {"quotes": {}, "status": "not_configured"}
        data = await self.connector.get_ltp_placeholder(symbols)
        data["provider_id"] = "dhan"
        return data

    async def get_account_snapshot(self) -> dict[str, Any]:
        snap = DhanAccountSnapshotDTO(
            mode=self._mode,
            profile=await self.get_account_profile(),
            margins=await self.get_margins(),
            holdings=await self.get_holdings(),
            positions=await self.get_positions(),
            orders=await self.get_orders(),
            trades=await self.get_trades(),
            health=await self.health_check(),
            live_order_execution=False,
            secrets_included=False,
        )
        self._audit_events.append({"action": "account_snapshot", "details": {"mode": self._mode}, "provider_id": "dhan"})
        return snap.model_dump(mode="json")

    async def get_provider_status_for_assistant(self) -> dict[str, Any]:
        """DhanLaxmi-safe status — masked, no secrets."""
        if not self._connected:
            return DhanProviderStatusDTO(
                connected=False,
                health_status="disconnected",
                message="Dhan account connected nahi hai. Connect mock/demo Dhan pehle.",
            ).model_dump(mode="json")
        profile = await self.get_account_profile()
        margins = await self.get_margins()
        holdings = await self.get_holdings()
        positions = await self.get_positions()
        orders = await self.get_orders()
        health = await self.health_check()
        open_orders = [o for o in orders if o.get("status") in ("PENDING", "OPEN", "PARTIALLY_FILLED")]
        return DhanProviderStatusDTO(
            connected=True,
            health_status=str(health.get("status") or "connected"),
            mode=self._mode,
            masked_client_id=profile.get("masked_client_id"),
            available_margin=float(margins.get("available") or 0),
            holdings_count=len(holdings),
            open_positions_count=len([p for p in positions if int(p.get("quantity") or 0) != 0]),
            open_orders_count=len(open_orders),
            live_trading_enabled=False,
            message="Dhan account connected. Live trading disabled by default.",
        ).model_dump(mode="json")

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        symbol = str(data.get("symbol") or "")
        exchange = str(data.get("exchange") or "NSE")
        qty = int(data.get("quantity") or 0)
        side = str(data.get("side") or "BUY").upper()
        order_type = self.map_order_type(str(data.get("order_type") or "MARKET"))
        product = self.map_product_type(str(data.get("product_type") or "CNC"))
        price = float(data.get("price") or 0)
        plain = symbol.split(":")[-1].upper()
        security_id = DHAN_SYMBOL_SECURITY_IDS.get(plain, "")
        stub = DhanOrderStub(
            transactionType=side,
            exchangeSegment="NSE_EQ" if exchange.upper() == "NSE" else exchange,
            productType="CNC" if product in ("CNC", "DELIVERY") else "INTRADAY",
            orderType=order_type if order_type in ("MARKET", "LIMIT") else "MARKET",
            securityId=security_id,
            quantity=qty,
            price=price,
            triggerPrice=float(data.get("trigger_price") or 0),
            correlationId=str(data.get("idempotency_key") or uuid4()),
        )
        estimated = qty * (price or 2550.0) * (1.0 if product in ("CNC", "DELIVERY") else 0.2)
        margins = await self.get_margins() if self._connected else {"available": 0}
        accepted = self._connected and qty > 0 and bool(symbol)
        if accepted and estimated > float(margins.get("available") or 0):
            accepted = False
        resp = OrderPreviewResponseDTO(
            accepted=accepted,
            provider_id="dhan",
            estimated_margin=estimated,
            normalized_symbol=self.normalize_symbol(symbol, exchange),
            mapped_order_type=order_type,
            mapped_product_type=product,
            order_redacted={
                "symbol": plain,
                "side": side,
                "quantity": qty,
                "order_type": order_type,
                "product_type": product,
                "price": price or None,
                "idempotency_key": stub.correlationId,
            },
            warnings=[] if accepted else ["preview_rejected_or_insufficient_margin"],
        )
        out = resp.model_dump(mode="json")
        out["broker"] = "dhan"
        out["dhan_order_stub"] = stub.model_dump(mode="json")
        out["live_execution"] = False
        self._audit_events.append(
            {
                "action": "order.preview",
                "details": {"symbol": plain, "side": side, "quantity": qty, "accepted": accepted},
                "provider_id": "dhan",
            }
        )
        return out

    async def place_order_disabled_by_default(
        self,
        order_request: NormalizedOrderRequest | dict[str, Any],
        gate: LiveOrderGateContext | None = None,
    ):
        try:
            return await super().place_order_disabled_by_default(order_request, gate=gate)
        except LiveTradingBlockedError as exc:
            self._audit_events.append(
                {
                    "action": "order.live_blocked",
                    "details": {"reason": str(exc)},
                    "provider_id": "dhan",
                }
            )
            raise

    def _to_order_request(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> NormalizedOrderRequest:
        if isinstance(order_request, NormalizedOrderRequest):
            return order_request
        return NormalizedOrderRequest.model_validate(order_request)

    def _dhan_order_payload(self, req: NormalizedOrderRequest) -> dict[str, Any]:
        plain = req.symbol.split(":")[-1].upper()
        sec = DHAN_SYMBOL_SECURITY_IDS.get(plain, plain)
        side = (req.side or "BUY").upper()
        product = (req.product_type or "CNC").upper()
        if product in ("MIS", "INTRADAY"):
            product = "INTRADAY"
        elif product not in ("CNC", "MARGIN", "MTF"):
            product = "CNC"
        order_type = (req.order_type or "MARKET").upper()
        payload: dict[str, Any] = {
            "dhanClientId": getattr(self.connector, "_client_id", "") or "",
            "transactionType": side,
            "exchangeSegment": "NSE_EQ" if req.exchange.upper() in ("NSE", "NSE_EQ") else req.exchange,
            "productType": product,
            "orderType": order_type,
            "validity": (req.validity or "DAY").upper(),
            "securityId": str(sec),
            "tradingSymbol": plain,
            "quantity": int(req.quantity),
            "correlationId": req.idempotency_key[:30] if req.idempotency_key else None,
        }
        if order_type == "LIMIT" and req.price is not None:
            payload["price"] = float(req.price)
        if req.trigger_price is not None:
            payload["triggerPrice"] = float(req.trigger_price)
        return {k: v for k, v in payload.items() if v is not None}

    async def _place_live_order(
        self, order_request: NormalizedOrderRequest | dict[str, Any]
    ) -> NormalizedOrderResponse:
        """Real Dhan place — only after gates. Refuses mock connector mode."""
        from mcp_connectors.base.models import NormalizedOrderResponse

        if self.connector.use_mock:
            raise LiveTradingBlockedError(
                "Live order blocked: Dhan connector is in use_mock mode. "
                "Set DHAN_USE_MOCK=false and DHAN_ALLOW_LIVE_HTTP=true for live HTTP."
            )
        req = self._to_order_request(order_request)
        payload = self._dhan_order_payload(req)
        raw = await self.connector.place_order(payload)
        status = str(raw.get("orderStatus") or "SUBMITTED").upper()
        self._audit_events.append(
            {
                "action": "order.live_placed",
                "details": {
                    "provider_order_id": raw.get("orderId"),
                    "symbol": req.symbol,
                    "side": req.side,
                    "quantity": req.quantity,
                    "status": status,
                },
                "provider_id": "dhan",
            }
        )
        return NormalizedOrderResponse(
            provider_id="dhan",
            provider_order_id=str(raw.get("orderId") or ""),
            status=status,
            message="Dhan live order submitted via gated OMS path",
            raw_response_redacted={
                k: v for k, v in raw.items() if "token" not in k.lower() and "secret" not in k.lower()
            },
        )

    async def _modify_live_order(
        self, order_id: str, modify_request: dict[str, Any]
    ) -> NormalizedOrderResponse:
        from mcp_connectors.base.models import NormalizedOrderResponse

        if self.connector.use_mock:
            raise LiveTradingBlockedError("Live modify blocked: connector use_mock=true")
        raw = await self.connector.modify_order(order_id, modify_request)
        return NormalizedOrderResponse(
            provider_id="dhan",
            provider_order_id=str(raw.get("orderId") or order_id),
            status=str(raw.get("orderStatus") or "PENDING"),
            message="Dhan live order modify submitted",
            raw_response_redacted={k: v for k, v in raw.items() if "token" not in k.lower()},
        )

    async def _cancel_live_order(self, order_id: str) -> NormalizedOrderResponse:
        from mcp_connectors.base.models import NormalizedOrderResponse

        if self.connector.use_mock:
            raise LiveTradingBlockedError("Live cancel blocked: connector use_mock=true")
        raw = await self.connector.cancel_order(order_id)
        return NormalizedOrderResponse(
            provider_id="dhan",
            provider_order_id=str(raw.get("orderId") or order_id),
            status=str(raw.get("orderStatus") or "CANCELLED"),
            message="Dhan live order cancel submitted",
            raw_response_redacted={k: v for k, v in raw.items() if "token" not in k.lower()},
        )

    async def get_instruments(self) -> list[dict[str, Any]]:
        return [
            {"exchange": "NSE", "segment": "EQ", "symbol": s, "provider_symbol": s, "security_id": sid}
            for s, sid in DHAN_SYMBOL_SECURITY_IDS.items()
        ]

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        q = (query or "").upper()
        return [i for i in await self.get_instruments() if q in i["symbol"]]

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        if not self._connected:
            return []
        # Deterministic mock bars (not claiming live Dhan historical binding)
        price = 2500.0 if "RELIANCE" in str(symbol).upper() else 100.0
        return [
            {
                "symbol": symbol,
                "timeframe": timeframe,
                "open": price + i * 0.5,
                "high": price + i * 0.5 + 2,
                "low": price + i * 0.5 - 2,
                "close": price + i * 0.5 + 1,
                "volume": 10000 + i * 100,
            }
            for i in range(40)
        ]

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"symbol": symbol, "expiry": expiry, "chain": [], "provider_id": "dhan", "note": "placeholder"}

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        self._subscribed.update(symbols)
        return {"ok": self._connected, "subscribed": list(self._subscribed), "mode": "placeholder"}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        for s in symbols:
            self._subscribed.discard(s)
        return {"ok": True, "subscribed": list(self._subscribed)}


# Explicit alias requested by product naming
DhanHQConnectorProvider = DhanMCPProvider
