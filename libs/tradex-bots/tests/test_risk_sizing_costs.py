from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from harness import SYM, Env
from tradex_bots.arbitration import ArbitrationResult, Candidate, SignalArbiter
from tradex_bots.bots import create_bot
from tradex_bots.config import ALL_BOT_IDS, BOT_01, BOT_02, BOT_03, CommonParams, EngineConfig, ExecutionMode
from tradex_bots.costs import SLIPPAGE_SCENARIOS, Execution, FeeModel, FeeModelRegistry, FeeSchedule
from tradex_bots.instruments import Instrument, round_to_tick
from tradex_bots.models import Quote, Side, SignalDecision, TradeLevels
from tradex_bots.risk import EntryRequest, Health, OpenRisk
from tradex_bots.sizing import size_position
from tradex_bots.timeutil import IST


def levels(price=400.0, d=2.0) -> TradeLevels:
    return TradeLevels(price, d, price - d, price + 2 * d)


def req(env: Env, now=None, **kw) -> EntryRequest:
    now = now or env.clock()
    q = Quote(SYM, now, 400.0, 399.95, 400.05, 1000)
    base = dict(bot_id=BOT_01, symbol=SYM, instrument=Instrument(SYM, "1234"), levels=levels(), params=CommonParams(),
                now=now, available_funds=20_000.0, quote=q)
    base.update(kw)
    return EntryRequest(**base)


# ------------------------------------------------------------------ costs
def test_fee_model_matches_hand_calculation():
    fm = FeeModel()
    ch = fm.round_trip(100, 500.0, 505.0)
    # brokerage: min(20, 0.03%) -> 15.00 + 15.15 ; STT sell 12.625 ; txn 3.0853 ; sebi 0.1005 ; stamp 1.50 ; GST 18%
    assert float(ch.brokerage) == pytest.approx(30.15, abs=0.02)
    assert float(ch.stt) == pytest.approx(12.63, abs=0.02)
    assert float(ch.stamp) == pytest.approx(1.50, abs=0.01)
    assert float(ch.gst) == pytest.approx(0.18 * (30.15 + 3.0853 + 0.1005), abs=0.03)
    assert float(ch.total) == pytest.approx(30.15 + 12.625 + 3.0853 + 0.1005 + 1.5 + 6.0004, abs=0.1)


def test_brokerage_is_capped_at_flat_amount():
    fm = FeeModel()
    ch = fm.charges([Execution("o", Side.BUY, 1000, 1000.0)])  # 0.03% of 1,000,000 = 300 -> capped at 20
    assert float(ch.brokerage) == 20.0


def test_fee_registry_selects_schedule_by_effective_date():
    from datetime import date

    reg = FeeModelRegistry()
    reg.add(FeeSchedule(version="v2", effective_from=date(2026, 1, 1), stt_sell_pct="0.0005"))
    assert reg.for_date(date(2025, 6, 1)).version != "v2"
    assert reg.for_date(date(2026, 6, 1)).version == "v2"


def test_slippage_scenarios_are_adverse_on_both_legs():
    s = SLIPPAGE_SCENARIOS["base"]
    assert s.entry_price(100.0, 0.05) >= 100.0
    assert s.exit_price(100.0, 0.05) <= 100.0
    assert round_to_tick(100.03, 0.05, "up") == 100.05 and round_to_tick(100.03, 0.05, "down") == 100.0


# ------------------------------------------------------------------ sizing
def test_sizing_total_loss_including_costs_never_exceeds_risk_budget():
    env = Env()
    for price, d in [(400.0, 2.0), (150.0, 1.0), (1200.0, 9.0), (60.0, 0.45)]:
        res = size_position(levels(price, d), available_funds=20_000.0, risk=env.cfg.risk, fees=env.fees,
                            slippage=SLIPPAGE_SCENARIOS["base"], tick=0.05)
        if res.approved:
            assert res.projected_loss_at_stop <= env.cfg.risk.risk_per_trade_inr + 1e-6
            assert res.notional <= env.cfg.risk.max_exposure_inr + 1e-6
            assert res.quantity <= res.raw_quantity


