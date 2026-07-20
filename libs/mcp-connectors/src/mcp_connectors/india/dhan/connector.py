"""DhanHQConnector — low-level DhanHQ HTTP client (mock by default)."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable

from mcp_connectors.base.http_client import ProviderHTTPClient
from mcp_connectors.base.secrets import mask_credential
from mcp_connectors.india.dhan.credentials import (
    dhan_env_credentials_configured,
    load_dhan_credentials_from_env,
    validate_dhan_credentials,
)
from mcp_connectors.india.dhan.errors import map_error
from mcp_connectors.india.dhan.fixtures import DHAN_SYMBOL_SECURITY_IDS, MOCK_FIXTURES

logger = logging.getLogger("mcp.dhan.connector")

AuditHook = Callable[[str, dict[str, Any]], None]


class DhanHQConnector:
    """Thin DhanHQ REST connector. Never logs tokens or client secrets."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        use_mock: bool | None = None,
        fixtures: dict[str, Any] | None = None,
        audit_hook: AuditHook | None = None,
        http: ProviderHTTPClient | None = None,
    ):
        env_base = (base_url or os.getenv("DHAN_BASE_URL") or "https://api.dhan.co").rstrip("/")
        allow_live = os.getenv("DHAN_ALLOW_LIVE_HTTP", "false").lower() in ("1", "true", "yes")
        explicit_mock = os.getenv("DHAN_USE_MOCK", "true").lower() in ("1", "true", "yes")
        if use_mock is None:
            use_mock = explicit_mock or not allow_live or not dhan_env_credentials_configured()
        self.use_mock = bool(use_mock)
        self.base_url = env_base
        self.http = http or ProviderHTTPClient(
            base_url=self.base_url,
            use_mock=self.use_mock,
            fixtures=fixtures or MOCK_FIXTURES,
        )
        self._client_id = ""
        self._access_token = ""
        self._api_key = ""
        self._connected = False
        self._audit_hook = audit_hook
        self.last_latency_ms: float | None = None

    def _audit(self, action: str, details: dict[str, Any]) -> None:
        safe = {
            k: ("[REDACTED]" if any(s in k.lower() for s in ("token", "secret", "password", "authorization")) else v)
            for k, v in details.items()
        }
        logger.info("dhan_audit action=%s details=%s", action, safe)
        if self._audit_hook:
            self._audit_hook(action, safe)

    def _auth_headers(self) -> dict[str, str]:
        # Values used only for live HTTP; mock path ignores them.
        return {
            "access-token": self._access_token or "",
            "client-id": self._client_id or "",
            "Content-Type": "application/json",
        }

    async def connect(self, credentials: dict[str, str] | None = None) -> dict[str, Any]:
        creds = dict(credentials or {})
        if not creds.get("client_id") or not creds.get("access_token"):
            env_creds = load_dhan_credentials_from_env()
            creds = {**env_creds, **{k: v for k, v in creds.items() if v}}

        if self.use_mock and not (creds.get("client_id") and creds.get("access_token")):
            # Demo mock path
            self._client_id = "1112656215"
            self._access_token = "mock-token"
            self._connected = True
            self._audit("connect", {"mode": "mock", "masked_client_id": mask_credential(self._client_id)})
            return {
                "ok": True,
                "status": "connected",
                "mode": "mock",
                "provider_id": "dhan",
                "masked_client_id": mask_credential(self._client_id),
            }

        schema = validate_dhan_credentials(creds)
        if not schema["ok"]:
            self._connected = False
            self._audit("connect_failed", {"reason": "credentials", "missing": schema["missing"]})
            return {"ok": False, "status": "not_configured", "provider_id": "dhan", "missing": schema["missing"]}

        self._client_id = str(creds["client_id"])
        self._access_token = str(creds["access_token"])
        self._api_key = str(creds.get("api_key") or "")
        self._connected = True
        mode = "mock" if self.use_mock else "live_http"
        self._audit(
            "connect",
            {
                "mode": mode,
                "masked_client_id": mask_credential(self._client_id),
                "live_http": not self.use_mock,
            },
        )
        return {
            "ok": True,
            "status": "connected",
            "mode": mode,
            "provider_id": "dhan",
            "masked_client_id": mask_credential(self._client_id),
        }

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        self._access_token = ""
        self._client_id = ""
        await self.http.aclose()
        self._audit("disconnect", {"ok": True})
        return {"ok": True, "status": "disconnected", "provider_id": "dhan"}

    async def _get(self, path: str) -> dict[str, Any]:
        started = time.perf_counter()
        try:
            if self.use_mock:
                data = await self.http.get(path)
            else:
                data = await self.http.get(path, headers=self._auth_headers())
            self.last_latency_ms = (time.perf_counter() - started) * 1000
            self._audit("api_get", {"path": path, "latency_ms": self.last_latency_ms, "ok": True})
            return data
        except Exception as exc:  # noqa: BLE001
            self.last_latency_ms = (time.perf_counter() - started) * 1000
            err = map_error(message=str(exc), http_status=None)
            self._audit("api_get_error", {"path": path, "error_code": err.code.value})
            raise

    async def get_profile(self) -> dict[str, Any]:
        return await self._get("/v2/profile")

    async def get_fund_limit(self) -> dict[str, Any]:
        return await self._get("/v2/fundlimit")

    async def get_holdings(self) -> dict[str, Any]:
        return await self._get("/v2/holdings")

    async def get_positions(self) -> dict[str, Any]:
        return await self._get("/v2/positions")

    async def get_orders(self) -> dict[str, Any]:
        return await self._get("/v2/orders")

    async def get_trades(self) -> dict[str, Any]:
        return await self._get("/v2/trades")

    async def get_ltp_placeholder(self, symbols: list[str]) -> dict[str, Any]:
        """Quote placeholder — uses fixture LTP map; does not require live marketfeed subscription."""
        raw = await self._get("/v2/marketfeed/ltp")
        data = raw.get("data") or {}
        quotes: dict[str, Any] = {}
        nse = data.get("NSE_EQ") if isinstance(data, dict) else None
        for sym in symbols:
            plain = sym.split(":")[-1].upper()
            sec = DHAN_SYMBOL_SECURITY_IDS.get(plain)
            ltp = 100.0
            if isinstance(nse, dict) and sec and sec in nse:
                ltp = float(nse[sec].get("last_price") or 100.0)
            elif isinstance(data, dict) and plain in data:
                ltp = float((data[plain] or {}).get("ltp") or (data[plain] or {}).get("last_price") or 100.0)
            quotes[f"NSE:{plain}"] = {
                "ltp": ltp,
                "security_id": sec,
                "exchange": "NSE",
                "source": "dhan_mock_ltp" if self.use_mock else "dhan_ltp",
                "placeholder": self.use_mock,
            }
        return {"quotes": quotes, "mode": "mock" if self.use_mock else "live"}

    async def renew_token_placeholder(self) -> dict[str, Any]:
        raw = await self.http.post("/v2/RenewToken", headers=self._auth_headers() if not self.use_mock else {})
        self._audit("refresh_session", {"ok": True, "live_http": not self.use_mock})
        # Never return raw access token
        return {
            "ok": True,
            "status": "refreshed",
            "expiryTime": raw.get("expiryTime"),
            "access_token": "[REDACTED]",
        }

    async def place_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        """POST /v2/orders — used only after LiveOrderGateContext passes (provider-level)."""
        if not self._connected:
            raise RuntimeError("dhan_not_connected")
        started = time.perf_counter()
        headers = self._auth_headers() if not self.use_mock else {}
        # When use_mock=False but http still mock (tests), post uses fixture
        data = await self.http.post("/v2/orders", json=payload, headers=headers)
        self.last_latency_ms = (time.perf_counter() - started) * 1000
        self._audit(
            "api_place_order",
            {
                "path": "/v2/orders",
                "latency_ms": self.last_latency_ms,
                "symbol": payload.get("tradingSymbol") or payload.get("securityId"),
                "side": payload.get("transactionType"),
                "quantity": payload.get("quantity"),
                "use_mock": self.use_mock,
                "order_id": data.get("orderId"),
            },
        )
        return data

    async def modify_order(self, order_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            raise RuntimeError("dhan_not_connected")
        started = time.perf_counter()
        headers = self._auth_headers() if not self.use_mock else {}
        path = f"/v2/orders/{order_id}"
        # Prefer PUT /v2/orders with orderId in body for fixture key compatibility
        body = {**payload, "orderId": order_id}
        try:
            data = await self.http.put("/v2/orders", json=body, headers=headers)
        except Exception:  # noqa: BLE001
            data = await self.http.put(path, json=payload, headers=headers)
        self.last_latency_ms = (time.perf_counter() - started) * 1000
        self._audit(
            "api_modify_order",
            {"order_id": order_id, "latency_ms": self.last_latency_ms, "use_mock": self.use_mock},
        )
        return data

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        if not self._connected:
            raise RuntimeError("dhan_not_connected")
        started = time.perf_counter()
        headers = self._auth_headers() if not self.use_mock else {}
        try:
            data = await self.http.delete("/v2/orders", json={"orderId": order_id}, headers=headers)
        except Exception:  # noqa: BLE001
            data = await self.http.delete(f"/v2/orders/{order_id}", headers=headers)
        self.last_latency_ms = (time.perf_counter() - started) * 1000
        self._audit(
            "api_cancel_order",
            {"order_id": order_id, "latency_ms": self.last_latency_ms, "use_mock": self.use_mock},
        )
        return data

    async def health_check(self) -> dict[str, Any]:
        if not self._connected:
            return {"ok": False, "status": "disconnected", "provider_id": "dhan"}
        started = time.perf_counter()
        try:
            profile = await self.get_profile()
            latency = (time.perf_counter() - started) * 1000
            return {
                "ok": True,
                "status": "connected",
                "provider_id": "dhan",
                "mode": "mock" if self.use_mock else "live_http",
                "latency_ms": latency,
                "masked_client_id": mask_credential(str(profile.get("dhanClientId") or self._client_id)),
                "token_validity": profile.get("tokenValidity"),
            }
        except Exception as exc:  # noqa: BLE001
            err = map_error(message=str(exc))
            return {
                "ok": False,
                "status": "unhealthy",
                "provider_id": "dhan",
                "error": err.to_dict(),
            }
