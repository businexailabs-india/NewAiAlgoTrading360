from __future__ import annotations

import json
import time
import uuid

import pytest
from app.main import create_app
from app.security import GatewayAuth
from fastapi.testclient import TestClient
from tradex_bots.store import Store
from tradex_bots.timeutil import now_ist

SECRET = "unit-test-secret-0123456789"
A, B = "tenantA", "tenantB"
ACCT = "primary"
BOT1 = "BOT_01_VWAP_EMA_VOLUME"


class Env:
    def __init__(self, tmp_path):
        self.store = Store(":memory:")
        self.app = create_app(secret=SECRET, store=self.store, report_dir=tmp_path / "reports")
        self.c = TestClient(self.app, raise_server_exceptions=False)
        self.signer = GatewayAuth(SECRET)

    def h(self, tenant=A, user="u-admin", gw="admin", rid=None):
        return self.signer.sign(tenant, user, gw, rid or uuid.uuid4().hex)

    def role(self, tenant, user, role):
        self.store.execute(
            "INSERT OR REPLACE INTO role_assignments(tenant_id,user_id,role,granted_by,granted_at) VALUES(?,?,?,?,?)",
            (tenant, user, role, "test", now_ist().isoformat()))

    def call(self, method, path, *, tenant=A, user="u-admin", gw="admin", **kw):
        return self.c.request(method, path, headers=self.h(tenant, user, gw), **kw)

    def as_role(self, role, method, path, tenant=A, **kw):
        user = f"u-{role}"
        self.role(tenant, user, role)
        return self.call(method, path, tenant=tenant, user=user, gw="member", **kw)


@pytest.fixture()
def env(tmp_path):
    return Env(tmp_path)


@pytest.fixture()
def boot(env):
    assert env.call("POST", "/api/tradex/bootstrap").status_code == 200
    return env


def heartbeat(env, tenant=A, mode="LIVE", ok=True):
    env.store.health_event("runner_heartbeat", "OK", {
        "mode": mode, "active": [BOT1], "credentials_valid": ok, "market_data_healthy": ok,
        "broker_reconciled": ok, "risk_engine_operational": ok}, tenant_id=tenant, account_id=ACCT)


ATT = {k: True for k in ("api_permissions_verified", "compliance_confirmed", "static_ip_approved",
                         "backtest_completed", "out_of_sample_validated", "forward_paper_completed",
                         "tests_passed", "reconciliation_tested", "protective_exit_tested")}


# ============================================================================================ authentication
def test_service_refuses_to_start_without_a_real_secret(tmp_path):
    for bad in ("", "short", "x" * 15):
        with pytest.raises(ValueError):
            create_app(secret=bad, store=Store(":memory:"), report_dir=tmp_path)


def test_health_is_public_but_everything_else_needs_signature(env):
    assert env.c.get("/health").json() == {"status": "ok"}
    assert env.c.get("/api/tradex/me").status_code == 401
    assert env.c.get("/api/tradex/bots").status_code == 401


def test_bad_signature_stale_timestamp_and_tampered_role_are_rejected(env):
    h = env.h()
    h["X-Service-Signature"] = "0" * 64
    assert env.c.get("/api/tradex/me", headers=h).status_code == 401
    stale = env.signer.sign(A, "u1", "admin", uuid.uuid4().hex, ts=int(time.time()) - 3600)
    assert env.c.get("/api/tradex/me", headers=stale).status_code == 401
    h = env.signer.sign(A, "u1", "member", uuid.uuid4().hex)
    h["X-User-Role"] = "admin"  # privilege escalation attempt
    assert env.c.get("/api/tradex/me", headers=h).status_code == 401
    h = env.signer.sign(A, "u1", "member", uuid.uuid4().hex)
    h["X-Tenant-Id"] = B  # tenant swap
    assert env.c.get("/api/tradex/me", headers=h).status_code == 401


def test_replayed_request_id_is_rejected(env):
    h = env.h()
    assert env.c.get("/api/tradex/me", headers=h).status_code == 200
    assert env.c.get("/api/tradex/me", headers=h).status_code == 401


