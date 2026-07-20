"""Smoke test IBKR MCP endpoints on localhost:8094."""

from __future__ import annotations

import json
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from advisory_core.security import ServiceAuth

auth = ServiceAuth("dev-service-hmac-secret-change-me")
base = "http://127.0.0.1:8094"


def call(method: str, path: str, body: dict | None = None, role: str = "user"):
    headers = auth.sign(str(uuid.uuid4()), str(uuid.uuid4()), role, str(uuid.uuid4()))
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = Request(base + path, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=15) as res:
            return res.status, json.loads(res.read().decode())
    except HTTPError as exc:
        payload = exc.read().decode()
        try:
            parsed = json.loads(payload)
        except Exception:
            parsed = {"raw": payload}
        return exc.code, parsed


def main() -> None:
    with urlopen(base + "/health", timeout=5) as r:
        print("HEALTH", r.status, r.read().decode()[:200])

    status, providers = call("GET", "/mcp/providers?country=GLOBAL")
    ibkr = [p for p in providers.get("data", []) if p.get("provider_id") == "ibkr"]
    print("PROVIDERS_GLOBAL", status, "ibkr_found=", bool(ibkr))
    if ibkr:
        print(
            "IBKR_META",
            {
                k: ibkr[0].get(k)
                for k in (
                    "provider_id",
                    "provider_name",
                    "paper_trading_default",
                    "live_trading_default",
                    "enabled",
                )
            },
        )

    status, conn = call(
        "POST",
        "/mcp/providers/ibkr/connect",
        {"credentials": {}, "config": {"use_mock": True}},
    )
    print("CONNECT", status, conn.get("data", {}).get("ok"), conn.get("data", {}).get("mode"))

    status, health = call("GET", "/mcp/providers/ibkr/health")
    print("IBKR_HEALTH", status, health.get("data", {}).get("status"))

    status, acct = call("GET", "/mcp/providers/ibkr/account-summary")
    print(
        "ACCOUNT",
        status,
        "nlv=",
        acct.get("data", {}).get("net_liquidation"),
        "masked=",
        acct.get("data", {}).get("account_id_masked"),
    )

    status, pos = call("GET", "/mcp/providers/ibkr/positions")
    print("POSITIONS", status, "count=", len(pos.get("data") or []))

    status, search = call("GET", "/mcp/providers/ibkr/contract-search?query=AAPL")
    print("SEARCH", status, "symbol=", (search.get("data") or [{}])[0].get("symbol"))

    status, quote = call("GET", "/mcp/providers/ibkr/quote/AAPL")
    print("QUOTE", status, quote.get("data", {}).get("quotes", {}).get("AAPL", {}).get("last"))

    status, preview = call(
        "POST",
        "/mcp/providers/ibkr/orders/preview",
        {"symbol": "AAPL", "side": "BUY", "quantity": 5, "order_type": "MARKET", "exchange": "SMART"},
    )
    print("PREVIEW", status, "accepted=", preview.get("data", {}).get("accepted"))

    status, paper_ai = call(
        "POST",
        "/mcp/providers/ibkr/orders/paper",
        {
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 1,
            "caller_role": "ai_advisory_service",
            "oms_order_id": "o1",
            "rms_approval_id": "r1",
            "user_approval_id": "u1",
            "idempotency_key": "k-ai",
        },
        role="ai_advisory_service",
    )
    print("PAPER_AI_BLOCKED", status, str(paper_ai).encode("ascii", "replace").decode()[:160])

    status, paper = call(
        "POST",
        "/mcp/providers/ibkr/orders/paper",
        {
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 5,
            "caller_role": "oms_service",
            "oms_order_id": "oms-smoke-1",
            "rms_approval_id": "rms-smoke-1",
            "user_approval_id": "user-smoke-1",
            "idempotency_key": "idem-smoke-1",
        },
        role="oms_service",
    )
    print(
        "PAPER_OMS",
        status,
        "order_id=",
        (paper.get("data") or {}).get("provider_order_id"),
        "status=",
        (paper.get("data") or {}).get("status"),
    )

    status, live = call(
        "POST",
        "/mcp/providers/ibkr/orders/live-disabled",
        {
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 1,
            "caller_role": "oms_service",
            "oms_order_id": "oms-live",
            "rms_approval_id": "rms-live",
            "user_approval_id": "user-live",
            "idempotency_key": "idem-live",
        },
        role="oms_service",
    )
    print("LIVE_BLOCKED", status, "blocked=", live.get("blocked"), "success=", live.get("success"))


if __name__ == "__main__":
    main()
