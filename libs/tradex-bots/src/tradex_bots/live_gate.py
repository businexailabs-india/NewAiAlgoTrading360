"""Live-mode authorisation. Live is OFF by default; this gate is the ONLY way an order can reach Dhan.

Activation requires ALL of: env flag, explicit operator approval by an authorised role, a typed confirmation
phrase, verified runtime health, operator attestations for items the software cannot verify (static IP, SEBI /
NSE algo obligations, order tagging, validation evidence), and exactly one live-enabled bot per account.
Approvals expire at the end of the IST trading day and are never created automatically (no paper->live switch).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from tradex_bots.config import EngineConfig, live_trading_env_enabled
from tradex_bots.store import Store
from tradex_bots.timeutil import end_of_ist_day, now_ist

AUTHORISED_ROLES = {"trading_admin"}
CONFIRMATION_PHRASE = "ENABLE LIVE TRADING FOR {bot_id}"


@dataclass
class LiveAttestations:
    """Operator-attested facts the software cannot verify. Each should carry evidence text in `notes`."""

    api_permissions_verified: bool = False  # Dhan order/data API access confirmed for this account
    compliance_confirmed: bool = False  # SEBI retail-algo / NSE obligations, registrations, order tagging
    static_ip_approved: bool = False  # static IP whitelisted with Dhan
    backtest_completed: bool = False
    out_of_sample_validated: bool = False
    forward_paper_completed: bool = False
    tests_passed: bool = False
    reconciliation_tested: bool = False
    protective_exit_tested: bool = False
    notes: dict[str, str] = field(default_factory=dict)


@dataclass
class RuntimeStatus:
    credentials_valid: bool = False
    market_data_healthy: bool = False
    broker_reconciled: bool = False
    risk_engine_operational: bool = False


class LiveActivationError(PermissionError):
    pass


class LiveModeGate:
    def __init__(self, store: Store, cfg: EngineConfig, clock: Callable[[], datetime] = now_ist):
        self.store, self.cfg, self.clock = store, cfg, clock

    def _scope(self) -> dict:
        return {"tenant_id": self.cfg.tenant_id, "account_id": self.cfg.account_id, "mode": "LIVE"}

    def checklist(self, att: LiveAttestations, rt: RuntimeStatus) -> dict[str, bool]:
        return {
            "env_live_flag": live_trading_env_enabled(),
            "credentials_valid": rt.credentials_valid,
            "api_permissions_verified": att.api_permissions_verified,
            "compliance_confirmed": att.compliance_confirmed,
            "static_ip_approved": att.static_ip_approved,
            "market_data_healthy": rt.market_data_healthy,
            "broker_reconciled": rt.broker_reconciled,
            "risk_engine_operational": rt.risk_engine_operational,
            "backtest_completed": att.backtest_completed,
            "out_of_sample_validated": att.out_of_sample_validated,
            "forward_paper_completed": att.forward_paper_completed,
            "tests_passed": att.tests_passed,
            "reconciliation_tested": att.reconciliation_tested,
            "protective_exit_tested": att.protective_exit_tested,
            "kill_switch_off": self.store.get_flag(self.cfg.tenant_id, self.cfg.account_id, "kill_switch", "OFF") != "ON",
            "single_live_bot": self._other_live_bots(None) == [],
        }

    def _other_live_bots(self, bot_id: str | None) -> list[str]:
        rows = self.store.query(
            "SELECT bot_id FROM algo_bots WHERE tenant_id=? AND account_id=? AND live_enabled=1",
            (self.cfg.tenant_id, self.cfg.account_id))
        return [r["bot_id"] for r in rows if r["bot_id"] != bot_id]

    def activate(self, *, bot_id: str, operator: str, role: str, confirmation: str, att: LiveAttestations,
                 rt: RuntimeStatus) -> dict:
        s = self._scope()
        if role not in AUTHORISED_ROLES:
            self.store.audit("live_activation_denied_role", actor=operator, bot_id=bot_id, details={"role": role}, **s)
            raise LiveActivationError(f"role '{role}' is not authorised to enable live trading")
        if confirmation != CONFIRMATION_PHRASE.format(bot_id=bot_id):
            self.store.audit("live_activation_denied_confirmation", actor=operator, bot_id=bot_id, **s)
            raise LiveActivationError("confirmation phrase mismatch")
        others = self._other_live_bots(bot_id)
        checks = self.checklist(att, rt)
        checks["single_live_bot"] = not others
        failed = [k for k, v in checks.items() if not v]
        if failed:
            self.store.audit("live_activation_denied_checks", actor=operator, bot_id=bot_id,
                             details={"failed": failed}, **s)
            raise LiveActivationError(f"live activation checks failed: {failed}")
        now = self.clock()
        valid_until = end_of_ist_day(now)
        with self.store.tx() as c:
            c.execute("INSERT INTO live_approvals(tenant_id,account_id,bot_id,operator,approved_at,valid_until,scope) "
                      "VALUES(?,?,?,?,?,?,?)",
                      (self.cfg.tenant_id, self.cfg.account_id, bot_id, operator, now.isoformat(),
                       valid_until.isoformat(), json.dumps({"checks": checks, "notes": att.notes})))
            c.execute("UPDATE algo_bots SET live_enabled=1, execution_mode='LIVE', updated_at=?, updated_by=? "
                      "WHERE tenant_id=? AND account_id=? AND bot_id=?",
                      (now.isoformat(), operator, self.cfg.tenant_id, self.cfg.account_id, bot_id))
        self.store.audit("live_trading_authorised", actor=operator, bot_id=bot_id,
                         details={"valid_until": valid_until.isoformat(), "checks": checks}, **s)
        return {"bot_id": bot_id, "valid_until": valid_until.isoformat(), "operator": operator}

    def revoke(self, *, bot_id: str, by: str, reason: str) -> None:
        with self.store.tx() as c:
            c.execute("UPDATE live_approvals SET revoked=1 WHERE tenant_id=? AND account_id=? AND bot_id=?",
                      (self.cfg.tenant_id, self.cfg.account_id, bot_id))
            c.execute("UPDATE algo_bots SET live_enabled=0, execution_mode='PAPER', updated_at=?, updated_by=? "
                      "WHERE tenant_id=? AND account_id=? AND bot_id=?",
                      (self.clock().isoformat(), by, self.cfg.tenant_id, self.cfg.account_id, bot_id))
        self.store.audit("live_trading_revoked", actor=by, bot_id=bot_id, details={"reason": reason}, **self._scope())

    def is_authorised(self, bot_id: str) -> bool:
        """Evaluated before EVERY live order."""
        if not live_trading_env_enabled():
            return False
        if self.store.get_flag(self.cfg.tenant_id, self.cfg.account_id, "kill_switch", "OFF") == "ON":
            return False
        row = self.store.one(
            "SELECT a.valid_until FROM live_approvals a JOIN algo_bots b ON b.tenant_id=a.tenant_id AND "
            "b.account_id=a.account_id AND b.bot_id=a.bot_id WHERE a.tenant_id=? AND a.account_id=? AND a.bot_id=? "
            "AND a.revoked=0 AND b.live_enabled=1 ORDER BY a.id DESC LIMIT 1",
            (self.cfg.tenant_id, self.cfg.account_id, bot_id))
        return bool(row) and datetime.fromisoformat(row["valid_until"]) > self.clock()

    def guard_for(self, bot_id: str) -> Callable[[], bool]:
        return lambda: self.is_authorised(bot_id)