def test_delimiter_injection_in_identity_is_rejected(env):
    # "a:b" + user "c" would produce the same signed payload as tenant "a" + user "b:c"
    h = env.signer.sign("a:b", "c", "admin", uuid.uuid4().hex)
    assert env.c.get("/api/tradex/me", headers=h).status_code == 401


def test_auth_failures_are_indistinguishable(env):
    bodies = set()
    h = env.h(); h["X-Service-Signature"] = "bad"; bodies.add(env.c.get("/api/tradex/me", headers=h).text)
    bodies.add(env.c.get("/api/tradex/me").text)
    bodies.add(env.c.get("/api/tradex/me", headers=env.signer.sign(A, "u", "x", "short")).text)
    assert len(bodies) == 1


def test_docs_and_openapi_not_exposed(env):
    assert env.c.get("/docs").status_code == 404
    assert env.c.get("/openapi.json").status_code == 404


def test_oversized_body_rejected(env):
    r = env.c.post("/api/tradex/bootstrap", headers={**env.h(), "Content-Length": "999999"}, content=b"{}")
    assert r.status_code == 413


# ============================================================================================ rbac
def test_role_resolution_rules(env):
    me = lambda **kw: env.call("GET", "/api/tradex/me", **kw).json()["role"]  # noqa: E731
    assert me(user="u1", gw="member") == "viewer"        # least privilege by default
    assert me(user="u2", gw="admin") == "platform_admin"  # tenant admin hint only when no assignment
    env.role(A, "u3", "trader")
    assert me(user="u3", gw="admin") == "trader"          # explicit assignment wins over the gateway hint
    env.role(A, "u4", "viewer")
    assert me(user="u4", gw="owner") == "viewer"          # an explicit downgrade is respected


PERM_CASES = [  # (method, path, json body, permission)
    ("POST", "/api/tradex/risk/kill-switch/engage", {"reason": "unit test engage"}, "kill_engage"),
    ("POST", "/api/tradex/risk/kill-switch/release", {"reason": "unit test release"}, "kill_release"),
    ("POST", "/api/tradex/live/activate", {"bot_id": BOT1, "confirmation": "x", "attestations": {}}, "live_activate"),
    ("POST", "/api/tradex/live/revoke", {"bot_id": BOT1, "reason": "unit test revoke"}, "live_revoke"),
    ("POST", "/api/tradex/reports/generate", {"kind": "trades", "fmt": "csv", "mode": "PAPER"}, "reports_generate"),
    ("GET", "/api/tradex/audit", None, "audit_view"),
    ("GET", "/api/tradex/roles", None, "role_manage"),
    ("POST", "/api/tradex/jobs/data-quality", None, "maintenance"),
    ("POST", f"/api/tradex/bots/{BOT1}/start", None, "bot_control"),
    ("PUT", f"/api/tradex/bots/{BOT1}/config", {"params": {"reward_risk": 2.5}, "expected_row_version": 1},
     "configure"),
    ("POST", "/api/tradex/backtests", {"bot_id": BOT1, "days": 3, "symbols": 1}, "backtest"),
]


@pytest.mark.parametrize("role", ["platform_admin", "trading_admin", "trader", "risk_manager", "viewer"])
def test_permission_matrix_is_enforced_server_side(boot, role):
    from app import rbac
    for method, path, body, perm in PERM_CASES:
        # fresh limiter budget per call: use a different user per case
        user = f"{role}-{perm}"
        boot.role(A, user, role)
        r = boot.call(method, path, user=user, gw="member", json=body)
        rbac_denied = r.status_code == 403 and r.json().get("detail") == "forbidden"
        if rbac.allowed(role, perm):
            # the route may still refuse for a domain reason (e.g. live gate: wrong confirmation) - but never RBAC
            assert r.status_code != 401 and not rbac_denied, (role, perm, r.status_code, r.text)
        else:
            assert rbac_denied, (role, perm, r.status_code, r.text)


