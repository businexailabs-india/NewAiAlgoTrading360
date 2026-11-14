from __future__ import annotations

import pytest

from harness import SYM, Env
from tradex_bots.broker import BrokerOrderRequest
from tradex_bots.config import ExecutionMode
from tradex_bots.models import ExitReason, Side
from tradex_bots.oms import InvalidTransition, OrderState


def state(env: Env, iid: str) -> str:
    return env.om.intent(iid)["state"]


def test_intent_persisted_before_broker_call():
    env = Env()
    seen = {}
    real = env.broker.place_order

    def spy(req: BrokerOrderRequest):
        row = env.store.one("SELECT state, correlation_id FROM order_intents WHERE correlation_id=?",
                            (req.correlation_id,))
        seen["row"] = dict(row) if row else None
        return real(req)

    env.broker.place_order = spy
    iid = env.entry()
    env.om.submit(iid)
    assert seen["row"] is not None, "intent must exist in DB before the broker is contacted"
    assert seen["row"]["state"] == "SUBMITTING"
    assert len(seen["row"]["correlation_id"]) <= 30


def test_duplicate_intent_blocked():
    env = Env()
    env.entry(key="same")
    _, created = env.om.create_intent(
        bot_id="B", strategy_version="1", config_hash="h", symbol=SYM, security_id="1", side=Side.BUY, role="ENTRY",
        quantity=10, order_type="MARKET", dedupe_key="same")
    assert created is False
    assert env.store.one("SELECT COUNT(*) n FROM order_intents")["n"] == 1


def test_invalid_transition_rejected():
    env = Env()
    iid = env.entry()
    with pytest.raises(InvalidTransition):
        env.om.transition(iid, OrderState.FILLED, "bad-event")


def test_fill_then_protection_places_single_stop_for_actual_quantity():
    env = Env()
    iid, pos_id = env.filled_position()
    pos = env.om.position(pos_id)
    assert pos["state"] == "OPEN" and pos["quantity"] == 40
    assert env.om.ensure_protection(pos_id) is True
    pos = env.om.position(pos_id)
    assert pos["protection_status"] == "PROTECTED"
    assert state(env, iid) == "PROTECTED"
    sells = [o for o in env.broker.orders.values() if o.req.side == Side.SELL]
    assert len(sells) == 1 and sells[0].req.quantity == 40 and sells[0].req.order_type == "STOP_LOSS_MARKET"
    # idempotent
    assert env.om.ensure_protection(pos_id) is True
    assert len([o for o in env.broker.orders.values() if o.req.side == Side.SELL]) == 1


def test_stop_loss_closes_position_with_costs_and_negative_pnl():
    env = Env()
    _, pos_id = env.filled_position()
    env.om.ensure_protection(pos_id)
    stop = env.om.position(pos_id)["stop_price"]
    env.quote(stop - 0.5)  # price falls through the stop
    env.om.poll()
    pos = env.om.position(pos_id)
    assert pos["state"] == "CLOSED" and pos["exit_reason"] == "STOP_LOSS"
    assert pos["net_pnl"] < 0 and pos["charges"] > 0
    assert pos["net_pnl"] == pytest.approx(pos["gross_pnl"] - pos["slippage_cost"] - pos["charges"], abs=0.02)
    assert env.store.one("SELECT COUNT(*) n FROM trading_costs WHERE position_id=?", (pos_id,))["n"] == 1
    assert env.broker.positions[SYM][0] == 0


def test_target_exit_cancels_stop_first_and_never_oversells():
    env = Env()
    _, pos_id = env.filled_position()
    env.om.ensure_protection(pos_id)
    target = env.om.position(pos_id)["target_price"]
    env.quote(target + 0.2)
    acts = env.om.on_price(SYM, target + 0.2)
    env.quote(target + 0.2)  # next tick executes the market exit
    env.om.poll()
    assert acts and acts[0].startswith("exit_submitted")
    pos = env.om.position(pos_id)
    assert pos["state"] == "CLOSED" and pos["exit_reason"] == "TARGET"
    assert pos["net_pnl"] > 0
    assert env.broker.positions[SYM][0] == 0  # never negative -> never over-closed / short
    stop = [o for o in env.broker.orders.values() if o.req.order_type == "STOP_LOSS_MARKET"][0]
    assert stop.status.value == "CANCELLED"
    # a second exit request is a no-op
    assert env.om.request_exit(pos_id, ExitReason.TARGET) == "not_open"


