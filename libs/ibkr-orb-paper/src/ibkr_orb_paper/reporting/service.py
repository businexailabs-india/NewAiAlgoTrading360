from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from ibkr_orb_paper.persistence.repository import TradeRepository


@dataclass
class DayReport:
    signals: int
    accepted: int
    rejected: int
    win_rate: float | None
    gross_pnl: float
    net_pnl: float
    max_drawdown: float
    notes: str


class ReportingService:
    def __init__(self, repo: TradeRepository) -> None:
        self.repo = repo

    def build_day_report(self, day: str) -> DayReport:
        rows = self.repo.signals_for_date(day)
        accepted = sum(1 for r in rows if r["decision"] == "BUY")
        rejected = sum(1 for r in rows if r["decision"] == "REJECT")
        return DayReport(
            signals=len(rows),
            accepted=accepted,
            rejected=rejected,
            win_rate=None,
            gross_pnl=0.0,
            net_pnl=0.0,
            max_drawdown=0.0,
            notes="Hypothetical projections are not shown as expected outcomes.",
        )

    def write_csv(self, day: str, path: str) -> str:
        rows = self.repo.signals_for_date(day)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["signal_id", "ts", "symbol", "decision", "quantity", "entry", "stop", "target", "reasons"])
            for r in rows:
                w.writerow(
                    [
                        r["signal_id"],
                        r["ts"],
                        r["symbol"],
                        r["decision"],
                        r["quantity"],
                        r["entry_price"],
                        r["stop_price"],
                        r["target_price"],
                        r["reasons"],
                    ]
                )
        return path