def test_denied_privileged_attempts_are_audited_reads_are_not(boot):
    boot.as_role("viewer", "POST", "/api/tradex/risk/kill-switch/engage", json={"reason": "viewer tries kill"})
    boot.as_role("viewer", "GET", "/api/tradex/bots")
    rows = boot.store.query("SELECT actor,details FROM audit_events WHERE action='api_permission_denied'")
    assert len(rows) == 1 and rows[0]["actor"] == "u-viewer"
    assert json.loads(rows[0]["details"])["permission"] == "kill_engage"


def test_role_management_rules(boot):
    assert boot.call("PUT", "/api/tradex/roles/u-new", json={"role": "trader"}).status_code == 200
    assert boot.call("GET", "/api/tradex/me", user="u-new", gw="member").json()["role"] == "trader"
    # cannot change own role (also blocks self-escalation)
    assert boot.call("PUT", "/api/tradex/roles/u-admin", json={"role": "viewer"}).status_code == 403
    # non platform_admin cannot manage roles
    assert boot.as_role("trading_admin", "PUT", "/api/tradex/roles/u-x", json={"role": "trader"}).status_code == 403
    # invalid role / extra fields rejected
    assert boot.call("PUT", "/api/tradex/roles/u-new", json={"role": "root"}).status_code == 422
    assert boot.call("PUT", "/api/tradex/roles/u-new", json={"role": "viewer", "tenant_id": B}).status_code == 422
    # revocation is not undone by a gateway admin hint
    assert boot.call("DELETE", "/api/tradex/roles/u-new").status_code == 200
    assert boot.call("GET", "/api/tradex/me", user="u-new", gw="admin").json()["role"] == "viewer"
    acts = [r["action"] for r in boot.store.query("SELECT action FROM audit_events")]
    assert "role_assigned" in acts and "role_revoked" in acts


def test_role_assignment_only_affects_own_tenant(boot):
    boot.call("PUT", "/api/tradex/roles/u-shared", json={"role": "trading_admin"})
    assert boot.call("GET", "/api/tradex/me", tenant=B, user="u-shared", gw="member").json()["role"] == "viewer"


def test_platform_admin_cannot_enable_live_separation_of_duties(boot):
    r = boot.call("POST", "/api/tradex/live/activate",
                  json={"bot_id": BOT1, "confirmation": f"ENABLE LIVE TRADING FOR {BOT1}", "attestations": ATT})
    assert r.status_code == 403


# ============================================================================================ tenant isolation
def test_tenants_cannot_see_or_touch_each_others_data(boot):
    boot.call("POST", "/api/tradex/bootstrap", tenant=B, user="ub")
    # B bootstraps its own 'primary' account independently
    assert len(boot.call("GET", "/api/tradex/bots", tenant=B, user="ub").json()["bots"]) == 6
    # tenant A configures; B's bot is untouched
    v = boot.call("GET", f"/api/tradex/bots/{BOT1}").json()
    r = boot.call("PUT", f"/api/tradex/bots/{BOT1}/config",
                  json={"params": {"reward_risk": 3.0}, "expected_row_version": v["row_version"]})
    assert r.status_code == 200
    assert boot.call("GET", f"/api/tradex/bots/{BOT1}", tenant=B, user="ub").json()["params"]["reward_risk"] == 2.0
    # an un-bootstrapped tenant gets empty/404, not A's data
    r = boot.call("GET", "/api/tradex/bots", tenant="tenantC", user="uc").json()
    assert r["bootstrapped"] is False and r["bots"] == []
    assert boot.call("GET", f"/api/tradex/bots/{BOT1}", tenant="tenantC", user="uc").status_code == 404
    assert boot.call("POST", "/api/tradex/risk/kill-switch/engage", tenant="tenantC", user="uc",
                     json={"reason": "no such account"}).status_code == 404


