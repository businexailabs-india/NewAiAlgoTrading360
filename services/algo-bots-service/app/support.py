"""Small helpers: JSON sanitising, runner heartbeat interpretation, rate limiting, param guard-rails."""

from __future__ import annotations

import json
import math
import threading
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Any

from tradex_bots.live_gate import RuntimeStatus

# ------------------------------------------------------------------------------------------------ JSON


def clean(obj: Any) -> Any:
    """Make analytics output strictly JSON-safe (NaN/inf -> None; no Decimal/numpy leakage)."""
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if hasattr(obj, "item") and not isinstance(obj, (str, bytes)):  # numpy scalar
        try:
            return clean(obj.item())
        except Exception:  # pragma: no cover
            return str(obj)
    if isinstance(obj, (str, int, bool)) or obj is None:
        return obj
    return str(obj)


def row_dict(row, drop: tuple[str, ...] = ()) -> dict[str, Any]:
    return {k: row[k] for k in row.keys() if k not in drop}


# ------------------------------------------------------------------------------------------------ runtime


def heartbeat(store, tenant_id: str, account_id: str, now: datetime, max_age_s: int) -> dict[str, Any]:
    """Latest `runner_heartbeat` for the account, with an explicit freshness verdict.

    The API never asserts that a runner exists: bot "status" in the DB is only the *desired* state."""
    r = store.one(
        "SELECT ts,status,details FROM system_health_events WHERE tenant_id=? AND account_id=? "
        "AND component='runner_heartbeat' ORDER BY id DESC LIMIT 1", (tenant_id, account_id))
    if r is None:
        return {"runner_attached": False, "reason": "no heartbeat ever recorded", "age_seconds": None}
    try:
        age = (now - datetime.fromisoformat(r["ts"])).total_seconds()
        details = json.loads(r["details"] or "{}")
    except (ValueError, TypeError):
        return {"runner_attached": False, "reason": "unreadable heartbeat", "age_seconds": None}
    fresh = 0 <= age <= max_age_s
    return {"runner_attached": fresh, "reason": "ok" if fresh else f"heartbeat stale ({int(age)}s)",
            "age_seconds": round(age, 1), "status": r["status"], "last_seen": r["ts"],
            "mode": details.get("mode"), "active_bots": details.get("active", []), "details": details}


def live_runtime(hb: dict[str, Any]) -> RuntimeStatus:
    """Runtime facts for the live gate. Anything not proven by a FRESH heartbeat from a LIVE-mode runner is False
    (a paper runner can never satisfy live preconditions)."""
    if not hb.get("runner_attached") or hb.get("mode") != "LIVE":
        return RuntimeStatus()
    d = hb.get("details", {})
    return RuntimeStatus(credentials_valid=d.get("credentials_valid") is True,
                         market_data_healthy=d.get("market_data_healthy") is True,
                         broker_reconciled=d.get("broker_reconciled") is True,
                         risk_engine_operational=d.get("risk_engine_operational") is True)


# ------------------------------------------------------------------------------------------------ rate limit


class RateLimiter:
    """Sliding-window limiter, per key. Per-process; use Redis if running several replicas."""

    def __init__(self, clock=time.monotonic):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._clock = clock

    def allow(self, key: str, limit: int, window_s: float = 60.0) -> bool:
        now = self._clock()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window_s:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            if len(self._hits) > 20_000:
                for k in [k for k, v in self._hits.items() if not v][:5_000]:
                    del self._hits[k]
            return True


# ------------------------------------------------------------------------------------------------ param guard-rails

# Never editable through the API (session/safety structure of v1).
LOCKED_PARAMS = {"candle_minutes", "session_open", "session_close", "forced_squareoff"}
# (min, max) inclusive, for the numeric parameters that exist on a bot's params model.
PARAM_BOUNDS: dict[str, tuple[float, float]] = {
    "reward_risk": (0.5, 10.0), "min_stop_pct": (0.001, 0.05), "max_stop_pct": (0.001, 0.05),
    "atr_period": (2, 100), "volume_lookback": (2, 200), "warmup_bars": (20, 500),
    "min_price": (1.0, 100_000.0), "max_entries_per_symbol_per_day": (1, 5), "entry_grace_seconds": (0, 120),
    "max_spread_bps": (0.0, 100.0), "max_entry_deviation_pct": (0.0, 5.0), "stale_data_seconds": (1, 120),
    "cooldown_minutes_after_exit": (0, 240), "cooldown_minutes_after_loss": (0, 240),
}


def check_param_changes(changes: dict[str, Any], model_fields: set[str]) -> list[str]:
    """Return a list of human-readable problems (empty = acceptable)."""
    problems: list[str] = []
    for k, v in changes.items():
        if k not in model_fields:
            problems.append(f"unknown parameter '{k}'")
        elif k in LOCKED_PARAMS:
            problems.append(f"parameter '{k}' is locked in v1")
        elif k in PARAM_BOUNDS:
            lo, hi = PARAM_BOUNDS[k]
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not (lo <= v <= hi):
                problems.append(f"parameter '{k}' must be a number in [{lo}, {hi}]")
    return problems
