from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from ibkr_orb_paper.broker.protocol import BrokerAdapter, BrokerError
from ibkr_orb_paper.config import RunMode, Settings
from ibkr_orb_paper.domain.models import SignalDecision
from ibkr_orb_paper.logging_setup import get_logger, setup_logging
from ibkr_orb_paper.orders.manager import OrderManager
from ibkr_orb_paper.persistence.repository import TradeRepository
from ibkr_orb_paper.portfolio.state import PortfolioState
from ibkr_orb_paper.risk.manager import RiskManager
from ibkr_orb_paper.safety.gates import assert_mode_allowed, is_rth_now, verify_paper_account
from ibkr_orb_paper.strategy.orb import OpeningRangeBreakoutStrategy

log = get_logger(__name__)


def print_banner(settings: Settings, mode: RunMode) -> None:
    line = settings.banner_mode(mode)
    print("=" * 72)
    print("IBKR ORB Paper Bot — RESEARCH / PAPER TRADING ONLY")
    print("Live trading is not available and cannot be enabled.")
    print(f"Mode: {line}")
    print(f"Symbol: {settings.symbol} | Port: {settings.ibkr_port} | DRY_RUN={settings.dry_run}")
    print(f"ENABLE_PAPER_ORDERS={settings.enable_paper_orders}")
    print("=" * 72)