def test_other_tenants_orders_backtests_reports_are_404(boot):
    rid = boot.call("POST", "/api/tradex/backtests", json={"bot_id": BOT1, "days": 3, "symbols": 1}).json()["run_id"]
    boot.store.execute(
        "INSERT INTO order_intents(intent_id,tenant_id,account_id,mode,symbol,side,role,quantity,order_type,"
        "correlation_id,dedupe_key,state,created_at,updated_at,broker_order_id) VALUES('i1',?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (A, ACCT, "PAPER", "AAA", "BUY", "ENTRY", 1, "MARKET", "c1", "d1", "FILLED", "t", "t", "123456789012"))
    rep = boot.call("POST", "/api/tradex/reports/generate", json={"kind": "trades", "fmt": "csv", "mode": "PAPER"})
    assert rep.status_code == 200, rep.text
    rep_id = rep.json()["report_id"]
    for path in (f"/api/tradex/backtests/{rid}", "/api/tradex/orders/i1", f"/api/tradex/reports/{rep_id}/download"):
        assert boot.call("GET", path).status_code == 200, path
        assert boot.call("GET", path, tenant=B, user="ub").status_code == 404, path
    assert boot.call("GET", "/api/tradex/backtests", tenant=B, user="ub").json()["runs"] == []
    assert boot.call("GET", "/api/tradex/reports", tenant=B, user="ub").json()["reports"] == []
    # broker order ids are masked in API output
    assert boot.call("GET", "/api/tradex/orders/i1").json()["order"]["broker_order_id"] == "********9012"


# ============================================================================================ bots
def test_bootstrap_is_idempotent_and_never_enables_live(env):
    assert env.call("POST", "/api/tradex/bootstrap").json()["bots_created"] == 6
    assert env.call("POST", "/api/tradex/bootstrap").json()["bots_created"] == 0
    bots = env.call("GET", "/api/tradex/bots").json()["bots"]
    assert len(bots) == 6
    assert all(b["desired_status"] == "STOPPED" and b["execution_mode"] == "PAPER" and not b["live_enabled"]
               for b in bots)


def test_tenant_account_cap(env):
    for i in range(10):
        assert env.call("POST", f"/api/tradex/bootstrap?account_id=acc{i}").status_code == 200
    assert env.call("POST", "/api/tradex/bootstrap?account_id=acc10").status_code == 409
    assert env.call("POST", "/api/tradex/bootstrap?account_id=bad/../x").status_code == 422


def test_start_is_desired_state_only_and_ui_cannot_claim_a_runner(boot):
    r = boot.call("POST", f"/api/tradex/bots/{BOT1}/start").json()
    assert r["desired_status"] == "RUNNING" and r["runner_confirms_active"] is False
    lst = boot.call("GET", "/api/tradex/bots").json()
    assert lst["runner"]["runner_attached"] is False
    heartbeat(boot, mode="PAPER")
    lst = boot.call("GET", "/api/tradex/bots").json()
    assert lst["runner"]["runner_attached"] is True
    assert [b for b in lst["bots"] if b["bot_id"] == BOT1][0]["runner_confirms_active"] is True


def test_kill_switch_blocks_start_but_never_blocks_pause_or_stop(boot):
    assert boot.as_role("trader", "POST", "/api/tradex/risk/kill-switch/engage",
                        json={"reason": "emergency drill"}).status_code == 200
    assert boot.call("POST", f"/api/tradex/bots/{BOT1}/start").status_code == 409
    assert boot.call("POST", f"/api/tradex/bots/{BOT1}/pause").status_code == 200
    assert boot.call("POST", f"/api/tradex/bots/{BOT1}/stop").status_code == 200
    assert boot.call("GET", "/api/tradex/risk/status").json()["kill_switch"]["value"] == "ON"
    # a trader cannot release; a risk manager can
    assert boot.as_role("trader", "POST", "/api/tradex/risk/kill-switch/release",
                        json={"reason": "trader tries release"}).status_code == 403
    assert boot.as_role("risk_manager", "POST", "/api/tradex/risk/kill-switch/release",
                        json={"reason": "all clear after review"}).status_code == 200
    assert boot.call("GET", "/api/tradex/risk/status").json()["kill_switch"]["value"] == "OFF"
    assert boot.call("POST", f"/api/tradex/bots/{BOT1}/start").status_code == 200


def test_kill_switch_reason_required(boot):
    assert boot.call("POST", "/api/tradex/risk/kill-switch/engage", json={"reason": "no"}).status_code == 422
    assert boot.call("POST", "/api/tradex/risk/kill-switch/engage", json={}).status_code == 422


def test_config_update_validation_and_concurrency(boot):
    path = f"/api/tradex/bots/{BOT1}/config"
    v = boot.call("GET", f"/api/tradex/bots/{BOT1}").json()
    ok = boot.call("PUT", path, json={"params": {"reward_risk": 2.5}, "expected_row_version": v["row_version"]})
    assert ok.status_code == 200
    body = ok.json()
    assert body["params"]["reward_risk"] == 2.5 and body["config_hash"] != v["config_hash"]
    assert body["row_version"] == v["row_version"] + 1
    # stale version -> conflict
    assert boot.call("PUT", path, json={"params": {"reward_risk": 3.0},
                                        "expected_row_version": v["row_version"]}).status_code == 409
    rv = body["row_version"]
    bad = [
        {"nonexistent_param": 1},                      # unknown (pydantic would silently ignore it)
        {"session_close": "16:30:00"},                # locked
        {"forced_squareoff": "15:29:00"},             # locked
        {"reward_risk": 99},                          # out of bounds
        {"reward_risk": "high"},                      # wrong type
        {"min_stop_pct": 0.04, "max_stop_pct": 0.01},  # cross-field validator
        {"atr_period": True},                         # bool is not a number here
    ]
    for params in bad:
        r = boot.call("PUT", path, json={"params": params, "expected_row_version": rv})
        assert r.status_code == 422, (params, r.status_code)
    assert boot.call("PUT", path, json={"params": {}, "expected_row_version": rv}).status_code == 422
    assert boot.call("PUT", path, json={"params": {"reward_risk": 2.0}, "expected_row_version": rv,
                                        "live_enabled": True}).status_code == 422  # mass assignment
    assert boot.call("GET", f"/api/tradex/bots/{BOT1}").json()["row_version"] == rv  # nothing partially applied
    assert boot.call("PUT", "/api/tradex/bots/BOT_99/config",
                     json={"params": {"reward_risk": 2.0}, "expected_row_version": 1}).status_code == 404


def test_changing_a_live_bot_needs_trading_admin_and_withdraws_approval(boot):
    boot.store.execute("UPDATE algo_bots SET live_enabled=1, execution_mode='LIVE' WHERE bot_id=?", (BOT1,))
    boot.store.execute("INSERT INTO live_approvals(tenant_id,account_id,bot_id,operator,approved_at,valid_until) "
                       "VALUES(?,?,?,?,?,?)", (A, ACCT, BOT1, "x", "2026-01-01T00:00:00+05:30",
                                               "2999-01-01T00:00:00+05:30"))
    rv = boot.call("GET", f"/api/tradex/bots/{BOT1}").json()["row_version"]
    body = {"params": {"reward_risk": 2.2}, "expected_row_version": rv}
    assert boot.as_role("trader", "PUT", f"/api/tradex/bots/{BOT1}/config", json=body).status_code == 403
    assert boot.as_role("trader", "POST", f"/api/tradex/bots/{BOT1}/start").status_code == 403
    r = boot.as_role("trading_admin", "PUT", f"/api/tradex/bots/{BOT1}/config", json=body)
    assert r.status_code == 200
    assert r.json()["live_enabled"] is False and r.json()["execution_mode"] == "PAPER"
    assert boot.store.one("SELECT revoked FROM live_approvals")["revoked"] == 1


# ============================================================================================ live gate via API
def activate(boot, **over):
    body = {"bot_id": BOT1, "confirmation": f"ENABLE LIVE TRADING FOR {BOT1}", "attestations": ATT} | over
    return boot.as_role("trading_admin", "POST", "/api/tradex/live/activate", json=body)


def live_enabled(boot) -> bool:
    return bool(boot.store.one("SELECT live_enabled FROM algo_bots WHERE bot_id=?", (BOT1,))["live_enabled"])


def test_live_is_off_by_default_and_status_says_why(boot, monkeypatch):
    monkeypatch.delenv("TRADEX_LIVE_ENABLED", raising=False)
    s = boot.call("GET", "/api/tradex/live/status").json()
    assert s["live_enabled_bots"] == [] and s["software_verified_checks"]["env_live_flag"] is False
    r = activate(boot)
    assert r.status_code == 403 and "env_live_flag" in r.text
    assert not live_enabled(boot)


def test_live_activation_requires_fresh_live_runner_even_with_env_flag(boot, monkeypatch):
    monkeypatch.setenv("TRADEX_LIVE_ENABLED", "true")
    r = activate(boot)  # no heartbeat at all
    assert r.status_code == 403 and "credentials_valid" in r.text and not live_enabled(boot)
    heartbeat(boot, mode="PAPER")  # a PAPER runner can never satisfy live preconditions
    assert activate(boot).status_code == 403 and not live_enabled(boot)
    heartbeat(boot, mode="LIVE", ok=False)
    assert activate(boot).status_code == 403 and not live_enabled(boot)


def test_live_activation_wrong_confirmation_and_missing_attestation(boot, monkeypatch):
    monkeypatch.setenv("TRADEX_LIVE_ENABLED", "true")
    heartbeat(boot, mode="LIVE")
    assert activate(boot, confirmation="yes please").status_code == 403
    assert activate(boot, attestations=ATT | {"compliance_confirmed": False}).status_code == 403
    assert not live_enabled(boot)


def test_live_activation_happy_path_then_kill_switch_and_revoke(boot, monkeypatch):
    """Simulated only: a heartbeat row stands in for a LIVE-mode runner. No broker, no orders."""
    monkeypatch.setenv("TRADEX_LIVE_ENABLED", "true")
    heartbeat(boot, mode="LIVE")
    r = activate(boot)
    assert r.status_code == 200, r.text
    assert live_enabled(boot)
    s = boot.call("GET", "/api/tradex/live/status").json()
    assert s["authorised_now"] == {BOT1: True}
    # only one live bot at a time
    other = "BOT_02_OPENING_RANGE_BREAKOUT"
    r2 = activate(boot, bot_id=other, confirmation=f"ENABLE LIVE TRADING FOR {other}")
    assert r2.status_code == 403 and "single_live_bot" in r2.text
    # kill switch instantly de-authorises (no waiting for expiry)
    boot.as_role("risk_manager", "POST", "/api/tradex/risk/kill-switch/engage", json={"reason": "manual halt drill"})
    assert boot.call("GET", "/api/tradex/live/status").json()["authorised_now"] == {BOT1: False}
    # a risk manager can revoke live; a trader cannot
    rv = {"bot_id": BOT1, "reason": "revoking after drill"}
    assert boot.as_role("trader", "POST", "/api/tradex/live/revoke", json=rv).status_code == 403
    assert boot.as_role("risk_manager", "POST", "/api/tradex/live/revoke", json=rv).status_code == 200
    assert not live_enabled(boot)


def test_live_activation_is_rate_limited(boot):
    codes = [activate(boot, confirmation="wrong").status_code for _ in range(7)]
    assert codes[:5] == [403] * 5 and codes[5] == 429


# ============================================================================================ backtests
def test_backtest_is_labelled_synthetic_and_persisted(boot):
    r = boot.as_role("trader", "POST", "/api/tradex/backtests",
                     json={"bot_id": BOT1, "days": 5, "symbols": 1, "seed": 3})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["data_source"] == "SYNTHETIC" and "NOT evidence of profitability" in j["warning"]
    runs = boot.call("GET", "/api/tradex/backtests").json()["runs"]
    assert runs[0]["run_id"] == j["run_id"] and runs[0]["data_source"] == "SYNTHETIC"
    d = boot.call("GET", f"/api/tradex/backtests/{j['run_id']}").json()
    assert d["trade_count"] == j["trade_count"]


@pytest.mark.parametrize("body", [
    {"bot_id": BOT1, "days": 1000}, {"bot_id": BOT1, "symbols": 50}, {"bot_id": BOT1, "source": "live"},
    {"bot_id": "../../etc/passwd"}, {"bot_id": BOT1, "slippage_scenario": "none"}, {"bot_id": BOT1, "x": 1},
])
def test_backtest_input_validation(boot, body):
    assert boot.call("POST", "/api/tradex/backtests", json=body).status_code == 422


def test_backtest_unknown_bot(boot):
    assert boot.call("POST", "/api/tradex/backtests", json={"bot_id": "BOT_99_NOPE"}).status_code == 404


# ============================================================================================ analytics / reports
def seed_positions(env, tenant, mode, nets):
    for i, net in enumerate(nets):
        env.store.execute(
            "INSERT INTO trading_positions(position_id,tenant_id,account_id,mode,bot_id,symbol,quantity,avg_price,"
            "protection_status,state,opened_at,closed_at,exit_reason,exit_avg_price,gross_pnl,slippage_cost,charges,"
            "net_pnl,r_multiple,planned_risk) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (f"{tenant}-{mode}-{i}", tenant, ACCT, mode, BOT1, "AAA", 10, 100.0, "PROTECTED", "CLOSED",
             f"2025-01-0{i + 1}T10:00:00+05:30", f"2025-01-0{i + 1}T11:00:00+05:30", "TARGET", 101.0,
             net + 5, 1.0, 5.0, net, net / 100, 100.0))


