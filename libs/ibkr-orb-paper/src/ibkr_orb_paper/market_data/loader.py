from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from ibkr_orb_paper.domain.models import Bar


def filter_completed(bars: list[Bar]) -> list[Bar]:
    """Return only completed bars."""
    return [b for b in bars if b.complete]


def filter_rth(
    bars: list[Bar],
    *,
    market_timezone: str = "America/New_York",
    session_open_hour: int = 9,
    session_open_minute: int = 30,
    session_close_hour: int = 16,
    session_close_minute: int = 0,
) -> list[Bar]:
    tz = ZoneInfo(market_timezone)
    out: list[Bar] = []
    for b in bars:
        t = b.ts.astimezone(tz) if b.ts.tzinfo else b.ts.replace(tzinfo=tz)
        if t.weekday() >= 5:
            continue
        open_m = session_open_hour * 60 + session_open_minute
        close_m = session_close_hour * 60 + session_close_minute
        mins = t.hour * 60 + t.minute
        if open_m < mins <= close_m:
            out.append(b)
    return out


def ensure_tz(bars: list[Bar], market_timezone: str) -> list[Bar]:
    tz = ZoneInfo(market_timezone)
    fixed: list[Bar] = []
    for b in bars:
        ts = b.ts if b.ts.tzinfo else b.ts.replace(tzinfo=tz)
        fixed.append(
            Bar(ts.astimezone(tz), b.open, b.high, b.low, b.close, b.volume, b.complete)
        )
    return fixed


def bars_as_of(bars: list[Bar], as_of: datetime) -> list[Bar]:
    """Point-in-time slice: only bars with ts <= as_of (no look-ahead)."""
    return [b for b in bars if b.ts <= as_of]