def test_sizing_rejects_when_unaffordable():
    env = Env()
    res = size_position(levels(5000.0, 25.0), available_funds=20_000.0, risk=env.cfg.risk, fees=env.fees,
                        slippage=SLIPPAGE_SCENARIOS["base"], tick=0.05)
    assert not res.approved or res.quantity * 5000 <= 18_000


# ------------------------------------------------------------------ risk engine
def test_entry_approved_in_normal_conditions():
    env = Env()
    d = env.risk.check_entry(req(env))
    assert d.approved, d.reasons
    assert d.sizing and d.sizing.quantity > 0


@pytest.mark.parametrize("hh,mm,ss,ok", [(9, 20, 0, False), (9, 35, 0, True), (14, 30, 20, True), (14, 31, 0, False)])
def test_entry_window(hh, mm, ss, ok):
    env = Env()
    now = datetime(2026, 11, 16, hh, mm, ss, tzinfo=IST)
    env.clock.t = now
    d = env.risk.check_entry(req(env, now=now))
    assert ("outside_entry_window" not in d.reasons) is ok


def test_max_two_entries_per_day():
    env = Env()
    env.risk.record_entry(env.clock())
    assert env.risk.check_entry(req(env)).approved
    env.risk.record_entry(env.clock())
    assert "max_entries_per_day_reached" in env.risk.check_entry(req(env)).reasons


def test_one_open_position_and_unprotected_blocks():
    env = Env()
    op = OpenRisk("OTHER", 10, 100.0, 100.0, True)
    assert "open_position_exists" in env.risk.check_entry(req(env, open_positions=[op])).reasons
    op2 = OpenRisk("OTHER", 10, 100.0, 100.0, False)
    assert "unprotected_position_exists" in env.risk.check_entry(req(env, open_positions=[op2])).reasons
    assert "pending_entry_exists" in env.risk.check_entry(req(env, pending_entry_orders=1)).reasons


def test_daily_loss_cutoff_locks_and_persists():
    env = Env()
    assert env.risk.record_closed_trade(env.clock(), -190.0, 20.0, -210.0) is True
    d = env.risk.check_entry(req(env))
    assert not d.approved and "daily_risk_locked" in d.reasons
    # persisted: a fresh engine on the same store still sees the lock
    from tradex_bots.risk import RiskEngine

    again = RiskEngine(env.cfg, env.store, env.fees, ExecutionMode.PAPER)
    assert "daily_risk_locked" in again.check_entry(req(env)).reasons


def test_projected_breach_rejected_before_lock():
    env = Env()
    env.risk.record_closed_trade(env.clock(), -140.0, 10.0, -150.0)
    d = env.risk.check_entry(req(env))
    assert "projected_daily_loss_breach" in d.reasons


def test_unrealised_loss_and_closing_costs_count_toward_daily_exposure():
    env = Env()
    op = OpenRisk("X", 100, 500.0, 497.0, True)  # -300 unrealised
    assert env.risk.daily_loss_exposure(env.clock(), [op]) >= 300.0
    assert "daily_loss_cutoff_breached" in env.risk.check_entry(req(env, open_positions=[op])).reasons


def test_health_failures_block_entries():
    env = Env()
    d = env.risk.check_entry(req(env, health=Health(broker_connected=False, data_fresh=False)))
    assert "health:broker_connected" in d.reasons and "health:data_fresh" in d.reasons


def test_stale_and_wide_quotes_rejected():
    env = Env()
    now = env.clock()
    stale = Quote(SYM, now - timedelta(seconds=60), 400.0, 399.95, 400.05, 1)
    assert "quote_stale" in env.risk.check_entry(req(env, quote=stale)).reasons
    wide = Quote(SYM, now, 400.0, 399.0, 401.0, 1)
    assert "spread_too_wide" in env.risk.check_entry(req(env, quote=wide)).reasons


def test_live_requires_allowlist_and_quote():
    env = Env(mode=ExecutionMode.LIVE)
    d = env.risk.check_entry(req(env, quote=None))
    assert "live_symbol_allowlist_empty" in d.reasons and "quote_unavailable" in d.reasons


