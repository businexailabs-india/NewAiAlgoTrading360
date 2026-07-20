"""Phase-2 readiness mixin for Indian broker adapters."""

from __future__ import annotations

import os
from typing import Any, ClassVar

from mcp_connectors.base.auth_refresh import AuthFlowType, placeholder_refresh
from mcp_connectors.base.dtos import (
    AccountProfileDTO,
    ConnectResponseDTO,
    HoldingDTO,
    MarginsDTO,
    OrderPreviewRequestDTO,
    OrderPreviewResponseDTO,
    QuoteResponseDTO,
)
from mcp_connectors.base.errors import ProviderErrorCode, map_provider_error
from mcp_connectors.base.http_client import ProviderHTTPClient
from mcp_connectors.base.models import NormalizedOrderRequest, ProviderConfig
from mcp_connectors.base.rate_limits import DEFAULT_BROKER_LIMITS, RateLimitConfig
from mcp_connectors.india._shared import PlaceholderBrokerProvider


class Phase2BrokerProvider(PlaceholderBrokerProvider):
    """Broker adapter with DTOs, fixtures, error maps, rate limits, auth refresh stubs.

    Real broker HTTP is only enabled when env credentials AND base URL are present
    and PROVIDER_ALLOW_LIVE_HTTP=true (or provider-specific *_ALLOW_LIVE_HTTP).
    """

    auth_flow: ClassVar[AuthFlowType] = AuthFlowType.API_KEY_TOKEN
    env_credential_keys: ClassVar[list[str]] = []
    env_base_url_key: ClassVar[str] = ""
    env_allow_live_key: ClassVar[str] = "PROVIDER_ALLOW_LIVE_HTTP"
    error_map: ClassVar[dict[str, ProviderErrorCode]] = {}
    rate_limit: ClassVar[RateLimitConfig] = DEFAULT_BROKER_LIMITS
    mock_fixtures: ClassVar[dict[str, Any]] = {}
    api_paths: ClassVar[dict[str, str]] = {
        "profile": "/profile",
        "margins": "/margins",
        "holdings": "/holdings",
        "positions": "/positions",
        "orders": "/orders",
        "trades": "/trades",
        "quotes": "/quotes",
        "preview": "/orders/preview",
        "refresh": "/session/refresh",
    }

    def __init__(self, config: ProviderConfig | None = None, http: ProviderHTTPClient | None = None):
        base_url = (os.getenv(self.env_base_url_key) or "").strip() if self.env_base_url_key else ""
        allow_live = self._live_http_allowed() and bool(base_url) and self.env_credentials_present()
        client = http or ProviderHTTPClient(
            base_url=base_url or "https://example.invalid",
            use_mock=not allow_live,
            fixtures=dict(self.mock_fixtures),
        )
        super().__init__(config=config, http=client)
        self._session_meta: dict[str, Any] = {}

    @classmethod
    def env_credentials_present(cls) -> bool:
        if not cls.env_credential_keys:
            return False
        required = [k for k in cls.env_credential_keys if not k.endswith("_OPTIONAL")]
        if not required:
            # Placeholder brokers with only optional keys are not "configured"
            # unless an optional key is actually set.
            return any(bool(os.getenv(k)) for k in cls.env_credential_keys)
        return all(bool(os.getenv(k)) for k in required)

    @classmethod
    def _live_http_allowed(cls) -> bool:
        for key in (cls.env_allow_live_key, "PROVIDER_ALLOW_LIVE_HTTP"):
            if not key:
                continue
            if os.getenv(key, "false").lower() in ("1", "true", "yes"):
                return True
        return False

    def get_rate_limits(self) -> dict[str, Any]:
        cfg = self.rate_limit.model_copy(update={"provider_id": self.provider_id})
        return cfg.to_dict()

    def map_error(
        self,
        *,
        raw_code: str | None = None,
        message: str = "",
        http_status: int | None = None,
    ) -> dict[str, Any]:
        return map_provider_error(
            self.provider_id,
            raw_code=raw_code,
            message=message,
            http_status=http_status,
            mapping=self.error_map,
        ).to_dict()

    async def authenticate(self) -> dict[str, Any]:
        result = await placeholder_refresh(
            self.provider_id,
            self.auth_flow,
            credentials_present=self._connected or self.env_credentials_present(),
            refresh_token_present=bool(self._session_meta.get("refresh_token_present")),
        )
        return result.model_dump(mode="json")

    async def refresh_session(self) -> dict[str, Any]:
        """Auth refresh stub — never hits broker unless live HTTP explicitly enabled."""
        if self.http.use_mock:
            result = await placeholder_refresh(
                self.provider_id,
                self.auth_flow,
                credentials_present=self._connected or self.env_credentials_present(),
                refresh_token_present=True,
            )
            self._session_meta["refresh_token_present"] = True
            return {
                **result.model_dump(mode="json"),
                "path": self.api_paths.get("refresh"),
                "live_http": False,
            }
        # Live path placeholder: issue request but adapters should override for real token exchange
        raw = await self.http.post(self.api_paths.get("refresh", "/session/refresh"), json={})
        return {"ok": True, "status": "refreshed", "provider_id": self.provider_id, "raw_redacted": True, "body_keys": list(raw.keys())}

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        cfg = dict(config or {})
        force_mock = bool(cfg.get("use_mock") or cfg.get("demo"))
        env_ready = self.env_credentials_present()
        # Merge env credentials markers only (never log values)
        if env_ready and not any(credentials.values()):
            credentials = {k: "[ENV]" for k in self.env_credential_keys if os.getenv(k)}

        if force_mock or not (credentials and any(credentials.values())):
            # Prefer mock readiness path when demo/mock requested or empty creds
            if force_mock or env_ready:
                self._mode = "mock" if force_mock or not self._live_http_allowed() else "live_ready"
                if force_mock or not (self._live_http_allowed() and bool(os.getenv(self.env_base_url_key or "", "").strip())):
                    self._mode = "mock"
                    self._connected = True
                    self._credentials = {"_present": "true"}
                    dto = ConnectResponseDTO(
                        ok=True,
                        status="connected",
                        provider_id=self.provider_id,
                        mode=self._mode,
                        masked_client_id="****0001",
                        auth_flow=self.auth_flow.value,
                        note="phase2 mock fixtures active",
                    )
                    return dto.model_dump(mode="json")
            return await super().connect(credentials, cfg)

        # Credentials provided — still mock unless live HTTP explicitly enabled
        if not (self._live_http_allowed() and (os.getenv(self.env_base_url_key or "") or "").strip()):
            self._mode = "credentials_configured_mock"
            self._connected = True
            self._credentials = {"_present": "true"}
            return ConnectResponseDTO(
                ok=True,
                status="connected",
                provider_id=self.provider_id,
                mode=self._mode,
                masked_client_id="****ENV",
                auth_flow=self.auth_flow.value,
                note="credentials present; live HTTP disabled until PROVIDER_ALLOW_LIVE_HTTP=true and base URL set",
            ).model_dump(mode="json")

        self._mode = "live_http"
        self._connected = True
        self._credentials = {"_present": "true"}
        return ConnectResponseDTO(
            ok=True,
            status="connected",
            provider_id=self.provider_id,
            mode=self._mode,
            auth_flow=self.auth_flow.value,
            note="live HTTP enabled — adapter-specific binding",
        ).model_dump(mode="json")

    def _fixture(self, method: str, path_key: str) -> dict[str, Any]:
        path = self.api_paths.get(path_key, f"/{path_key}")
        key = f"{method} {path}"
        return dict(self.mock_fixtures.get(key) or {"ok": True, "data": {}})

    async def _api_get(self, path_key: str) -> dict[str, Any]:
        path = self.api_paths.get(path_key, f"/{path_key}")
        if self.http.use_mock:
            return self._fixture("GET", path_key)
        return await self.http.get(path)

    async def get_account_profile(self) -> dict[str, Any]:
        if self._mode == "not_configured":
            return {"status": "not_configured", "provider_id": self.provider_id}
        raw = await self._api_get("profile")
        dto = self.normalize_profile(raw)
        return dto.model_dump(mode="json")

    async def get_margins(self) -> dict[str, Any]:
        if self._mode == "not_configured":
            return {"available": 0, "status": "not_configured"}
        raw = await self._api_get("margins")
        return self.normalize_margins(raw).model_dump(mode="json")

    async def get_holdings(self) -> list[dict[str, Any]]:
        if self._mode == "not_configured":
            return []
        raw = await self._api_get("holdings")
        return [h.model_dump(mode="json") for h in self.normalize_holdings(raw)]

    async def get_positions(self) -> list[dict[str, Any]]:
        if self._mode == "not_configured":
            return []
        raw = await self._api_get("positions")
        rows = raw.get("data") if isinstance(raw.get("data"), list) else raw.get("net") or raw.get("positions") or []
        if isinstance(rows, dict):
            rows = rows.get("net", []) or []
        return list(rows) if isinstance(rows, list) else []

    async def get_orders(self) -> list[dict[str, Any]]:
        if self._mode == "not_configured":
            return []
        raw = await self._api_get("orders")
        data = raw.get("data") or raw.get("orders") or []
        out = []
        for o in data if isinstance(data, list) else []:
            status = self.map_order_status(str(o.get("status") or o.get("order_status") or o.get("orderStatus") or "UNKNOWN"))
            out.append({**o, "normalized_status": status})
        return out

    async def get_trades(self) -> list[dict[str, Any]]:
        if self._mode == "not_configured":
            return []
        raw = await self._api_get("trades")
        data = raw.get("data") or raw.get("trades") or []
        return list(data) if isinstance(data, list) else []

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        if self._mode == "not_configured":
            return QuoteResponseDTO(provider_id=self.provider_id, quotes={}, mode="not_configured").model_dump()
        raw = await self._api_get("quotes")
        quotes = self.normalize_quotes(symbols, raw)
        return QuoteResponseDTO(
            provider_id=self.provider_id,
            quotes=quotes,
            mode=self._mode,
        ).model_dump(mode="json")

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        req = OrderPreviewRequestDTO(
            exchange=str(data.get("exchange") or "NSE"),
            symbol=str(data.get("symbol") or ""),
            side=str(data.get("side") or "BUY"),
            quantity=int(data.get("quantity") or 0),
            order_type=str(data.get("order_type") or "MARKET"),
            product_type=str(data.get("product_type") or "CNC"),
            price=data.get("price"),
            trigger_price=data.get("trigger_price"),
            validity=str(data.get("validity") or "DAY"),
            idempotency_key=data.get("idempotency_key"),
        )
        accepted = self._connected and self._mode != "not_configured"
        resp = OrderPreviewResponseDTO(
            accepted=accepted,
            provider_id=self.provider_id,
            estimated_margin=float(req.quantity) * float(req.price or 100.0) * 0.2,
            normalized_symbol=self.normalize_symbol(req.symbol, req.exchange),
            mapped_order_type=self.map_order_type(req.order_type),
            mapped_product_type=self.map_product_type(req.product_type),
            order_redacted=req.model_dump(),
            warnings=[] if accepted else ["provider_not_ready"],
        )
        return resp.model_dump(mode="json")

    # ---- normalization stubs (override per broker) -------------------------

    def normalize_profile(self, raw: dict[str, Any]) -> AccountProfileDTO:
        client = str(
            raw.get("client_id")
            or raw.get("dhanClientId")
            or raw.get("user_id")
            or raw.get("clientcode")
            or "0000"
        )
        return AccountProfileDTO(
            provider_id=self.provider_id,
            masked_client_id="****" + client[-4:],
            mode=self._mode,
            segments=list(self.supported_segments or []),
            extras={"raw_keys": list(raw.keys())},
        )

    def normalize_margins(self, raw: dict[str, Any]) -> MarginsDTO:
        available: Any = raw.get("available") or raw.get("availabelBalance") or raw.get("availableBalance")
        utilized: Any = raw.get("utilized") or raw.get("utilizedAmount") or 0
        equity = raw.get("equity")
        if available is None and isinstance(equity, dict):
            avail = equity.get("available") or {}
            if isinstance(avail, dict):
                available = avail.get("live_balance") or avail.get("cash")
            utilised = equity.get("utilised") or equity.get("utilized") or {}
            if isinstance(utilised, dict):
                utilized = utilised.get("debits") or utilized
        data = raw.get("data")
        if available is None and isinstance(data, dict):
            available = (
                data.get("available")
                or data.get("net")
                or data.get("availablecash")
                or (data.get("equity") or {}).get("available_margin")
            )
            utilized = (
                data.get("utilized")
                or data.get("utilisedpayout")
                or (data.get("equity") or {}).get("used_margin")
                or utilized
            )
        return MarginsDTO(
            available=float(available or 100000.0),
            utilized=float(utilized or 0),
            mode=self._mode,
            extras={"raw_keys": list(raw.keys())},
        )

    def normalize_holdings(self, raw: dict[str, Any]) -> list[HoldingDTO]:
        rows = raw.get("data") or raw.get("holdings") or []
        if not isinstance(rows, list):
            return []
        out: list[HoldingDTO] = []
        for h in rows:
            symbol = str(
                h.get("tradingSymbol")
                or h.get("tradingsymbol")
                or h.get("trading_symbol")
                or h.get("symbol")
                or ""
            )
            symbol = symbol.replace("-EQ", "")
            exchange = str(h.get("exchange") or "NSE")
            qty = int(h.get("totalQty") or h.get("quantity") or h.get("qty") or 0)
            out.append(
                HoldingDTO(
                    symbol=symbol,
                    exchange=exchange,
                    quantity=qty,
                    average_price=h.get("avgCostPrice") or h.get("average_price") or h.get("averageprice"),
                    last_price=h.get("lastTradedPrice") or h.get("last_price") or h.get("ltp"),
                    normalized_symbol=self.normalize_symbol(symbol, exchange),
                )
            )
        return out

    def normalize_quotes(self, symbols: list[str], raw: dict[str, Any]) -> dict[str, Any]:
        payload = raw.get("data") or raw.get("quotes") or raw
        out: dict[str, Any] = {}
        fetched = []
        if isinstance(payload, dict) and isinstance(payload.get("fetched"), list):
            fetched = payload["fetched"]
        for s in symbols:
            norm = self.normalize_symbol(s)
            plain = self.denormalize_symbol(norm)
            item = None
            if isinstance(payload, dict):
                item = (
                    payload.get(norm)
                    or payload.get(plain)
                    or payload.get(s)
                    or payload.get(f"NSE_EQ|{plain}")
                )
            if item is None and fetched:
                for row in fetched:
                    if str(row.get("symbol", "")).upper() in {plain, s.upper(), norm}:
                        item = row
                        break
            if isinstance(item, dict):
                out[norm] = {
                    "ltp": item.get("ltp") or item.get("last_price") or item.get("lastPrice") or 100.0,
                    "provider_id": self.provider_id,
                    "mode": self._mode,
                }
            else:
                out[norm] = {
                    "ltp": 100.0 + (sum(ord(c) for c in norm) % 50),
                    "provider_id": self.provider_id,
                    "mode": self._mode,
                }
        return out

    # ---- method stubs documenting future live binding ----------------------

    async def stub_place_order_request(self, order: dict[str, Any]) -> dict[str, Any]:
        """Build broker-specific place-order payload without executing."""
        return {
            "provider_id": self.provider_id,
            "path": self.api_paths.get("preview"),
            "payload_redacted": {
                "symbol": order.get("symbol"),
                "side": order.get("side"),
                "quantity": order.get("quantity"),
                "order_type": self.map_order_type(str(order.get("order_type") or "MARKET")),
                "product_type": self.map_product_type(str(order.get("product_type") or "CNC")),
            },
            "executed": False,
        }

    async def stub_modify_order_request(self, order_id: str, modify: dict[str, Any]) -> dict[str, Any]:
        return {"provider_id": self.provider_id, "order_id": order_id, "modify": modify, "executed": False}

    async def stub_cancel_order_request(self, order_id: str) -> dict[str, Any]:
        return {"provider_id": self.provider_id, "order_id": order_id, "executed": False}