def test_analytics_are_tenant_scoped_and_paper_live_separated(boot):
    seed_positions(boot, A, "PAPER", [50.0, -20.0, 30.0])
    seed_positions(boot, A, "LIVE", [10.0])
    seed_positions(boot, B, "PAPER", [999.0])
    get = lambda mode, **kw: boot.call("GET", "/api/tradex/analytics/overview", params={"mode": mode}, **kw)  # noqa
    pa = get("PAPER").json()
    assert pa["metrics"]["trade_count"] == 3 and pa["metrics"]["net_profit"] == pytest.approx(60.0)
    assert get("LIVE").json()["metrics"]["trade_count"] == 1
    assert get("PAPER", tenant=B, user="ub").json()["metrics"]["net_profit"] == pytest.approx(999.0)
    assert get("PAPER", tenant="tenantC", user="uc").json()["metrics"]["trade_count"] == 0
    t = boot.call("GET", "/api/tradex/analytics/trades", params={"mode": "PAPER"}).json()
    assert len(t["items"]) == 3, list(t)
    tb = boot.call("GET", "/api/tradex/analytics/trades", params={"mode": "PAPER"}, tenant=B, user="ub").json()
    assert len(tb["items"]) == 1


def test_analytics_parameter_validation(boot):
    p = "/api/tradex/analytics/overview"
    assert boot.call("GET", p).status_code == 422                                   # mode required
    assert boot.call("GET", p, params={"mode": "BACKTEST"}).status_code == 422
    assert boot.call("GET", p, params={"mode": "PAPER", "from": "2025-02-01", "to": "2025-01-01"}).status_code == 422
    assert boot.call("GET", p, params={"mode": "PAPER", "symbol": "a'; DROP TABLE x;--"}).status_code == 422
    assert boot.call("GET", p, params={"mode": "PAPER", "bot_id": "BOT_1'--"}).status_code == 422
    assert boot.call("GET", "/api/tradex/analytics/pnl", params={"mode": "PAPER", "group_by": "evil"}).status_code == 422
    for ep in ("bot-comparison", "risk", "execution", "pnl"):
        assert boot.call("GET", f"/api/tradex/analytics/{ep}", params={"mode": "PAPER"}).status_code == 200, ep
    assert boot.call("GET", "/api/tradex/analytics/reconciliation", params={"mode": "PAPER"}).status_code == 200