def test_timeout_after_acceptance_is_resolved_by_correlation_not_resubmitted():
    env = Env()
    env.broker.fail_next_place = "timeout_after"
    iid = env.entry()
    res = env.om.submit(iid)
    assert res.note == "resolved_from_broker"
    assert state(env, iid) in ("ACKNOWLEDGED", "FILLED", "PARTIALLY_FILLED")
    assert len(env.broker.orders) == 1  # exactly one order at the broker
    assert env.om.submit(iid).note == "not_in_risk_approved_state"  # cannot be submitted twice
    assert len(env.broker.orders) == 1


def test_timeout_before_reaching_broker_is_rejected_and_not_auto_resubmitted():
    env = Env()
    env.broker.fail_next_place = "timeout_before"
    iid = env.entry()
    res = env.om.submit(iid)
    assert res.state == OrderState.REJECTED and res.note == "not_found_at_broker"
    assert len(env.broker.orders) == 0


def test_lookup_failure_leaves_unknown_and_blocks_new_entries():
    env = Env()
    env.broker.fail_next_place = "timeout_after"
    iid = env.entry()
    real = env.broker.get_order_by_correlation
    env.broker.get_order_by_correlation = lambda c: (_ for _ in ()).throw(__import__("tradex_bots.broker", fromlist=["BrokerError"]).BrokerError("down"))
    res = env.om.submit(iid)
    assert res.state == OrderState.UNKNOWN
    assert "unknown_order_status" in env.om.entries_blocked()
    env.broker.get_order_by_correlation = real
    assert env.om.resolve_unknown(iid).note == "resolved_from_broker"
    assert "unknown_order_status" not in env.om.entries_blocked()


def test_kill_switch_cancels_entry_but_exit_still_works():
    env = Env()
    _, pos_id = env.filled_position()
    env.om.ensure_protection(pos_id)
    env.risk.engage_kill_switch("test", "operator1")
    iid2 = env.entry(key="k2")
    assert env.om.submit(iid2).state == OrderState.CANCELLED
    assert env.om.request_exit(pos_id, ExitReason.EMERGENCY).startswith("exit_submitted")
    env.quote(400.0)
    env.om.poll()
    assert env.om.position(pos_id)["state"] == "CLOSED"


def test_live_mode_without_authorisation_never_reaches_broker():
    env = Env(mode=ExecutionMode.LIVE)
    iid = env.entry()
    res = env.om.submit(iid)
    assert res.state == OrderState.CANCELLED and res.note == "live_not_authorised"
    assert len(env.broker.orders) == 0


def test_live_mode_with_guard_allows_entry():
    env = Env(mode=ExecutionMode.LIVE)
    env.live_ok = True
    iid = env.entry()
    assert env.om.submit(iid).state != OrderState.CANCELLED
    assert len(env.broker.orders) == 1


def test_partial_fill_cancels_remainder_and_protects_actual_quantity():
    env = Env(partial_fill_prob=1.0, partial_ratio=0.5)
    iid = env.entry(qty=40)
    env.om.submit(iid)
    env.quote(400.0)
    env.om.poll()  # partial fill (20) -> protection must cover 20 only
    pos_id = f"pos-{iid}"
    pos = env.om.position(pos_id)
    assert pos["quantity"] == 20
    assert pos["protection_status"] == "PROTECTED"
    stops = [o for o in env.broker.orders.values() if o.req.order_type == "STOP_LOSS_MARKET"]
    assert len(stops) == 1 and stops[0].req.quantity == 20
    assert state(env, iid) == "PROTECTED"
    assert env.broker.orders[env.om.intent(iid)['broker_order_id']].status.value == 'CANCELLED'  # remainder cancelled


