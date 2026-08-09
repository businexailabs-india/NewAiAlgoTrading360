from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

from ibkr_orb_paper.config import Settings, RunMode
from ibkr_orb_paper.domain.models import AccountSnapshot


def is_rth_now(settings: Settings, now: datetime | None = None) -> bool:
    tz = ZoneInfo(settings.market_timezone)
    now = now or datetime.now(tz)
    if now.tzinfo is None:
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)
    if now.weekday() >= 5:
        return False
    t = now.time()
    return time(9, 30) <= t <= time(16, 0)


def verify_paper_account(settings: Settings, managed: list[str], selected: str) -> AccountSnapshot:
    """
    Never auto-select the first account. Must match configured DU paper ID exactly.
    Rejects live U accounts.
    """
    settings.assert_not_live_account_id(selected)
    if selected not in managed:
        raise ValueError("Selected account is not in IBKR managed account list")
    # Reject if any attempt to use non-configured account
    if selected.strip().upper() != settings.ibkr_paper_account_id.strip().upper():
        raise ValueError("Account mismatch vs IBKR_PAPER_ACCOUNT_ID")
    return AccountSnapshot(selected, settings.starting_equity, settings.ibkr_base_currency, True)


def assert_mode_allowed(settings: Settings, mode: RunMode) -> None:
    if mode == RunMode.PAPER:
        if settings.dry_run:
            raise ValueError("PAPER mode requires DRY_RUN=false")
        if not settings.paper_orders_flag_ok:
            raise ValueError("PAPER mode requires ENABLE_PAPER_ORDERS=YES")
        if not settings.can_submit_paper_orders():
            raise ValueError("PAPER mode failed safety prechecks (account/port/flags)")