def test_report_generation_download_and_validation(boot):
    seed_positions(boot, A, "PAPER", [50.0, -20.0])
    r = boot.as_role("trader", "POST", "/api/tradex/reports/generate",
                     json={"kind": "trades", "fmt": "csv", "mode": "PAPER", "from": "2025-01-01", "to": "2025-01-31"})
    assert r.status_code == 200, r.text
    rid = r.json()["report_id"]
    dl = boot.call("GET", f"/api/tradex/reports/{rid}/download")
    assert dl.status_code == 200 and dl.headers["content-type"].startswith("text/csv")
    assert "# Mode: PAPER" in dl.text and "SIMULATED" in dl.text and "Data as of" in dl.text
    assert dl.headers["cache-control"] == "no-store"
    assert any(x["report_id"] == rid for x in boot.call("GET", "/api/tradex/reports").json()["reports"])
    # tampering with the stored file is detected
    path = boot.store.one("SELECT path FROM generated_reports WHERE report_id=?", (rid,))["path"]
    open(path, "a").write("tamper")
    assert boot.call("GET", f"/api/tradex/reports/{rid}/download").status_code == 404
    for body in ({"kind": "everything", "fmt": "csv", "mode": "PAPER"}, {"kind": "trades", "fmt": "exe", "mode": "PAPER"},
                 {"kind": "trades", "fmt": "csv", "mode": "BACKTEST"},
                 {"kind": "trades", "fmt": "csv", "mode": "PAPER", "from": "2025-02-01", "to": "2025-01-01"},
                 {"kind": "trades", "fmt": "csv", "mode": "PAPER", "tenant_id": B}):
        assert boot.call("POST", "/api/tradex/reports/generate", json=body).status_code == 422, body
    assert boot.call("GET", "/api/tradex/reports/not-a-real-id/download").status_code == 404