class AppRunner:
    def __init__(self, settings: Settings, broker: BrokerAdapter) -> None:
        self.settings = settings
        self.broker = broker
        self.repo = TradeRepository(settings.sqlite_path)
        self.risk = RiskManager(settings)
        self.strategy = OpeningRangeBreakoutStrategy(settings)
        self.orders = OrderManager(settings, broker, self.repo, self.risk)
        self.portfolio = PortfolioState.from_settings(settings)
        self.account_id: str | None = None
        self.con_id: int | None = None
        self.min_tick = settings.min_tick

    def connect_and_verify(self, *, require_account: bool) -> None:
        self.broker.connect()
        if not self.broker.is_connected():
            raise BrokerError("Not connected")
        managed = self.broker.list_managed_accounts()
        if require_account:
            if not self.settings.ibkr_paper_account_id.strip():
                raise ValueError("IBKR_PAPER_ACCOUNT_ID missing — never auto-selecting first account")
            # Never use managed[0]
            snap = verify_paper_account(self.settings, managed, self.settings.ibkr_paper_account_id)
            acct = self.broker.select_account(snap.account_id)
            self.account_id = acct.account_id
            self.portfolio = PortfolioState.from_settings(self.settings, acct.net_liquidation)
        contract = self.broker.qualify_contract(
            self.settings.symbol,
            self.settings.security_type,
            self.settings.exchange,
            self.settings.currency,
            self.settings.primary_exchange,
        )
        self.con_id = contract.con_id
        self.min_tick = contract.min_tick or self.settings.min_tick

    def restore_breakouts(self) -> None:
        for key in self.repo.load_breakouts():
            self.strategy.mark_breakout_traded(key)

    def run_once(self, mode: RunMode) -> dict:
        setup_logging()
        print_banner(self.settings, mode)
        assert_mode_allowed(self.settings, mode)

        require_account = mode in (RunMode.DRY_RUN, RunMode.PAPER) or bool(
            self.settings.ibkr_paper_account_id.strip()
        )
        # Signal mode may run without account if only computing offline bars via fake;
        # with real IBKR still connect read-only.
        self.connect_and_verify(require_account=require_account or mode != RunMode.SIGNAL)
        if mode == RunMode.SIGNAL and not self.account_id and self.settings.ibkr_paper_account_id:
            managed = self.broker.list_managed_accounts()
            snap = verify_paper_account(self.settings, managed, self.settings.ibkr_paper_account_id)
            acct = self.broker.select_account(snap.account_id)
            self.account_id = acct.account_id
            self.portfolio = PortfolioState.from_settings(self.settings, acct.net_liquidation)

        self.restore_breakouts()
        try:
            self.orders.reconcile()
        except Exception as e:  # noqa: BLE001
            log.error("Reconcile failed: %s", e)
            raise

        run_id = self.repo.start_run(mode.value, self.settings.symbol, self.settings.strategy_id)
        bars = self.broker.historical_bars(self.con_id or 0, self.settings.bar_size)
        age = self.broker.market_data_age_seconds()
        delayed = self.broker.market_data_is_delayed()
        data_fresh = age <= self.settings.max_data_age_seconds
        if not data_fresh or delayed:
            if mode == RunMode.PAPER:
                self.orders.halt("stale or delayed market data")
                raise BrokerError("Paper orders blocked: stale/delayed market data")
            self.repo.log_event("stale_data", f"age={age} delayed={delayed}")

        # Force RTH check using last bar timezone for offline fixtures
        in_rth = is_rth_now(self.settings)
        if bars:
            last_ts = bars[-1].ts
            tz = ZoneInfo(self.settings.market_timezone)
            t = last_ts.astimezone(tz) if last_ts.tzinfo else last_ts.replace(tzinfo=tz)
            from datetime import time as dtime

            in_rth = t.weekday() < 5 and dtime(9, 30) <= t.time() <= dtime(16, 0)

        pos = self.broker.positions()
        has_position = any(
            p.get("symbol") == self.settings.symbol and float(p.get("position", 0) or 0) != 0 for p in pos
        )
        open_o = self.broker.open_orders()
        has_active = any(
            o.get("symbol") == self.settings.symbol
            and (o.get("strategy_id") == self.settings.strategy_id or o.get("orderRef") == self.settings.strategy_id)
            for o in open_o
        )

        signal = self.strategy.evaluate(
            bars,
            portfolio=self.portfolio.snapshot(),
            has_position=has_position,
            has_active_entry=has_active,
            min_tick=self.min_tick,
        )

        account_ok = False
        if self.account_id:
            try:
                self.settings.assert_not_live_account_id(self.account_id)
                account_ok = True
            except ValueError:
                account_ok = False

        gates = self.risk.evaluate(
            portfolio=self.portfolio.snapshot(),
            has_position=has_position,
            has_active_entry=has_active,
            data_fresh=data_fresh,
            data_delayed=delayed,
            in_rth=in_rth,
            quantity=signal.quantity,
            stop_distance=signal.stop_distance or 0.0,
            entry_price=signal.entry_price or 0.0,
            account_verified_paper=account_ok,
            connection_ok=self.broker.is_connected(),
            duplicate_breakout=bool(signal.breakout_key and self.strategy.has_traded_breakout(signal.breakout_key)),
        )

        # Paper/dry-run: hard-reject on any failed gate. Signal mode: persist proposal + gate results.
        if (
            signal.decision == SignalDecision.BUY
            and mode != RunMode.SIGNAL
            and not self.risk.all_passed(gates)
        ):
            failed = [g.name for g in gates if not g.passed]
            signal.decision = SignalDecision.REJECT
            signal.reasons = list(signal.reasons) + [f"risk gate failed: {', '.join(failed)}"]
            signal.quantity = 0

        account_for_order = self.account_id or self.settings.ibkr_paper_account_id or "UNSET"
        spec = self.orders.process_signal(
            signal,
            mode=mode,
            account_id=account_for_order,
            run_id=run_id,
            con_id=self.con_id,
            gates=gates,
        )
        if signal.decision == SignalDecision.BUY and signal.breakout_key:
            self.strategy.mark_breakout_traded(signal.breakout_key)

        snap = self.portfolio.snapshot()
        self.repo.save_portfolio(snap.equity, snap.equity_peak, snap.daily_pnl, snap.weekly_pnl, snap.drawdown_pct)

        result = {
            "run_id": run_id,
            "decision": signal.decision.value,
            "reasons": signal.reasons,
            "entry": signal.entry_price,
            "stop": signal.stop_price,
            "target": signal.target_price,
            "quantity": signal.quantity,
            "order_key": spec.client_order_key if spec else None,
            "gates": [{"name": g.name, "passed": g.passed, "detail": g.detail} for g in gates],
        }
        log.info("Run complete: %s", result)
        print(result)
        return result

    def status(self) -> dict:
        self.connect_and_verify(require_account=bool(self.settings.ibkr_paper_account_id))
        return {
            "connected": self.broker.is_connected(),
            "accounts": self.broker.list_managed_accounts(),
            "configured_paper": self.settings.ibkr_paper_account_id or "(empty)",
            "open_orders": self.broker.open_orders(),
            "positions": self.broker.positions(),
            "data_age": self.broker.market_data_age_seconds(),
            "delayed": self.broker.market_data_is_delayed(),
            "kill_switch": self.risk.kill_switch or self.settings.kill_switch,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def kill_switch(self) -> dict:
        self.risk.engage_kill_switch()
        self.connect_and_verify(require_account=True)
        n = self.orders.cancel_strategy_entries()
        self.repo.log_event("kill_switch", f"cancelled_entries={n}")
        return {"kill_switch": True, "cancelled_entries": n}
