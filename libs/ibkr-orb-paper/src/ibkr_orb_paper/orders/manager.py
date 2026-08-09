from __future__ import annotations

from ibkr_orb_paper.broker.protocol import BrokerAdapter, BrokerError
from ibkr_orb_paper.config import RunMode, Settings
from ibkr_orb_paper.domain.models import BracketOrderSpec, OrderIntentStatus, SignalResult
from ibkr_orb_paper.logging_setup import get_logger
from ibkr_orb_paper.orders.bracket import build_bracket_spec, build_ib_bracket_dicts, validate_bracket_sequence
from ibkr_orb_paper.persistence.repository import TradeRepository
from ibkr_orb_paper.risk.manager import RiskManager

log = get_logger(__name__)


class OrderManager:
    """Idempotent paper-only bracket handling. Never submits unless mode=paper and gates pass."""

    def __init__(
        self,
        settings: Settings,
        broker: BrokerAdapter,
        repo: TradeRepository,
        risk: RiskManager,
    ) -> None:
        self.settings = settings
        self.broker = broker
        self.repo = repo
        self.risk = risk
        self._known_keys: set[str] = set()
        self._halted = False

    def halt(self, reason: str) -> None:
        self._halted = True
        self.risk.halt(reason)
        self.repo.log_event("halt", reason)
        log.error("Order manager halted: %s", reason)

    def reconcile(self) -> dict:
        """Reconcile local strategy orders with broker open orders/positions/executions."""
        try:
            open_orders = self.broker.open_orders()
            positions = self.broker.positions()
            executions = self.broker.executions()
        except Exception as e:  # noqa: BLE001
            self.halt(f"reconciliation failure: {e}")
            raise
        strategy_open = [
            o for o in open_orders if o.get("strategy_id") == self.settings.strategy_id or o.get("orderRef") == self.settings.strategy_id
        ]
        self.repo.log_event(
            "reconcile",
            f"open={len(open_orders)} strategy_open={len(strategy_open)} positions={len(positions)} execs={len(executions)}",
        )
        return {
            "open_orders": open_orders,
            "strategy_open": strategy_open,
            "positions": positions,
            "executions": executions,
        }

    def process_signal(
        self,
        signal: SignalResult,
        *,
        mode: RunMode,
        account_id: str,
        run_id: str,
        con_id: int | None,
        gates: list,
    ) -> BracketOrderSpec | None:
        self.repo.save_signal(run_id, signal, con_id=con_id)
        self.repo.save_gates(signal.signal_id, gates)

        if signal.decision.value != "BUY":
            return None

        if self._halted or self.risk.halt_new_orders or self.risk.kill_switch:
            self.repo.log_event("order_blocked", "halted/kill-switch")
            return None

        if signal.breakout_key and self.repo.is_breakout_traded(signal.breakout_key):
            self.repo.log_event("duplicate_order", signal.breakout_key)
            return None

        spec = build_bracket_spec(signal, account_id=account_id, strategy_id=self.settings.strategy_id)
        if spec.client_order_key in self._known_keys:
            return None

        parent_id = 1001
        stop_id = 1002
        target_id = 1003
        orders = build_ib_bracket_dicts(spec, parent_id, stop_id, target_id)
        validate_bracket_sequence(orders)

        if mode == RunMode.SIGNAL:
            self.repo.save_order(spec, OrderIntentStatus.PROPOSED.value, signal.signal_id)
            self._known_keys.add(spec.client_order_key)
            if signal.breakout_key:
                self.repo.mark_breakout(signal.breakout_key, signal.signal_id)
            self.repo.log_event("signal_only", spec.client_order_key)
            return spec

        if mode == RunMode.DRY_RUN or self.settings.dry_run:
            self.repo.save_order(spec, OrderIntentStatus.DRY_RUN.value, signal.signal_id)
            self._known_keys.add(spec.client_order_key)
            if signal.breakout_key:
                self.repo.mark_breakout(signal.breakout_key, signal.signal_id)
            self.repo.log_event("dry_run_bracket", spec.client_order_key)
            return spec

        # PAPER
        if not self.settings.can_submit_paper_orders():
            self.halt("paper submit blocked by settings gates")
            raise BrokerError("Paper submit blocked")
        self.settings.assert_not_live_account_id(account_id)
        try:
            ids = self.broker.place_bracket(spec)
        except Exception as e:  # noqa: BLE001
            self.halt(f"unknown order state / submit failure: {e}")
            raise
        self._known_keys.add(spec.client_order_key)
        if signal.breakout_key:
            self.repo.mark_breakout(signal.breakout_key, signal.signal_id)
        self.repo.save_order(spec, OrderIntentStatus.SUBMITTED.value, signal.signal_id)
        self.repo.log_event("paper_submitted", str(ids))
        return spec

    def cancel_strategy_entries(self) -> int:
        """Cancel only this strategy's unfilled entry orders (kill switch)."""
        cancelled = 0
        for o in self.broker.open_orders():
            if o.get("strategy_id") != self.settings.strategy_id and o.get("orderRef") != self.settings.strategy_id:
                continue
            if o.get("status") in ("Submitted", "PreSubmitted", "PendingSubmit"):
                oid = int(o["order_id"])
                self.broker.cancel_order(oid)
                cancelled += 1
                self.repo.log_event("cancel_entry", str(oid))
        return cancelled

    def adjust_exits_for_partial(self, filled_qty: int, stop_id: int, target_id: int, original_qty: int) -> int:
        """Return safe exit quantity after partial fill (never exceed filled)."""
        if filled_qty <= 0:
            return 0
        return min(filled_qty, original_qty)
