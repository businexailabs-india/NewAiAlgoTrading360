from __future__ import annotations

from dataclasses import dataclass, field

from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import PortfolioSnapshot, RiskGateResult


@dataclass
class RiskManager:
    settings: Settings
    kill_switch: bool = False
    halt_new_orders: bool = False
    reasons: list[str] = field(default_factory=list)

    def engage_kill_switch(self) -> None:
        self.kill_switch = True
        self.halt_new_orders = True

    def halt(self, reason: str) -> None:
        self.halt_new_orders = True
        self.reasons.append(reason)

    def evaluate(
        self,
        *,
        portfolio: PortfolioSnapshot,
        has_position: bool,
        has_active_entry: bool,
        data_fresh: bool,
        data_delayed: bool,
        in_rth: bool,
        quantity: int,
        stop_distance: float,
        entry_price: float,
        account_verified_paper: bool,
        connection_ok: bool,
        duplicate_breakout: bool,
    ) -> list[RiskGateResult]:
        gates: list[RiskGateResult] = []

        def add(name: str, ok: bool, detail: str) -> None:
            gates.append(RiskGateResult(name, ok, detail))

        add("paper_account", account_verified_paper, "verified DU paper account" if account_verified_paper else "paper account not verified")
        add("connection", connection_ok, "connected" if connection_ok else "disconnected")
        add("market_data_fresh", data_fresh and not data_delayed, "fresh" if data_fresh and not data_delayed else "stale/delayed")
        add("rth", in_rth, "regular trading hours" if in_rth else "outside RTH")
        add("no_position", not has_position, "flat" if not has_position else "already in position")
        add("no_active_entry", not has_active_entry, "no working entry" if not has_active_entry else "entry order open")
        add("max_trades", portfolio.trades_today < self.settings.max_trades_per_day, f"trades_today={portfolio.trades_today}")
        daily_limit = portfolio.equity * self.settings.daily_loss_limit_pct
        weekly_limit = portfolio.equity * self.settings.weekly_loss_limit_pct
        add("daily_loss", portfolio.daily_pnl > -daily_limit, f"daily_pnl={portfolio.daily_pnl:.2f}")
        add("weekly_loss", portfolio.weekly_pnl > -weekly_limit, f"weekly_pnl={portfolio.weekly_pnl:.2f}")
        add(
            "drawdown_pause",
            portfolio.drawdown_pct < self.settings.drawdown_pause_pct,
            f"dd={portfolio.drawdown_pct:.4f}",
        )
        add("quantity", quantity > 0, f"qty={quantity}")
        add("stop_distance", stop_distance > 0, f"stop_dist={stop_distance}")
        add("entry_price", entry_price > 0, f"entry={entry_price}")
        max_risk = portfolio.equity * self.settings.risk_per_trade_pct
        expected_risk = quantity * stop_distance if quantity > 0 else 0.0
        add("max_risk", expected_risk <= max_risk * 1.01 + 1e-6, f"expected_risk={expected_risk:.2f}")
        capital_at_risk = quantity * entry_price
        max_deploy = portfolio.equity * self.settings.max_capital_deployment_pct
        add("max_deployment", capital_at_risk <= max_deploy + 1e-6, f"deploy={capital_at_risk:.2f}")
        add("duplicate_breakout", not duplicate_breakout, "unique breakout" if not duplicate_breakout else "already traded breakout")
        add("kill_switch", not self.kill_switch and not self.settings.kill_switch, "off" if not self.kill_switch else "ON")
        add("halt", not self.halt_new_orders, "ok" if not self.halt_new_orders else "halted")

        return gates

    def all_passed(self, gates: list[RiskGateResult]) -> bool:
        return all(g.passed for g in gates)
