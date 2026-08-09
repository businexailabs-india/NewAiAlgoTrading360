from __future__ import annotations

import pytest

from ibkr_orb_paper.config import Settings, RunMode
from ibkr_orb_paper.orders.bracket import build_bracket_spec, build_ib_bracket_dicts, validate_bracket_sequence
from ibkr_orb_paper.domain.models import SignalDecision, SignalResult
from ibkr_orb_paper.safety.gates import assert_mode_allowed, verify_paper_account
from datetime import datetime
from zoneinfo import ZoneInfo


def test_live_account_rejected() -> None:
    s = Settings.model_validate({"ibkr_paper_account_id": "DU1234567", "dry_run": True})
    with pytest.raises(ValueError, match="Live account"):
        s.assert_not_live_account_id("U1234567")


def test_missing_paper_account_rejected() -> None:
    s = Settings.model_validate({"ibkr_paper_account_id": "", "dry_run": False, "enable_paper_orders": "YES", "ibkr_port": 7497})
    assert s.can_submit_paper_orders() is False
    with pytest.raises(ValueError):
        s.assert_not_live_account_id("DU1234567")


def test_incorrect_account_rejected() -> None:
    s = Settings.model_validate({"ibkr_paper_account_id": "DU1111111"})
    with pytest.raises(ValueError, match="does not match"):
        s.assert_not_live_account_id("DU2222222")
    with pytest.raises(ValueError):
        verify_paper_account(s, ["DU1111111", "DU9999999"], "DU9999999")


def test_never_auto_first_account() -> None:
    s = Settings.model_validate({"ibkr_paper_account_id": "DU9999999"})
    # Must pass the configured one, not managed[0]
    snap = verify_paper_account(s, ["DU1111111", "DU9999999"], "DU9999999")
    assert snap.account_id == "DU9999999"


def test_paper_mode_requires_flags() -> None:
    s = Settings.model_validate(
        {
            "dry_run": True,
            "enable_paper_orders": "NO",
            "ibkr_paper_account_id": "DU1234567",
            "ibkr_port": 7497,
        }
    )
    with pytest.raises(ValueError):
        assert_mode_allowed(s, RunMode.PAPER)


def test_bracket_transmit_sequence() -> None:
    sig = SignalResult(
        SignalDecision.BUY,
        "SPY",
        datetime(2024, 6, 3, 10, 15, tzinfo=ZoneInfo("America/New_York")),
        entry_price=100.0,
        stop_price=99.0,
        target_price=101.5,
        quantity=2,
    )
    spec = build_bracket_spec(sig, account_id="DU1234567", strategy_id="ORB_TEST")
    orders = build_ib_bracket_dicts(spec, 10, 11, 12)
    validate_bracket_sequence(orders)
    assert orders[0]["transmit"] is False
    assert orders[1]["parentId"] == 10
    assert orders[2]["transmit"] is True


def test_partial_fill_exit_qty() -> None:
    from ibkr_orb_paper.orders.manager import OrderManager
    from ibkr_orb_paper.broker.fake import FakeIBKRAdapter
    from ibkr_orb_paper.persistence.repository import TradeRepository
    from ibkr_orb_paper.risk.manager import RiskManager
    import tempfile
    from pathlib import Path

    s = Settings.model_validate({"ibkr_paper_account_id": "DU1234567", "sqlite_path": str(Path(tempfile.mkdtemp()) / "t.db")})
    om = OrderManager(s, FakeIBKRAdapter(), TradeRepository(s.sqlite_path), RiskManager(s))
    assert om.adjust_exits_for_partial(3, 1, 2, 10) == 3
    assert om.adjust_exits_for_partial(0, 1, 2, 10) == 0
