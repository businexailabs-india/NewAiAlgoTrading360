"""BusineX TradeX algo-bots HTTP API.

Every route: (1) verifies the gateway HMAC, (2) resolves the caller's trading role from the database,
(3) checks ONE named permission server-side, (4) scopes every query by the *verified* tenant id - tenant and
user ids are never taken from the request body or query string.

Nothing here places broker orders. Live trading is controlled only through `LiveModeGate` (env flag +
trading_admin + typed confirmation + attestations + fresh LIVE-runner heartbeat) and ENTRY orders are refused by
the library unless that gate authorises them at submission time.
"""

# NOTE: no `from __future__ import annotations` - FastAPI must resolve the locally defined Annotated aliases.
import json
import logging
import os
import threading
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from tradex_bots.analytics import Analytics
from tradex_bots.backtest import Backtester, BacktestSettings
from tradex_bots.bots import BOT_REGISTRY, create_bot, ensure_bots
from tradex_bots.config import EngineConfig, ExecutionMode
from tradex_bots.costs import FeeModel
from tradex_bots.instruments import Instrument
from tradex_bots.jobs import resolve_issue, run_data_quality, run_ledger_reconciliation
from tradex_bots.live_gate import LiveActivationError, LiveAttestations, LiveModeGate
from tradex_bots.reports import ReportError, ReportGenerator
from tradex_bots.risk import RiskEngine
from tradex_bots.store import Store, mask_id
from tradex_bots.synthetic import synth_candles
from tradex_bots.timeutil import now_ist

from app import rbac
from app.security import AuthError, GatewayAuth
from app.support import RateLimiter, check_param_changes, clean, heartbeat, live_runtime, row_dict

log = logging.getLogger("algo_bots_service")

