from __future__ import annotations

from collections import Counter
from datetime import time

import pytest

from harness import Env
from tradex_bots.analytics import Analytics
from tradex_bots.arbitration import SignalArbiter
from tradex_bots.bots import BOT_REGISTRY, create_bot
from tradex_bots.config import ExecutionMode
from tradex_bots.instruments import Instrument
from tradex_bots.jobs import run_data_quality, run_ledger_reconciliation
from tradex_bots.models import Candle
from tradex_bots.runner import BotRunner, replay_candles
from tradex_bots.synthetic import synth_candles

SYMS = ["AAA", "BBB"]

pytestmark = pytest.mark.slow


def candles_for(sym: str, days: int, seed: int, price0: float) -> list[Candle]:
    df = synth_candles(sym, days, seed=seed, price0=price0, vol_spike_prob=0.15)
    return [Candle(sym, r.start.to_pydatetime(), r.open, r.high, r.low, r.close, r.volume, None, 5)
            for r in df.itertuples()]


def build(env: Env, bot_ids: list[str], mode=ExecutionMode.PAPER) -> BotRunner:
    bots = [create_bot(b) for b in bot_ids]
    insts = {s: Instrument(s, str(10 + i)) for i, s in enumerate(SYMS)}
    arb = SignalArbiter(env.store, env.cfg, mode, live_enabled_bots=set())
    r = BotRunner(store=env.store, cfg=env.cfg, mode=mode, broker=env.broker, om=env.om, risk=env.risk,
                  allocator=env.alloc, arbiter=arb, bots=bots, instruments=insts, clock=env.clock)
    for b in bot_ids:
        r.start_bot(b)
    return r


@pytest.fixture(scope="module")
def drill():
    """Shared-capital paper portfolio: all six bots, two symbols, 9 synthetic days, full live code path."""
    env = Env(latency_ms=0)
    r = build(env, list(BOT_REGISTRY))
    data = {s: candles_for(s, 9, 40 + i, 300.0 + 150 * i) for i, s in enumerate(SYMS)}
    env.clock.t = min(c.start for cs in data.values() for c in cs)
    replay_candles(r, env.clock, data)
    return env, r


def test_paper_drill_produces_trades_through_full_pipeline(drill):
    env, r = drill
    n = env.store.one("SELECT COUNT(*) n FROM trading_positions WHERE state='CLOSED'")["n"]
    assert n > 0, "no trades: the drill is not exercising the pipeline"
    assert env.store.one("SELECT COUNT(*) n FROM bot_signals")["n"] > 0
    assert env.store.one("SELECT COUNT(*) n FROM order_intents WHERE role='ENTRY'")["n"] >= n


def test_paper_drill_risk_invariants(drill):
    env, _ = drill
    rows = env.store.query("SELECT * FROM trading_positions ORDER BY opened_at")
    per_day = Counter(r["opened_at"][:10] for r in rows)
    assert all(v <= 2 for v in per_day.values()), "max 2 entries/day violated"
    assert all(r["state"] == "CLOSED" for r in rows), "every position must be flat (intraday only)"
    assert all(r["closed_at"][11:16] <= "15:30" for r in rows)
    closed = sorted(rows, key=lambda r: r["opened_at"])
    for a, b in zip(closed, closed[1:]):
        assert b["opened_at"] >= a["closed_at"], "two positions open at once"
    for r in rows:
        assert r["quantity"] * r["avg_price"] <= 18_000 + 1e-6
        assert r["protection_status"] in ("PROTECTED", "LOST", "UNPROTECTED")
    assert not env.risk.kill_switch_active()
    assert env.store.one("SELECT COUNT(*) n FROM risk_events WHERE kind='post_fill_risk_exceeded'")["n"] == 0


