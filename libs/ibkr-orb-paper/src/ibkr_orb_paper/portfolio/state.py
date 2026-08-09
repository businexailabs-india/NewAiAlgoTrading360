from __future__ import annotations

from dataclasses import dataclass

from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import PortfolioSnapshot


@dataclass
class PortfolioState:
    settings: Settings
    equity: float
    equity_peak: float
    daily_pnl: float = 0.0
    weekly_pnl: float = 0.0
    open_quantity: int = 0
    trades_today: int = 0
    monthly_sizing_equity: float | None = None
    active_entry: bool = False

    @classmethod
    def from_settings(cls, settings: Settings, net_liq: float | None = None) -> PortfolioState:
        eq = float(net_liq if net_liq is not None else settings.starting_equity)
        return cls(
            settings=settings,
            equity=eq,
            equity_peak=eq,
            monthly_sizing_equity=eq,
        )

    def snapshot(self) -> PortfolioSnapshot:
        dd = 0.0
        if self.equity_peak > 0:
            dd = max(0.0, (self.equity_peak - self.equity) / self.equity_peak)
        return PortfolioSnapshot(
            equity=self.equity,
            equity_peak=self.equity_peak,
            daily_pnl=self.daily_pnl,
            weekly_pnl=self.weekly_pnl,
            drawdown_pct=dd,
            open_quantity=self.open_quantity,
            trades_today=self.trades_today,
            monthly_sizing_equity=self.monthly_sizing_equity or self.equity,
        )

    def apply_fill_pnl(self, net_pnl: float) -> None:
        self.equity += net_pnl
        self.daily_pnl += net_pnl
        self.weekly_pnl += net_pnl
        self.equity_peak = max(self.equity_peak, self.equity)