def test_kill_switch_persists_and_needs_identified_operator_to_release():
    env = Env()
    env.risk.engage_kill_switch("test", "ops1")
    assert "kill_switch_active" in env.risk.check_entry(req(env)).reasons
    with pytest.raises(PermissionError):
        env.risk.release_kill_switch("system", "x")
    env.risk.release_kill_switch("ops1", "all clear")
    assert env.risk.check_entry(req(env)).approved


# ------------------------------------------------------------------ arbitration / capital
def _cand(bot_id: str, sym: str, t=None) -> Candidate:
    t = t or datetime(2026, 11, 16, 10, 0, tzinfo=IST)
    return Candidate(create_bot(bot_id), SignalDecision(bot_id, sym, t, t + timedelta(minutes=5), True))


def test_arbitration_is_deterministic_and_persists_every_decision():
    env = Env()
    arb = SignalArbiter(env.store, env.cfg, ExecutionMode.PAPER)
    cands = [_cand(BOT_03, "AAA"), _cand(BOT_01, "BBB"), _cand(BOT_02, "BBB")]
    res = arb.arbitrate(cands, held_symbols=set(), pending_symbols=set(), open_count=0, pending_count=0)
    accepted = [r for r in res if r.accepted]
    assert len(accepted) == 1 and accepted[0].candidate.decision.bot_id == BOT_01  # fixed priority
    assert env.store.one("SELECT COUNT(*) n FROM bot_signals")["n"] == 3
    assert env.store.one("SELECT COUNT(*) n FROM bot_signals WHERE status='REJECTED'")["n"] == 2
    # same candle again: duplicate is not accepted twice
    res2 = arb.arbitrate([_cand(BOT_01, "BBB")], held_symbols=set(), pending_symbols=set(), open_count=0,
                         pending_count=0)
    assert not res2[0].accepted and "duplicate_signal" in res2[0].reasons


def test_arbitration_respects_account_limits_and_existing_symbols():
    env = Env()
    arb = SignalArbiter(env.store, env.cfg, ExecutionMode.PAPER)
    r = arb.arbitrate([_cand(BOT_01, "AAA")], held_symbols=set(), pending_symbols=set(), open_count=1, pending_count=0)
    assert "account_position_limit" in r[0].reasons
    r = arb.arbitrate([_cand(BOT_02, "CCC")], held_symbols={"CCC"}, pending_symbols=set(), open_count=0,
                      pending_count=0)
    assert "symbol_position_or_order_exists" in r[0].reasons
    r = arb.arbitrate([_cand(BOT_03, "DDD")], held_symbols=set(), pending_symbols=set(), open_count=0, pending_count=1)
    assert "account_pending_order_lock" in r[0].reasons


def test_only_live_enabled_bot_can_trade_live():
    env = Env(mode=ExecutionMode.LIVE)
    arb = SignalArbiter(env.store, env.cfg, ExecutionMode.LIVE, live_enabled_bots={BOT_03})
    r = arb.arbitrate([_cand(BOT_01, "AAA")], held_symbols=set(), pending_symbols=set(), open_count=0, pending_count=0)
    assert not r[0].accepted and "bot_not_live_enabled" in r[0].reasons
    r = arb.arbitrate([_cand(BOT_03, "BBB")], held_symbols=set(), pending_symbols=set(), open_count=0, pending_count=0)
    assert r[0].accepted
    arb2 = SignalArbiter(env.store, env.cfg, ExecutionMode.LIVE, live_enabled_bots={BOT_01, BOT_03})
    r = arb2.arbitrate([_cand(BOT_01, "EEE")], held_symbols=set(), pending_symbols=set(), open_count=0,
                       pending_count=0)
    assert "multiple_live_bots_configured" in r[0].reasons


def test_capital_reservation_prevents_double_allocation_and_releases():
    env = Env()
    a = env.alloc.reserve(BOT_01, "AAA", 9_000.0, 20_000.0)
    assert a
    assert env.alloc.reserve(BOT_02, "BBB", 9_500.0, 20_000.0) is None  # 18,500 > 18,000 account exposure cap
    assert env.alloc.available_after_reservations(20_000.0) == 11_000.0
    env.alloc.settle(a, "RELEASED")
    assert env.alloc.reserve(BOT_02, "BBB", 9_500.0, 20_000.0)