def test_audit_report_requires_audit_permission(boot):
    body = {"kind": "audit_log", "fmt": "csv", "mode": "PAPER"}
    assert boot.as_role("trader", "POST", "/api/tradex/reports/generate", json=body).status_code == 403
    assert boot.as_role("risk_manager", "POST", "/api/tradex/reports/generate", json=body).status_code == 200


# ============================================================================================ audit / jobs
def test_audit_console_is_tenant_scoped_and_chain_verifies(boot):
    boot.call("POST", "/api/tradex/bootstrap", tenant=B, user="ub")
    a = boot.call("GET", "/api/tradex/audit").json()
    text = json.dumps(a)
    assert "bots_bootstrapped" in text and B not in text
    v = boot.as_role("risk_manager", "GET", "/api/tradex/audit/verify").json()
    assert v["chain_valid"] is True
    assert boot.as_role("viewer", "GET", "/api/tradex/audit").status_code == 403


def test_jobs_data_quality_and_reconcile_run_and_are_audited(boot):
    assert boot.as_role("risk_manager", "POST", "/api/tradex/jobs/data-quality").status_code == 200
    assert boot.as_role("risk_manager", "POST", "/api/tradex/jobs/reconcile", json={"mode": "PAPER"}).status_code == 200
    assert boot.as_role("risk_manager", "POST", "/api/tradex/jobs/reconcile", json={"mode": "X"}).status_code == 422
    assert boot.call("GET", "/api/tradex/data-quality/issues").status_code == 200
    acts = {r["action"] for r in boot.store.query("SELECT action FROM audit_events")}
    assert {"job_data_quality_run", "job_ledger_reconciliation_run"} <= acts


def test_secrets_never_reach_responses_or_audit(boot):
    boot.call("POST", "/api/tradex/risk/kill-switch/engage",
              json={"reason": "my access_token=abc123 leaked here"})
    # audit details redact by KEY name; the free-text reason is operator input and is stored as typed, so make
    # sure no signing material or auth headers are ever persisted.
    blob = json.dumps([dict(r) for r in boot.store.query("SELECT details FROM audit_events")])
    assert SECRET not in blob and "X-Service-Signature" not in blob


def test_unhandled_errors_do_not_leak_internals(boot, monkeypatch):
    import app.main as m
    monkeypatch.setattr(m, "ensure_bots", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("secret internal path C:\\x")))
    r = boot.call("POST", "/api/tradex/bootstrap?account_id=zzz")
    assert r.status_code == 500 and r.json() == {"detail": "internal error"}