def test_every_entry_was_protected_before_any_new_entry(drill):
    env, _ = drill
    unprotected = env.store.query(
        "SELECT p.position_id FROM trading_positions p WHERE NOT EXISTS ("
        "SELECT 1 FROM order_intents i WHERE i.parent_intent_id=p.entry_intent_id AND i.role='STOP')")
    assert unprotected == [], "a position was opened without a protective STOP order"
    bad = env.store.query("SELECT position_id, protection_status FROM trading_positions "
                          "WHERE protection_status != 'PROTECTED'")
    assert bad == [], "a position was never confirmed PROTECTED"
    n_pos = env.store.one("SELECT COUNT(*) n FROM trading_positions")["n"]
    n_stop = env.store.one("SELECT COUNT(*) n FROM order_intents WHERE role='STOP'")["n"]
    assert n_stop == n_pos, "exactly one protective stop per position (no duplicates)"


def test_paper_drill_data_is_consistent_and_auditable(drill):
    env, _ = drill
    assert env.store.verify_audit_chain()[0]
    dq = run_data_quality(env.store, "t1")
    assert dq["new_issues"] == {}, dq
    assert run_ledger_reconciliation(env.store, "t1", "PAPER")["open"] == 0
    rep = env.om.reconcile()
    assert rep.ok, rep.mismatches
    m = Analytics(env.store).overview("t1", "PAPER")["metrics"]
    assert m["trade_count"] == env.store.one("SELECT COUNT(*) n FROM trading_positions WHERE state='CLOSED'")["n"]
    ledger = env.store.one("SELECT ROUND(SUM(realized_net),2) s FROM daily_account_pnl")["s"]
    assert m["net_profit"] == pytest.approx(ledger, abs=0.05)
    # broker cash equals start + net pnl (paper broker deducts the same charges the OMS records)
    assert env.broker.cash == pytest.approx(20_000 + ledger, abs=max(1.0, 0.5 * m["trade_count"] ** 0.5))


def test_daily_loss_cutoff_never_exceeded_by_more_than_one_trade_of_slippage(drill):
    env, _ = drill
    for d in env.store.query("SELECT trade_date, realized_net, locked FROM daily_account_pnl"):
        # the cutoff is 200; a stop gap can overshoot by at most a trade's own budget, never allow a 3rd big loss
        assert d["realized_net"] > -(200 + 125), d["trade_date"]


def test_single_live_bot_runner_rejects_other_bots_in_live_mode():
    env = Env(mode=ExecutionMode.LIVE)
    r = build(env, ["BOT_01_VWAP_EMA_VOLUME", "BOT_03_EMA_CROSSOVER"], ExecutionMode.LIVE)
    r.arbiter.live_enabled = {"BOT_03_EMA_CROSSOVER"}
    env.live_ok = False  # no authorisation: even the enabled bot must not reach the broker
    data = {s: candles_for(s, 5, 70 + i, 300.0 + 100 * i) for i, s in enumerate(SYMS)}
    env.clock.t = min(c.start for cs in data.values() for c in cs)
    replay_candles(r, env.clock, data)
    assert len(env.broker.orders) == 0, "an order reached the broker without live authorisation"
    assert env.store.one("SELECT COUNT(*) n FROM order_intents")["n"] == 0
    assert env.store.one("SELECT COUNT(*) n FROM bot_signals WHERE status='SUBMITTED'")["n"] == 0
    # BOT_01 is not live-enabled: any signal it produced must have been rejected, never submitted
    b1 = env.store.query("SELECT status, reject_reasons FROM bot_signals WHERE bot_id='BOT_01_VWAP_EMA_VOLUME' "
                         "AND signal=1")
    assert all(x["status"] == "REJECTED" and x["reject_reasons"] != "[]" for x in b1)


def test_stale_or_bad_candles_are_rejected_not_traded():
    env = Env()
    r = build(env, ["BOT_01_VWAP_EMA_VOLUME"])
    c = candles_for("AAA", 1, 1, 400.0)[0]
    env.clock.t = c.start  # candle not yet complete
    ev = r.on_candle(c, env.clock())
    assert ev and ev[0].kind == "candle_rejected" and ev[0].detail["reason"] == "incomplete"
    assert env.store.one("SELECT COUNT(*) n FROM system_health_events WHERE component='candle_rejected'")["n"] == 1

