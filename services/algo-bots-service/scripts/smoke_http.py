"""Smoke test against a RUNNING service over real HTTP (no broker, no orders).

    set SERVICE_HMAC_SECRET=...  (same value the server was started with)
    python scripts/smoke_http.py [base_url]
"""
import json
import os
import sys
import uuid

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8110"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.security import GatewayAuth  # noqa: E402

auth = GatewayAuth(os.environ["SERVICE_HMAC_SECRET"])
T = "smoke-tenant"


def call(method, path, user="u-admin", role="admin", **kw):
    h = auth.sign(T, user, role, uuid.uuid4().hex)
    r = httpx.request(method, BASE + path, headers=h, timeout=60, **kw)
    try:
        body = r.json()
    except ValueError:
        body = r.text[:200]
    return r.status_code, body


results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if not cond else ""))


s, b = call("GET", "/health")
check("health", s == 200 and b == {"status": "ok"})
check("unsigned request rejected", httpx.get(BASE + "/api/tradex/me").status_code == 401)
s, b = call("GET", "/api/tradex/me")
check("me (gateway admin -> platform_admin)", s == 200 and b["role"] == "platform_admin", b)
s, b = call("POST", "/api/tradex/bootstrap")
check("bootstrap 6 bots", s == 200 and b["bots_created"] == 6, b)
s, b = call("GET", "/api/tradex/bots")
check("bots listed, all STOPPED/PAPER/not live",
      s == 200 and len(b["bots"]) == 6 and all(x["desired_status"] == "STOPPED" and not x["live_enabled"] for x in b["bots"]), b)
check("no runner attached reported honestly", b["runner"]["runner_attached"] is False)
s, b = call("GET", "/api/tradex/live/status")
check("live is OFF by default", s == 200 and b["live_enabled_bots"] == [] and b["software_verified_checks"]["env_live_flag"] is False, b)
s, b = call("POST", "/api/tradex/live/activate", user="u-tadmin", role="member",
            json={"bot_id": "BOT_01_VWAP_EMA_VOLUME", "confirmation": "ENABLE LIVE TRADING FOR BOT_01_VWAP_EMA_VOLUME",
                  "attestations": {}})
check("viewer cannot activate live", s == 403, (s, b))
s, b = call("POST", "/api/tradex/backtests", json={"bot_id": "BOT_03_EMA_CROSSOVER", "days": 8, "symbols": 2})
check("synthetic backtest runs and is labelled", s == 200 and b["data_source"] == "SYNTHETIC", (s, b))
if s == 200:
    print("   backtest trade_count =", b["trade_count"], "signals =", b["signals_generated"])
s, b = call("GET", "/api/tradex/analytics/overview", params={"mode": "PAPER"})
check("analytics overview (empty paper ledger)", s == 200 and b["metrics"]["trade_count"] == 0, (s, b))
s, b = call("POST", "/api/tradex/reports/generate", json={"kind": "trades", "fmt": "csv", "mode": "PAPER"})
check("report generated", s == 200, (s, b))
if s == 200:
    r = httpx.get(BASE + f"/api/tradex/reports/{b['report_id']}/download", headers=auth.sign(T, "u-admin", "admin", uuid.uuid4().hex))
    check("report download", r.status_code == 200 and "# Mode: PAPER" in r.text, r.status_code)
s, b = call("GET", "/api/tradex/audit/verify")
check("audit chain valid", s == 200 and b["chain_valid"] is True, b)
s, b = call("GET", "/api/tradex/audit", params={"limit": 5})
print("   recent audit actions:", [x["action"] for x in b.get("items", b.get("events", []))][:5] if isinstance(b, dict) else b)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
