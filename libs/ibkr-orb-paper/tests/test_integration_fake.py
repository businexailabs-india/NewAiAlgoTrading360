from __future__ import annotations

import tempfile
from pathlib import Path

from ibkr_orb_paper.app.runner import AppRunner
from ibkr_orb_paper.broker.fake import FakeIBKRAdapter, make_synthetic_orb_day
from ibkr_orb_paper.config import RunMode, Settings
from ibkr_orb_paper.domain.models import SignalDecision
from ibkr_orb_paper.orders.manager import OrderManager
from ibkr_orb_paper.persistence.repository import TradeRepository
from ibkr_orb_paper.risk.manager import RiskManager


def _tmp_settings(**kwargs) -> Settings:
    db = Path(tempfile.mkdtemp()) / "orb.db"
    base = {
        "dry_run": True,
        "enable_paper_orders": "NO",
        "ibkr_paper_account_id": "DU1234567",
        "ibkr_port": 7497,
        "starting_equity": 2400.0,
        "sqlite_path": str(db),
        "symbol": "SPY",
        "max_data_age_seconds": 60,
    }
    base.update(kwargs)
    return Settings.model_validate(base)


def test_synthetic_day_signal_dry_run_and_restart_idempotency() -> None:
    settings = _tmp_settings()
    bars = make_synthetic_orb_day(breakout=True)
    broker = FakeIBKRAdapter(accounts=["DU1234567", "DU9999999"], selected="DU1234567", bars=bars)
    runner = AppRunner(settings, broker)
    r1 = runner.run_once(RunMode.SIGNAL)
    assert r1["decision"] == SignalDecision.BUY.value
    assert r1["quantity"] > 0

    # Restart with same SQLite: breakout already persisted — must not re-trade
    broker2 = FakeIBKRAdapter(accounts=["DU1234567"], selected="DU1234567", bars=bars)
    r2 = AppRunner(settings, broker2).run_once(RunMode.DRY_RUN)
    assert r2["decision"] == SignalDecision.REJECT.value
    assert broker2.submit_calls == 0
    assert any("duplicate" in x for x in r2["reasons"])


def test_paper_mode_with_fake_submits_once() -> None:
    settings = _tmp_settings(dry_run=False, enable_paper_orders="YES")
    bars = make_synthetic_orb_day(breakout=True)
    broker = FakeIBKRAdapter(accounts=["DU1234567"], selected="DU1234567", bars=bars, data_age=1.0)
    r = AppRunner(settings, broker).run_once(RunMode.PAPER)
    assert r["decision"] == SignalDecision.BUY.value
    assert broker.submit_calls == 1
    # restart idempotency
    broker2 = FakeIBKRAdapter(accounts=["DU1234567"], bars=bars)
    r2 = AppRunner(settings, broker2).run_once(RunMode.PAPER)
    assert r2["decision"] == SignalDecision.REJECT.value
    assert broker2.submit_calls == 0


def test_stale_data_blocks_paper() -> None:
    settings = _tmp_settings(dry_run=False, enable_paper_orders="YES", max_data_age_seconds=1)
    bars = make_synthetic_orb_day(breakout=True)
    broker = FakeIBKRAdapter(accounts=["DU1234567"], bars=bars, data_age=999.0)
    try:
        AppRunner(settings, broker).run_once(RunMode.PAPER)
        raised = False
    except Exception:
        raised = True
    assert raised


def test_delayed_data_blocks_paper() -> None:
    settings = _tmp_settings(dry_run=False, enable_paper_orders="YES")
    bars = make_synthetic_orb_day(breakout=True)
    broker = FakeIBKRAdapter(accounts=["DU1234567"], bars=bars, delayed=True)
    try:
        AppRunner(settings, broker).run_once(RunMode.PAPER)
        raised = False
    except Exception:
        raised = True
    assert raised


def test_reconcile_on_fake() -> None:
    settings = _tmp_settings()
    broker = FakeIBKRAdapter(accounts=["DU1234567"], bars=make_synthetic_orb_day())
    broker.connect()
    om = OrderManager(settings, broker, TradeRepository(settings.sqlite_path), RiskManager(settings))
    out = om.reconcile()
    assert "open_orders" in out
