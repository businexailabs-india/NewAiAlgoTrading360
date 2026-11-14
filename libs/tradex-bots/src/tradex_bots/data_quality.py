"""Market calendar, candle data-quality checks and corporate-action handling.

NOTE: no NSE holiday list is bundled. A wrong hard-coded list is worse than none, so the operator must supply
the exchange-published holiday list via `MarketCalendar.from_json(...)` / `config/nse_holidays.json`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from pathlib import Path

import pandas as pd

from tradex_bots.timeutil import IST


class MarketCalendar:
    def __init__(self, holidays: set[date] | None = None):
        self.holidays = set(holidays or set())

    @classmethod
    def from_json(cls, path: str | Path) -> "MarketCalendar":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls({date.fromisoformat(d) for d in data.get("holidays", [])})

    def is_trading_day(self, d: date) -> bool:
        return d.weekday() < 5 and d not in self.holidays

    def trading_days(self, start: date, end: date) -> list[date]:
        out, d = [], start
        while d <= end:
            if self.is_trading_day(d):
                out.append(d)
            d += timedelta(days=1)
        return out


@dataclass
class DataQualityReport:
    symbol: str
    rows: int = 0
    duplicates: int = 0
    out_of_order: int = 0
    insane_rows: int = 0
    non_trading_day_rows: int = 0
    missing_by_day: dict[str, int] = field(default_factory=dict)  # date -> missing candle count
    suspected_unadjusted_actions: list[str] = field(default_factory=list)
    bad_days: set[date] = field(default_factory=set)  # days excluded from signal generation

    @property
    def ok(self) -> bool:
        return not (self.duplicates or self.out_of_order or self.insane_rows or self.missing_by_day
                    or self.non_trading_day_rows or self.suspected_unadjusted_actions)

    def to_dict(self) -> dict:
        return {"symbol": self.symbol, "rows": self.rows, "duplicates": self.duplicates,
                "out_of_order": self.out_of_order, "insane_rows": self.insane_rows,
                "non_trading_day_rows": self.non_trading_day_rows, "missing_by_day": self.missing_by_day,
                "suspected_unadjusted_actions": self.suspected_unadjusted_actions,
                "bad_days": sorted(d.isoformat() for d in self.bad_days), "ok": self.ok}


def expected_starts(d: date, open_t: time = time(9, 15), close_t: time = time(15, 30), step: int = 5) -> list[datetime]:
    cur = datetime.combine(d, open_t, tzinfo=IST)
    end = datetime.combine(d, close_t, tzinfo=IST)
    out = []
    while cur < end:
        out.append(cur)
        cur += timedelta(minutes=step)
    return out


def check_candles(df: pd.DataFrame, calendar: MarketCalendar | None = None, *, max_overnight_gap_pct: float = 20.0,
                  skip_days_with_gaps: bool = True) -> tuple[pd.DataFrame, DataQualityReport]:
    """Validate a candle frame (columns: symbol,start,open,high,low,close,volume). Returns (clean_df, report).
    Duplicates are dropped (first kept); out-of-order rows are sorted; days with missing candles or suspected
    unadjusted corporate actions are listed in `bad_days` (signals are not generated on those days)."""
    sym = str(df["symbol"].iloc[0]) if len(df) else ""
    rep = DataQualityReport(symbol=sym, rows=len(df))
    if df.empty:
        return df, rep
    d = df.copy()
    d["start"] = pd.to_datetime(d["start"])
    rep.out_of_order = int((d["start"].diff().dt.total_seconds() < 0).sum())
    d = d.sort_values("start", kind="stable")
    dup = d["start"].duplicated(keep="first")
    rep.duplicates = int(dup.sum())
    d = d[~dup]
    sane = (d["low"] <= d[["open", "close"]].min(axis=1)) & (d["high"] >= d[["open", "close"]].max(axis=1)) \
        & (d["low"] > 0) & (d["volume"] >= 0)
    rep.insane_rows = int((~sane).sum())
    d = d[sane].reset_index(drop=True)

    local = d["start"].dt.tz_convert(IST)
    days = local.dt.date
    if calendar is not None:
        bad_rows = ~days.map(calendar.is_trading_day)
        rep.non_trading_day_rows = int(bad_rows.sum())
        d = d[~bad_rows].reset_index(drop=True)
        local = d["start"].dt.tz_convert(IST)
        days = local.dt.date
    for day, grp in d.groupby(days):
        have = set(grp["start"].dt.tz_convert(IST))
        missing = [s for s in expected_starts(day) if s not in have]
        if missing:
            rep.missing_by_day[day.isoformat()] = len(missing)
            if skip_days_with_gaps:
                rep.bad_days.add(day)
    # overnight gaps that look like unadjusted splits/bonuses
    daily = d.assign(day=days).groupby("day").agg(first_open=("open", "first"), last_close=("close", "last"))
    prev_close = daily["last_close"].shift(1)
    gap = (daily["first_open"] / prev_close - 1.0).abs() * 100.0
    for day, g in gap[gap > max_overnight_gap_pct].items():
        rep.suspected_unadjusted_actions.append(f"{day.isoformat()}:{g:.1f}%")
        rep.bad_days.add(day)
    return d, rep


@dataclass(frozen=True)
class CorporateAction:
    symbol: str
    ex_date: date
    kind: str  # SPLIT | BONUS
    ratio_old: float  # e.g. 1:5 split -> old=1, new=5 ; 1:1 bonus -> old=1, new=1 (adds 1 share per 1 held)
    ratio_new: float

    @property
    def factor(self) -> float:
        """Share-count multiplier on the ex-date. Prices before ex-date are divided by this, volumes multiplied."""
        if self.kind == "SPLIT":
            return self.ratio_new / self.ratio_old
        if self.kind == "BONUS":
            return (self.ratio_old + self.ratio_new) / self.ratio_old
        raise ValueError(f"unsupported corporate action kind {self.kind}")


def adjust_for_corporate_actions(df: pd.DataFrame, actions: list[CorporateAction]) -> pd.DataFrame:
    """Back-adjust prices/volumes before each ex-date so indicators are continuous (no look-ahead: only past
    values are rescaled by a factor that is known on the ex-date). Also tag ex-dates as event days."""
    out = df.copy()
    days = out["start"].dt.tz_convert(IST).dt.date
    for a in sorted(actions, key=lambda x: x.ex_date):
        if a.symbol != (out["symbol"].iloc[0] if len(out) else a.symbol):
            continue
        mask = days < a.ex_date
        f = a.factor
        for col in ("open", "high", "low", "close"):
            out.loc[mask, col] = out.loc[mask, col] / f
        out.loc[mask, "volume"] = out.loc[mask, "volume"] * f
        if "turnover" in out:
            pass  # turnover (price*qty) is invariant under splits/bonuses
    return out


def event_days(actions: list[CorporateAction]) -> set[date]:
    """Ex-dates are treated as corporate-action event days: no new entries."""
    return {a.ex_date for a in actions}