def test_post_fill_risk_breach_flattens():
    env = Env()
    iid = env.entry(qty=40, stop_dist=2.0)
    env.om.submit(iid)
    env.quote(400.0, spread=0.10)
    # simulate a much worse actual fill than planned: widen stop distance risk by changing planned distance
    env.store.execute("UPDATE order_intents SET planned=? WHERE intent_id=?",
                      ('{"entry_price":400,"stop_price":392,"stop_distance":8.0,"target_price":416,"planned_risk":320}', iid))
    env.om.poll()
    pos = env.om.position(f"pos-{iid}")
    assert pos["exit_reason"] == "EMERGENCY"
    assert any(k == "post_fill_risk_exceeded" for k in [r["kind"] for r in env.store.query("SELECT kind FROM risk_events")])


def test_reconcile_detects_position_mismatch_and_blocks_entries():
    env = Env()
    _, pos_id = env.filled_position()
    env.om.ensure_protection(pos_id)
    assert env.om.reconcile().ok
    env.broker.positions[SYM][0] += 5  # broker disagrees with local state
    rep = env.om.reconcile()
    assert not rep.ok and any("position:" in m for m in rep.mismatches)
    assert "reconciliation_mismatch" in env.om.entries_blocked()


def test_restart_recovery_resolves_in_flight_order():
    env = Env()
    iid = env.entry()
    # simulate crash after SUBMITTING committed and order accepted by broker, but before bookkeeping
    env.om.transition(iid, OrderState.SUBMITTING, f"{iid}:SUBMITTING")
    from tradex_bots.broker import BrokerOrderRequest

    row = env.om.intent(iid)
    env.broker.place_order(BrokerOrderRequest(row["correlation_id"], SYM, "1234", Side.BUY, 40, "MARKET"))
    om2 = env.make_om()
    om2.recovered = False
    assert "startup_recovery_not_completed" in om2.entries_blocked()
    rep = om2.recover()
    assert rep.ok or all("position:" in m for m in rep.mismatches)
    assert om2.intent(iid)["state"] in ("ACKNOWLEDGED", "FILLED", "PARTIALLY_FILLED")
    assert len(env.broker.orders) == 1


def test_audit_chain_is_valid_and_tamper_evident():
    env = Env()
    env.filled_position()
    env.store.audit("test_event", tenant_id="t1", details={"x": 1})
    env.store.audit("test_event2", tenant_id="t1", details={"access_token": "SECRET"})
    ok, _ = env.store.verify_audit_chain()
    assert ok
    assert "SECRET" not in str(env.store.query("SELECT details FROM audit_events"))
    with pytest.raises(Exception):
        env.store.execute("UPDATE audit_events SET action='x'")
    with pytest.raises(Exception):
        env.store.execute("DELETE FROM audit_events")
    with pytest.raises(Exception):
        env.store.execute("UPDATE order_events SET to_state='X'")


def test_deliberate_stop_cancel_is_not_reported_as_lost_stop_and_single_exit():
    """Regression: cancelling the stop as part of an exit used to raise 'protective_stop_lost' and place a 2nd exit."""
    env = Env()
    _, pos_id = env.filled_position()
    env.om.ensure_protection(pos_id)
    target = env.om.position(pos_id)["target_price"]
    env.om.on_price(SYM, target + 0.2)
    env.quote(target + 0.2)
    env.om.poll()
    assert env.alerts == []
    exits = env.store.query("SELECT state FROM order_intents WHERE role='EXIT'")
    assert len(exits) == 1 and exits[0]["state"] == "FILLED"


def test_two_tenants_with_identical_broker_trade_ids_do_not_collide():
    """Regression: fill_key / broker_orders were globally keyed; another tenant's fill was silently dropped."""
    from tradex_bots.store import Store

    store = Store()
    a = Env(store=store, tenant="tA", account="a1")
    b = Env(store=store, tenant="tB", account="b1")  # both PaperBrokers emit PO00000001 / PT00000002 ...
    _, pa = a.filled_position(key="x")
    _, pb = b.filled_position(key="x")
    for env, pid in ((a, pa), (b, pb)):
        assert env.om.position(pid)["quantity"] == 40
    assert store.one("SELECT COUNT(*) n FROM trade_fills WHERE tenant_id='tA'")["n"] == 1
    assert store.one("SELECT COUNT(*) n FROM trade_fills WHERE tenant_id='tB'")["n"] == 1
    assert store.one("SELECT COUNT(*) n FROM broker_orders")["n"] == 4  # entry + stop per tenant