ACCOUNT_RE = r"^[A-Za-z0-9_-]{1,64}$"
SYMBOL_RE = r"^[A-Z0-9&_-]{1,32}$"
BOT_RE = r"^BOT_[A-Z0-9_]{1,40}$"
MAX_BODY = 64 * 1024
MAX_ACCOUNTS_PER_TENANT = 10
MEDIA = {"csv": "text/csv", "pdf": "application/pdf",
         "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
Mode = Literal["PAPER", "LIVE"]


@dataclass(frozen=True)
class Principal:
    tenant_id: str
    user_id: str
    role: str
    gateway_role: str
    request_id: str


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConfigUpdate(_Body):
    params: dict[str, Any] = Field(min_length=1, max_length=40)
    expected_row_version: int = Field(ge=1)


class ReasonBody(_Body):
    reason: str = Field(min_length=5, max_length=500)


class LiveRevokeBody(ReasonBody):
    bot_id: str = Field(pattern=BOT_RE)


class AttestationsIn(_Body):
    api_permissions_verified: bool = False
    compliance_confirmed: bool = False
    static_ip_approved: bool = False
    backtest_completed: bool = False
    out_of_sample_validated: bool = False
    forward_paper_completed: bool = False
    tests_passed: bool = False
    reconciliation_tested: bool = False
    protective_exit_tested: bool = False
    notes: dict[str, Annotated[str, Field(max_length=500)]] = Field(default_factory=dict, max_length=20)


class LiveActivateBody(_Body):
    bot_id: str = Field(pattern=BOT_RE)
    confirmation: str = Field(max_length=200)
    attestations: AttestationsIn


class BacktestBody(_Body):
    bot_id: str = Field(pattern=BOT_RE)
    source: Literal["synthetic"] = "synthetic"  # no stored-data source is wired yet; see KNOWN_LIMITATIONS
    days: int = Field(10, ge=3, le=30)
    symbols: int = Field(2, ge=1, le=3)
    seed: int = Field(1, ge=0, le=1_000_000)
    slippage_scenario: Literal["optimistic", "base", "stress"] = "base"


class ReportBody(_Body):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    kind: Literal["trades", "daily_pnl", "bot_comparison", "risk_summary", "execution_quality", "costs",
                  "audit_log"]
    fmt: Literal["csv", "xlsx", "pdf"]
    mode: Mode
    account_id: str | None = Field(None, pattern=ACCOUNT_RE)
    date_from: date | None = Field(None, alias="from")
    date_to: date | None = Field(None, alias="to")


class RoleBody(_Body):
    role: Literal["platform_admin", "trading_admin", "trader", "risk_manager", "viewer"]


class ResolveBody(_Body):
    note: str = Field(min_length=5, max_length=500)


class ReconcileBody(_Body):
    mode: Mode



def create_app(*, secret: str, store: Store, report_dir: str | Path, default_account: str = "primary",
               heartbeat_max_age: int = 120, skew_seconds: int = 120, clock=now_ist,
               expose_docs: bool = False) -> FastAPI:
    auth = GatewayAuth(secret, max_skew_seconds=skew_seconds)  # raises if secret missing/short
    limiter = RateLimiter()
    reports = ReportGenerator(store, report_dir)
    analytics = Analytics(store)
    backtest_slots = threading.BoundedSemaphore(2)
    app = FastAPI(title="TradeX algo-bots service", version="0.1.0",
                  docs_url="/docs" if expose_docs else None, redoc_url=None,
                  openapi_url="/openapi.json" if expose_docs else None)

    # ------------------------------------------------------------------------------------ middleware
    @app.middleware("http")
    async def guard(request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_BODY:
            return JSONResponse({"detail": "request too large"}, status_code=413)
        resp = await call_next(request)
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url.path)  # no headers/body logged
        return JSONResponse({"detail": "internal error"}, status_code=500)

    # ------------------------------------------------------------------------------------ auth / rbac
    def principal(request: Request) -> Principal:
        try:
            ident = auth.verify(request.headers)
        except AuthError:
            raise HTTPException(401, "unauthorised") from None
        role = rbac.resolve_role(store, ident.tenant_id, ident.user_id, ident.gateway_role)
        if not limiter.allow(f"u:{ident.tenant_id}:{ident.user_id}", 300):
            raise HTTPException(429, "rate limit exceeded")
        return Principal(ident.tenant_id, ident.user_id, role, ident.gateway_role, ident.request_id)

    def need(permission: str, strict_per_minute: int | None = None):
        def dep(p: Principal = Depends(principal)) -> Principal:
            if not rbac.allowed(p.role, permission):
                if permission in rbac.AUDITED_DENIALS:
                    store.audit("api_permission_denied", tenant_id=p.tenant_id, actor=p.user_id,
                                details={"permission": permission, "role": p.role, "request_id": p.request_id})
                raise HTTPException(403, "forbidden")
            if strict_per_minute and not limiter.allow(f"s:{permission}:{p.tenant_id}:{p.user_id}",
                                                       strict_per_minute):
                raise HTTPException(429, "rate limit exceeded")
            return p
        return dep

    def audit(p: Principal, action: str, account_id: str = "", bot_id: str = "", **details) -> None:
        store.audit(action, tenant_id=p.tenant_id, account_id=account_id, bot_id=bot_id, actor=p.user_id,
                    details={**details, "role": p.role, "request_id": p.request_id})

    def acct(p: Principal, account_id: str) -> str:
        """The account must already be provisioned for THIS tenant (bots exist); otherwise 404 - never create
        or touch another tenant's account by guessing an id."""
        if not store.one("SELECT 1 FROM algo_bots WHERE tenant_id=? AND account_id=? LIMIT 1",
                         (p.tenant_id, account_id)):
            raise HTTPException(404, "account not found or not bootstrapped")
        return account_id

    def bot_row(p: Principal, account_id: str, bot_id: str):
        if bot_id not in BOT_REGISTRY:
            raise HTTPException(404, "unknown bot")
        r = store.one("SELECT * FROM algo_bots WHERE tenant_id=? AND account_id=? AND bot_id=?",
                      (p.tenant_id, account_id, bot_id))
        if r is None:
            raise HTTPException(404, "bot not provisioned for this account")
        return r

    def cfg_for(p: Principal, account_id: str) -> EngineConfig:
        return EngineConfig(tenant_id=p.tenant_id, account_id=account_id)

    def hb_for(p: Principal, account_id: str) -> dict[str, Any]:
        return heartbeat(store, p.tenant_id, account_id, clock(), heartbeat_max_age)

    def bot_view(r, hb: dict[str, Any]) -> dict[str, Any]:
        active = hb.get("runner_attached") and r["bot_id"] in hb.get("active_bots", [])
        return {"bot_id": r["bot_id"], "name": r["name"], "strategy_type": r["strategy_type"],
                "desired_status": r["status"], "runner_confirms_active": bool(active),
                "execution_mode": r["execution_mode"], "live_enabled": bool(r["live_enabled"]),
                "version": r["version"], "config_hash": r["config_hash"], "row_version": r["row_version"],
                "params": json.loads(r["config_json"] or "{}"), "updated_at": r["updated_at"],
                "updated_by": r["updated_by"]}

    AccountQ = Annotated[str, Query(pattern=ACCOUNT_RE)]

    def flt(mode: Mode = Query(...), date_from: date | None = Query(None, alias="from"),
            date_to: date | None = Query(None, alias="to"),
            account_id: str | None = Query(None, pattern=ACCOUNT_RE),
            bot_id: str | None = Query(None, pattern=BOT_RE),
            symbol: str | None = Query(None, pattern=SYMBOL_RE)) -> dict[str, Any]:
        if date_from and date_to and date_from > date_to:
            raise HTTPException(422, "'from' must not be after 'to'")
        return {"mode": mode, "d_from": date_from, "d_to": date_to,
                "accounts": [account_id] if account_id else None, "bot_id": bot_id, "symbol": symbol}

    F = Annotated[dict[str, Any], Depends(flt)]

    # ------------------------------------------------------------------------------------ health / identity
    @app.get("/health")
    def health():
        store.one("SELECT 1")
        return {"status": "ok"}

    @app.get("/api/tradex/me")
    def me(p: Principal = Depends(principal)):
        return {"tenant_id": p.tenant_id, "user_id": p.user_id, "role": p.role,
                "permissions": rbac.permissions_for(p.role)}

    # ------------------------------------------------------------------------------------ bots
    @app.post("/api/tradex/bootstrap")
    def bootstrap(account_id: AccountQ = default_account, p: Principal = Depends(need("bot_control", 20))):
        known = {r["account_id"] for r in store.query(
            "SELECT DISTINCT account_id FROM algo_bots WHERE tenant_id=?", (p.tenant_id,))}
        if account_id not in known and len(known) >= MAX_ACCOUNTS_PER_TENANT:
            raise HTTPException(409, "account limit reached for this tenant")
        n = ensure_bots(store, p.tenant_id, account_id, p.user_id)
        audit(p, "bots_bootstrapped", account_id, created=n)
        return {"account_id": account_id, "bots_created": n}

    @app.get("/api/tradex/bots")
    def list_bots(account_id: AccountQ = default_account, p: Principal = Depends(need("read"))):
        rows = store.query("SELECT * FROM algo_bots WHERE tenant_id=? AND account_id=? ORDER BY bot_id",
                           (p.tenant_id, account_id))
        hb = hb_for(p, account_id)
        return {"account_id": account_id, "bootstrapped": bool(rows),
                "runner": {k: hb.get(k) for k in ("runner_attached", "reason", "age_seconds", "mode")},
                "bots": [bot_view(r, hb) for r in rows]}

    @app.get("/api/tradex/bots/{bot_id}")
    def get_bot(bot_id: str, account_id: AccountQ = default_account, p: Principal = Depends(need("read"))):
        return bot_view(bot_row(p, account_id, bot_id), hb_for(p, account_id))

    def set_status(p: Principal, bot_id: str, account_id: str, new: str) -> dict[str, Any]:
        r = bot_row(p, account_id, bot_id)
        if new == "RUNNING":
            if r["live_enabled"] and p.role != rbac.TRADING_ADMIN:
                raise HTTPException(403, "only a trading_admin may start a live-enabled bot")
            if RiskEngine(cfg_for(p, account_id), store, FeeModel(), ExecutionMode.PAPER).kill_switch_active():
                raise HTTPException(409, "kill switch is engaged")
        store.execute("UPDATE algo_bots SET status=?, updated_at=?, updated_by=?, row_version=row_version+1 "
                      "WHERE tenant_id=? AND account_id=? AND bot_id=?",
                      (new, clock().isoformat(), p.user_id, p.tenant_id, account_id, bot_id))
        audit(p, "bot_status_changed", account_id, bot_id, previous=r["status"], new=new)
        return bot_view(bot_row(p, account_id, bot_id), hb_for(p, account_id))

    @app.post("/api/tradex/bots/{bot_id}/start")
    def start_bot(bot_id: str, account_id: AccountQ = default_account,
                  p: Principal = Depends(need("bot_control", 30))):
        return set_status(p, bot_id, acct(p, account_id), "RUNNING")

    @app.post("/api/tradex/bots/{bot_id}/pause")
    def pause_bot(bot_id: str, account_id: AccountQ = default_account,
                  p: Principal = Depends(need("bot_control", 30))):
        return set_status(p, bot_id, acct(p, account_id), "PAUSED")

    @app.post("/api/tradex/bots/{bot_id}/stop")
    def stop_bot(bot_id: str, account_id: AccountQ = default_account,
                 p: Principal = Depends(need("bot_control", 30))):
        return set_status(p, bot_id, acct(p, account_id), "STOPPED")

    @app.put("/api/tradex/bots/{bot_id}/config")
    def update_config(bot_id: str, body: ConfigUpdate, account_id: AccountQ = default_account,
                      p: Principal = Depends(need("configure", 30))):
        acct(p, account_id)
        r = bot_row(p, account_id, bot_id)
        live = bool(r["live_enabled"])
        if live and p.role != rbac.TRADING_ADMIN:
            raise HTTPException(403, "only a trading_admin may change a live-enabled bot")
        fields = set(BOT_REGISTRY[bot_id].ParamsModel.model_fields)
        problems = check_param_changes(body.params, fields)
        if problems:
            raise HTTPException(422, {"problems": problems})
        merged = {**json.loads(r["config_json"] or "{}"), **body.params}
        try:
            bot = create_bot(bot_id, merged)
        except (ValidationError, ValueError) as e:
            msgs = [f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors()] \
                if isinstance(e, ValidationError) else [str(e)]
            raise HTTPException(422, {"problems": msgs}) from None
        d = bot.describe()
        with store.tx() as c:
            cur = c.execute(
                "UPDATE algo_bots SET config_json=?, config_hash=?, updated_at=?, updated_by=?, "
                "row_version=row_version+1 WHERE tenant_id=? AND account_id=? AND bot_id=? AND row_version=?",
                (json.dumps(d["params"]), d["config_hash"], clock().isoformat(), p.user_id, p.tenant_id,
                 account_id, bot_id, body.expected_row_version))
            if cur.rowcount != 1:
                raise HTTPException(409, "bot was modified concurrently; reload and retry")
        audit(p, "bot_config_changed", account_id, bot_id, old_hash=r["config_hash"], new_hash=d["config_hash"],
              changed=sorted(body.params))
        if live:  # a new config hash was never approved for live: approval is withdrawn
            LiveModeGate(store, cfg_for(p, account_id), clock).revoke(
                bot_id=bot_id, by=p.user_id, reason="configuration changed; re-approval required")
        return bot_view(bot_row(p, account_id, bot_id), hb_for(p, account_id))

    # ------------------------------------------------------------------------------------ runtime / risk
    @app.get("/api/tradex/runtime/status")
    def runtime(account_id: AccountQ = default_account, p: Principal = Depends(need("read"))):
        hb = hb_for(p, account_id)
        return clean({"account_id": account_id, **hb})

    @app.get("/api/tradex/risk/status")
    def risk_status(account_id: AccountQ = default_account, p: Principal = Depends(need("read"))):
        acct(p, account_id)
        cfg = cfg_for(p, account_id)
        flag = store.one("SELECT value,updated_at,updated_by,reason FROM control_flags WHERE tenant_id=? AND "
                         "account_id=? AND key='kill_switch'", (p.tenant_id, account_id))
        today = clock().date().isoformat()
        daily = [row_dict(r) for r in store.query(
            "SELECT mode,trade_date,entries,realized_net,gross,charges,locked,lock_reason FROM daily_account_pnl "
            "WHERE tenant_id=? AND account_id=? AND trade_date=?", (p.tenant_id, account_id, today))]
        open_pos = store.query("SELECT mode,symbol,quantity,avg_price,planned_risk,protection_status FROM "
                               "trading_positions WHERE tenant_id=? AND account_id=? AND state!='CLOSED'",
                               (p.tenant_id, account_id))
        resv = store.one("SELECT COALESCE(SUM(amount),0) a, COUNT(*) n FROM capital_reservations WHERE tenant_id=? "
                         "AND account_id=? AND status='ACTIVE'", (p.tenant_id, account_id))
        events = [row_dict(r) for r in store.query(
            "SELECT ts,mode,bot_id,kind,severity,details FROM risk_events WHERE tenant_id=? AND account_id=? "
            "ORDER BY id DESC LIMIT 20", (p.tenant_id, account_id))]
        return clean({"account_id": account_id, "kill_switch": row_dict(flag) if flag else {"value": "OFF"},
                      "limits": cfg.risk.model_dump(), "today": daily,
                      "open_positions": [row_dict(r) for r in open_pos],
                      "open_exposure": round(sum(r["quantity"] * r["avg_price"] for r in open_pos), 2),
                      "active_reservations": {"amount": resv["a"], "count": resv["n"]}, "recent_events": events,
                      "note": "limits shown are the engine defaults for this account; per-account overrides are "
                              "not yet persisted"})

    @app.post("/api/tradex/risk/kill-switch/engage")
    def kill_engage(body: ReasonBody, account_id: AccountQ = default_account,
                    p: Principal = Depends(need("kill_engage", 10))):
        acct(p, account_id)
        RiskEngine(cfg_for(p, account_id), store, FeeModel(), ExecutionMode.PAPER).engage_kill_switch(
            body.reason, by=p.user_id)
        audit(p, "kill_switch_api_engage", account_id)
        return {"kill_switch": "ON", "account_id": account_id}

    @app.post("/api/tradex/risk/kill-switch/release")
    def kill_release(body: ReasonBody, account_id: AccountQ = default_account,
                     p: Principal = Depends(need("kill_release", 10))):
        acct(p, account_id)
        RiskEngine(cfg_for(p, account_id), store, FeeModel(), ExecutionMode.PAPER).release_kill_switch(
            p.user_id, body.reason)
        audit(p, "kill_switch_api_release", account_id)
        return {"kill_switch": "OFF", "account_id": account_id,
                "note": "live authorisations are NOT restored; bots remain in their prior desired state"}

    # ------------------------------------------------------------------------------------ live gate
    @app.get("/api/tradex/live/status")
    def live_status(account_id: AccountQ = default_account, p: Principal = Depends(need("read"))):
        acct(p, account_id)
        gate = LiveModeGate(store, cfg_for(p, account_id), clock)
        hb = hb_for(p, account_id)
        chk = gate.checklist(LiveAttestations(), live_runtime(hb))
        verifiable = {k: chk[k] for k in ("env_live_flag", "credentials_valid", "market_data_healthy",
                                          "broker_reconciled", "risk_engine_operational", "kill_switch_off",
                                          "single_live_bot")}
        live_bots = [r["bot_id"] for r in store.query(
            "SELECT bot_id FROM algo_bots WHERE tenant_id=? AND account_id=? AND live_enabled=1",
            (p.tenant_id, account_id))]
        return {"account_id": account_id, "live_enabled_bots": live_bots,
                "authorised_now": {b: gate.is_authorised(b) for b in live_bots},
                "software_verified_checks": verifiable,
                "operator_attested_checks": [k for k in chk if k not in verifiable],
                "runner": {k: hb.get(k) for k in ("runner_attached", "reason", "mode", "age_seconds")},
                "warning": "Live trading is OFF unless TRADEX_LIVE_ENABLED is set on the server AND a "
                           "trading_admin completes activation. Approval expires at the end of the IST day."}

    @app.post("/api/tradex/live/activate")
    def live_activate(body: LiveActivateBody, account_id: AccountQ = default_account,
                      p: Principal = Depends(need("live_activate", 5))):
        acct(p, account_id)
        bot_row(p, account_id, body.bot_id)
        gate = LiveModeGate(store, cfg_for(p, account_id), clock)
        att = LiveAttestations(**body.attestations.model_dump())
        try:
            res = gate.activate(bot_id=body.bot_id, operator=p.user_id, role=p.role,  # role from DB, not client
                                confirmation=body.confirmation, att=att,
                                rt=live_runtime(hb_for(p, account_id)))
        except LiveActivationError as e:
            raise HTTPException(403, str(e)) from None
        return res

    @app.post("/api/tradex/live/revoke")
    def live_revoke(body: LiveRevokeBody, account_id: AccountQ = default_account,
                    p: Principal = Depends(need("live_revoke", 20))):
        acct(p, account_id)
        bot_row(p, account_id, body.bot_id)
        LiveModeGate(store, cfg_for(p, account_id), clock).revoke(bot_id=body.bot_id, by=p.user_id,
                                                                 reason=body.reason)
        return {"bot_id": body.bot_id, "live_enabled": False}

    # ------------------------------------------------------------------------------------ orders / positions
    @app.get("/api/tradex/positions")
    def positions(mode: Mode, account_id: AccountQ = default_account,
                  state: Literal["OPEN", "CLOSED", "ALL"] = "ALL", limit: int = Query(200, ge=1, le=500),
                  offset: int = Query(0, ge=0, le=100_000), p: Principal = Depends(need("read"))):
        cond = {"OPEN": " AND state!='CLOSED'", "CLOSED": " AND state='CLOSED'", "ALL": ""}[state]
        rows = store.query("SELECT * FROM trading_positions WHERE tenant_id=? AND account_id=? AND mode=?" + cond +
                           " ORDER BY opened_at DESC LIMIT ? OFFSET ?",
                           (p.tenant_id, account_id, mode, limit, offset))
        return clean({"mode": mode, "positions": [row_dict(r, ("tenant_id",)) for r in rows]})

    def order_view(r) -> dict[str, Any]:
        d = row_dict(r, ("tenant_id", "dedupe_key"))
        d["broker_order_id"] = mask_id(d.get("broker_order_id") or "")
        return d

    @app.get("/api/tradex/orders")
    def orders(mode: Mode, account_id: AccountQ = default_account, limit: int = Query(200, ge=1, le=500),
               offset: int = Query(0, ge=0, le=100_000), p: Principal = Depends(need("read"))):
        rows = store.query("SELECT * FROM order_intents WHERE tenant_id=? AND account_id=? AND mode=? "
                           "ORDER BY created_at DESC LIMIT ? OFFSET ?",
                           (p.tenant_id, account_id, mode, limit, offset))
        return clean({"mode": mode, "orders": [order_view(r) for r in rows]})

    @app.get("/api/tradex/orders/{intent_id}")
    def order_detail(intent_id: str, p: Principal = Depends(need("read"))):
        r = store.one("SELECT * FROM order_intents WHERE intent_id=? AND tenant_id=?", (intent_id, p.tenant_id))
        if r is None:
            raise HTTPException(404, "order not found")
        ev = store.query("SELECT ts,from_state,to_state FROM order_events WHERE intent_id=? ORDER BY id",
                         (intent_id,))
        return clean({"order": order_view(r), "events": [row_dict(e) for e in ev]})

    # ------------------------------------------------------------------------------------ backtests
    @app.post("/api/tradex/backtests")
    def run_backtest(body: BacktestBody, account_id: AccountQ = default_account,
                     p: Principal = Depends(need("backtest", 10))):
        acct(p, account_id)
        r = bot_row(p, account_id, body.bot_id)
        if not backtest_slots.acquire(blocking=False):
            raise HTTPException(429, "backtest capacity busy; retry shortly")
        try:
            bot = create_bot(body.bot_id, json.loads(r["config_json"] or "{}"))
            syms = [f"SYN{i + 1}" for i in range(body.symbols)]
            data = {s: synth_candles(s, body.days, seed=body.seed + i, price0=300.0 + 150 * i, vol_spike_prob=0.15)
                    for i, s in enumerate(syms)}
            inst = {s: Instrument(s, str(10 + i)) for i, s in enumerate(syms)}
            res = Backtester(bot, data, inst, engine=cfg_for(p, account_id),
                             settings=BacktestSettings(slippage_scenario=body.slippage_scenario)).run()
            run_id = res.persist(store, p.tenant_id, account_id)
            store.execute("UPDATE backtest_runs SET data_quality=? WHERE run_id=?",
                          (json.dumps({"data_source": "SYNTHETIC", "quality": res.quality}, default=str), run_id))
        finally:
            backtest_slots.release()
        audit(p, "backtest_run", account_id, body.bot_id, run_id=run_id, source="SYNTHETIC")
        return clean({"run_id": run_id, "bot_id": body.bot_id, "data_source": "SYNTHETIC",
                      "trade_count": len(res.trades), "signals_generated": res.signals_generated,
                      "rejections": res.rejections, "metrics": res.metrics,
                      "warning": "Synthetic random-walk data. Results demonstrate pipeline mechanics only and "
                                 "are NOT evidence of profitability."})

    @app.get("/api/tradex/backtests")
    def list_backtests(limit: int = Query(50, ge=1, le=200), p: Principal = Depends(need("read"))):
        rows = store.query("SELECT run_id,account_id,bot_id,strategy_version,config_hash,symbols,date_from,date_to,"
                           "slippage_scenario,kind,created_at,data_quality FROM backtest_runs WHERE tenant_id=? "
                           "ORDER BY created_at DESC LIMIT ?", (p.tenant_id, limit))
        out = []
        for r in rows:
            d = row_dict(r)
            try:
                d["data_source"] = json.loads(d.pop("data_quality") or "{}").get("data_source", "UNKNOWN")
            except ValueError:
                d["data_source"] = "UNKNOWN"
            out.append(d)
        return {"runs": out}

    @app.get("/api/tradex/backtests/{run_id}")
    def get_backtest(run_id: str, p: Principal = Depends(need("read"))):
        r = store.one("SELECT * FROM backtest_runs WHERE run_id=? AND tenant_id=?", (run_id, p.tenant_id))
        if r is None:
            raise HTTPException(404, "backtest not found")
        d = row_dict(r, ("tenant_id",))
        for k in ("metrics_json", "params_json", "data_quality"):
            try:
                d[k] = json.loads(d[k] or "{}")
            except ValueError:
                pass
        n = store.one("SELECT COUNT(*) n FROM backtest_trades WHERE run_id=?", (run_id,))["n"]
        return clean({**d, "trade_count": n})

    # ------------------------------------------------------------------------------------ analytics
    @app.get("/api/tradex/analytics/overview")
    def a_overview(f: F, p: Principal = Depends(need("read"))):
        return clean(analytics.overview(p.tenant_id, f["mode"], accounts=f["accounts"], d_from=f["d_from"],
                                        d_to=f["d_to"], bot_id=f["bot_id"], symbol=f["symbol"]))

    @app.get("/api/tradex/analytics/trades")
    def a_trades(f: F, limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0, le=100_000),
                 p: Principal = Depends(need("read"))):
        return clean(analytics.trades(p.tenant_id, f["mode"], accounts=f["accounts"], d_from=f["d_from"],
                                      d_to=f["d_to"], bot_id=f["bot_id"], symbol=f["symbol"], limit=limit,
                                      offset=offset))

    @app.get("/api/tradex/analytics/bot-comparison")
    def a_compare(f: F, p: Principal = Depends(need("read"))):
        return clean(analytics.bot_comparison(p.tenant_id, f["mode"], accounts=f["accounts"], d_from=f["d_from"],
                                              d_to=f["d_to"]))

    @app.get("/api/tradex/analytics/pnl")
    def a_pnl(f: F, group_by: Literal["day", "bot", "symbol", "hour", "exit_reason"] = "day",
              p: Principal = Depends(need("read"))):
        return clean(analytics.pnl_breakdown(p.tenant_id, f["mode"], group_by, accounts=f["accounts"],
                                             d_from=f["d_from"], d_to=f["d_to"]))

    @app.get("/api/tradex/analytics/risk")
    def a_risk(f: F, p: Principal = Depends(need("read"))):
        return clean(analytics.risk(p.tenant_id, f["mode"], accounts=f["accounts"], d_from=f["d_from"],
                                    d_to=f["d_to"]))

    @app.get("/api/tradex/analytics/execution")
    def a_exec(f: F, p: Principal = Depends(need("read"))):
        return clean(analytics.execution_quality(p.tenant_id, f["mode"], accounts=f["accounts"],
                                                 d_from=f["d_from"], d_to=f["d_to"]))

    @app.get("/api/tradex/analytics/reconciliation")
    def a_recon(mode: Mode, p: Principal = Depends(need("read"))):
        return clean(analytics.reconciliation_summary(p.tenant_id, mode))

    # ------------------------------------------------------------------------------------ reports
    @app.get("/api/tradex/reports")
    def list_reports(limit: int = Query(100, ge=1, le=500), p: Principal = Depends(need("read"))):
        return clean({"reports": reports.list_reports(p.tenant_id, limit)})

    @app.post("/api/tradex/reports/generate")
    def generate_report(body: ReportBody, p: Principal = Depends(need("reports_generate", 20))):
        if body.kind == "audit_log" and not rbac.allowed(p.role, "audit_view"):
            raise HTTPException(403, "forbidden")
        if body.date_from and body.date_to and body.date_from > body.date_to:
            raise HTTPException(422, "'from' must not be after 'to'")
        try:
            return clean(reports.generate(
                tenant_id=p.tenant_id, kind=body.kind, fmt=body.fmt, mode=body.mode, account_id=body.account_id,
                accounts=[body.account_id] if body.account_id else None, d_from=body.date_from,
                d_to=body.date_to, generated_by=p.user_id))
        except ReportError as e:
            raise HTTPException(422, str(e)) from None
        except ImportError:
            raise HTTPException(501, "report format dependencies are not installed on this server") from None

    @app.get("/api/tradex/reports/{report_id}/download")
    def download(report_id: str, p: Principal = Depends(need("read"))):
        try:
            path, fmt = reports.open_report(p.tenant_id, report_id)
        except ReportError:
            raise HTTPException(404, "report unavailable") from None
        audit(p, "report_downloaded", report_id=report_id)
        return FileResponse(path, media_type=MEDIA[fmt], filename=f"tradex-report-{report_id[:8]}.{fmt}")

    # ------------------------------------------------------------------------------------ audit / jobs
    @app.get("/api/tradex/audit")
    def audit_log(action: str | None = Query(None, max_length=80), actor: str | None = Query(None, max_length=64),
                  date_from: date | None = Query(None, alias="from"), date_to: date | None = Query(None, alias="to"),
                  limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0, le=100_000),
                  p: Principal = Depends(need("audit_view"))):
        return clean(analytics.audit_log(p.tenant_id, action=action, actor=actor, d_from=date_from, d_to=date_to,
                                         limit=limit, offset=offset))

    @app.get("/api/tradex/audit/verify")
    def audit_verify(p: Principal = Depends(need("audit_view", 6))):
        ok, _ = store.verify_audit_chain()  # chain spans all tenants; the failing row id is deliberately withheld
        return {"chain_valid": ok, "checked_at": clock().isoformat()}

    @app.post("/api/tradex/jobs/data-quality")
    def job_dq(p: Principal = Depends(need("maintenance", 6))):
        res = run_data_quality(store, p.tenant_id)
        audit(p, "job_data_quality_run", new_issues=res.get("new_issues", {}))
        return clean(res)

    @app.post("/api/tradex/jobs/reconcile")
    def job_recon(body: ReconcileBody, p: Principal = Depends(need("maintenance", 6))):
        res = run_ledger_reconciliation(store, p.tenant_id, body.mode)
        audit(p, "job_ledger_reconciliation_run", mode=body.mode)
        return clean(res)

    @app.get("/api/tradex/data-quality/issues")
    def dq_issues(status: Literal["OPEN", "RESOLVED"] = "OPEN", limit: int = Query(200, ge=1, le=500),
                  p: Principal = Depends(need("read"))):
        rows = store.query("SELECT * FROM data_quality_issues WHERE tenant_id=? AND status=? ORDER BY id DESC "
                           "LIMIT ?", (p.tenant_id, status, limit))
        return clean({"issues": [row_dict(r, ("tenant_id",)) for r in rows]})

    @app.post("/api/tradex/data-quality/issues/{issue_id}/resolve")
    def dq_resolve(issue_id: int, body: ResolveBody, p: Principal = Depends(need("maintenance", 30))):
        resolve_issue(store, p.tenant_id, issue_id, p.user_id, body.note)
        audit(p, "data_quality_issue_resolved", issue_id=issue_id, note=body.note)
        return {"issue_id": issue_id, "status": "RESOLVED"}

    # ------------------------------------------------------------------------------------ roles
    @app.get("/api/tradex/roles")
    def list_roles(p: Principal = Depends(need("role_manage"))):
        rows = store.query("SELECT user_id,role,granted_by,granted_at,revoked_at FROM role_assignments "
                           "WHERE tenant_id=? ORDER BY user_id", (p.tenant_id,))
        return {"assignments": [row_dict(r) for r in rows], "roles": list(rbac.ROLES)}

    @app.put("/api/tradex/roles/{user_id}")
    def put_role(user_id: str, body: RoleBody, p: Principal = Depends(need("role_manage", 20))):
        _check_user_id(user_id)
        if user_id == p.user_id:
            raise HTTPException(403, "you cannot change your own role")
        prev = store.one("SELECT role,revoked_at FROM role_assignments WHERE tenant_id=? AND user_id=?",
                         (p.tenant_id, user_id))
        store.execute(
            "INSERT INTO role_assignments(tenant_id,user_id,role,granted_by,granted_at,revoked_at) "
            "VALUES(?,?,?,?,?,NULL) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=excluded.role, "
            "granted_by=excluded.granted_by, granted_at=excluded.granted_at, revoked_at=NULL",
            (p.tenant_id, user_id, body.role, p.user_id, clock().isoformat()))
        audit(p, "role_assigned", target_user=user_id, previous=prev["role"] if prev else None, new=body.role)
        return {"user_id": user_id, "role": body.role}

    @app.delete("/api/tradex/roles/{user_id}")
    def revoke_role(user_id: str, p: Principal = Depends(need("role_manage", 20))):
        _check_user_id(user_id)
        if user_id == p.user_id:
            raise HTTPException(403, "you cannot change your own role")
        store.execute("INSERT INTO role_assignments(tenant_id,user_id,role,granted_by,granted_at,revoked_at) "
                      "VALUES(?,?,'viewer',?,?,?) ON CONFLICT(tenant_id,user_id) DO UPDATE SET "
                      "role='viewer', revoked_at=excluded.revoked_at, granted_by=excluded.granted_by",
                      (p.tenant_id, user_id, p.user_id, clock().isoformat(), clock().isoformat()))
        audit(p, "role_revoked", target_user=user_id)
        return {"user_id": user_id, "role": "viewer", "revoked": True}

    def _check_user_id(user_id: str) -> None:
        import re
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", user_id):
            raise HTTPException(422, "invalid user id")

    return app


def create_app_from_env() -> FastAPI:  # uvicorn app.main:create_app_from_env --factory
    secret = os.environ.get("SERVICE_HMAC_SECRET", "")
    return create_app(
        secret=secret,  # no default: GatewayAuth refuses to start without a >=16 char secret
        store=Store(os.environ.get("ALGO_DB_PATH", "algo_bots.db")),
        report_dir=os.environ.get("ALGO_REPORT_DIR", "reports_out"),
        default_account=os.environ.get("ALGO_DEFAULT_ACCOUNT", "primary"))
