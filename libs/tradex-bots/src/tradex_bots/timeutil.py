"""Time helpers. India has no DST, so a fixed +05:30 offset is exact and avoids a tzdata dependency."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def now_ist() -> datetime:
    return datetime.now(IST)


def to_ist(ts: datetime) -> datetime:
    """Convert to IST. Naive datetimes are rejected: they are a common look-ahead/timezone bug source."""
    if ts.tzinfo is None:
        raise ValueError("naive datetime not allowed; attach a timezone (IST expected)")
    return ts.astimezone(IST)


def ist_date(ts: datetime) -> date:
    return to_ist(ts).date()


def at(d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=IST)


def parse_hhmm(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


def end_of_ist_day(ts: datetime) -> datetime:
    d = ist_date(ts)
    return at(d, time(23, 59, 59))
