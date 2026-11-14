"""Versioned broker fee model + slippage scenarios.

Rates are DATA, not code: load a `FeeSchedule` from JSON/dict and register it with an effective date.
Defaults reflect the Dhan retail NSE cash-equity intraday rates supplied by the product spec and MUST be
re-verified against Dhan's published charges and actual contract notes before live use.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable

from pydantic import BaseModel

from tradex_bots.instruments import round_to_tick
from tradex_bots.models import Side

D = Decimal


class FeeSchedule(BaseModel):
    version: str = "dhan-nse-eq-intraday-spec-v1"
    effective_from: date = date(2020, 1, 1)
    exchange: str = "NSE"
    segment: str = "EQ"
    product: str = "INTRADAY"
    brokerage_flat_cap_inr: Decimal = D("20")
    brokerage_pct: Decimal = D("0.0003")  # lower of flat cap or this % of order turnover, per executed order
    stt_sell_pct: Decimal = D("0.00025")
    exchange_txn_pct: Decimal = D("0.000030699")  # both sides
    sebi_pct: Decimal = D("0.000001")  # both sides
    stamp_buy_pct: Decimal = D("0.00003")
    gst_pct: Decimal = D("0.18")  # on brokerage + exchange txn + sebi (+ ipft if gst_on_ipft)
    ipft_pct: Decimal = D("0")  # configurable; spec says "as published" (unverified, default 0)
    gst_on_ipft: bool = False
    other_flat_per_order_inr: Decimal = D("0")
    stt_round_to_rupee: bool = False  # broker-specific rounding switch
    decimals: int = 2


@dataclass(frozen=True)
class Execution:
    order_id: str
    side: Side
    qty: int
    price: float


@dataclass(frozen=True)
class ChargeBreakdown:
    brokerage: Decimal = D("0")
    stt: Decimal = D("0")
    exchange_txn: Decimal = D("0")
    sebi: Decimal = D("0")
    stamp: Decimal = D("0")
    gst: Decimal = D("0")
    ipft: Decimal = D("0")
    other: Decimal = D("0")

    @property
    def total(self) -> Decimal:
        return (
            self.brokerage + self.stt + self.exchange_txn + self.sebi + self.stamp + self.gst
            + self.ipft + self.other
        )

    def __add__(self, o: "ChargeBreakdown") -> "ChargeBreakdown":
        return ChargeBreakdown(*(getattr(self, f) + getattr(o, f) for f in _FIELDS))

    def as_floats(self) -> dict[str, float]:
        d = {f: float(getattr(self, f)) for f in _FIELDS}
        d["total"] = float(self.total)
        return d


_FIELDS = ("brokerage", "stt", "exchange_txn", "sebi", "stamp", "gst", "ipft", "other")


class FeeModel:
    def __init__(self, schedule: FeeSchedule | None = None):
        self.s = schedule or FeeSchedule()

    @property
    def version(self) -> str:
        return self.s.version

    def _r(self, x: Decimal) -> Decimal:
        return x.quantize(D(1).scaleb(-self.s.decimals), rounding=ROUND_HALF_UP)

    def charges(self, executions: Iterable[Execution]) -> ChargeBreakdown:
        """Charges for a set of executions. Brokerage is applied PER ORDER (partial fills of one order
        share one brokerage charge); statutory charges are linear in turnover."""
        s = self.s
        per_order: dict[str, Decimal] = {}
        buy_turn = sell_turn = D("0")
        for e in executions:
            turn = D(str(e.price)) * D(e.qty)
            per_order[e.order_id] = per_order.get(e.order_id, D("0")) + turn
            if e.side == Side.BUY:
                buy_turn += turn
            else:
                sell_turn += turn
        total_turn = buy_turn + sell_turn
        brokerage = sum(
            (min(s.brokerage_flat_cap_inr, self._r(t * s.brokerage_pct)) for t in per_order.values()),
            D("0"),
        )
        stt = sell_turn * s.stt_sell_pct
        stt = stt.quantize(D(1), rounding=ROUND_HALF_UP) if s.stt_round_to_rupee else self._r(stt)
        txn = self._r(total_turn * s.exchange_txn_pct)
        sebi = self._r(total_turn * s.sebi_pct)
        stamp = self._r(buy_turn * s.stamp_buy_pct)
        ipft = self._r(total_turn * s.ipft_pct)
        other = self._r(s.other_flat_per_order_inr * len(per_order))
        gst_base = brokerage + txn + sebi + (ipft if s.gst_on_ipft else D("0"))
        gst = self._r(gst_base * s.gst_pct)
        return ChargeBreakdown(self._r(brokerage), stt, txn, sebi, stamp, gst, ipft, other)

    def round_trip(self, qty: int, buy_price: float, sell_price: float) -> ChargeBreakdown:
        return self.charges(
            [Execution("buy", Side.BUY, qty, buy_price), Execution("sell", Side.SELL, qty, sell_price)]
        )


class FeeModelRegistry:
    """Versioned schedules selected by trade date, so historical backtests use the rates in force."""

    def __init__(self, schedules: list[FeeSchedule] | None = None):
        self._schedules = sorted(schedules or [FeeSchedule()], key=lambda s: s.effective_from)

    def add(self, schedule: FeeSchedule) -> None:
        self._schedules.append(schedule)
        self._schedules.sort(key=lambda s: s.effective_from)

    def for_date(self, d: date, product: str = "INTRADAY") -> FeeModel:
        eligible = [s for s in self._schedules if s.effective_from <= d and s.product == product]
        if not eligible:
            raise LookupError(f"no fee schedule effective on {d} for {product}")
        return FeeModel(eligible[-1])


@dataclass
class CostReconciliation:
    components: dict[str, dict[str, float]] = field(default_factory=dict)
    total_estimated: float = 0.0
    total_actual: float = 0.0
    breaches: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.breaches


def reconcile_with_contract_note(
    estimated: ChargeBreakdown, actual: dict[str, float], tolerance_inr: float = 0.50
) -> CostReconciliation:
    """Compare estimated charges to contract-note actuals (keys as in ChargeBreakdown + optional 'total')."""
    rep = CostReconciliation()
    for f in _FIELDS:
        est = float(getattr(estimated, f))
        act = float(actual.get(f, 0.0))
        rep.components[f] = {"estimated": est, "actual": act, "diff": round(act - est, 4)}
    rep.total_estimated = float(estimated.total)
    rep.total_actual = float(actual.get("total", sum(float(actual.get(f, 0.0)) for f in _FIELDS)))
    if abs(rep.total_actual - rep.total_estimated) > tolerance_inr:
        rep.breaches.append(
            f"total_diff_{rep.total_actual - rep.total_estimated:+.2f}_exceeds_{tolerance_inr}"
        )
    return rep


# ---------------------------------------------------------------------------------------------- slippage
@dataclass(frozen=True)
class SlippageScenario:
    name: str
    entry_pct: float  # fraction, e.g. 0.0002 == 0.02%
    exit_pct: float

    def entry_price(self, price: float, tick: float) -> float:
        """Adverse for a long entry: pay more, rounded UP to a valid tick."""
        return round_to_tick(price * (1 + self.entry_pct), tick, "up")

    def exit_price(self, price: float, tick: float) -> float:
        """Adverse for a long exit: receive less, rounded DOWN to a valid tick."""
        return round_to_tick(price * (1 - self.exit_pct), tick, "down")


SLIPPAGE_SCENARIOS: dict[str, SlippageScenario] = {
    "optimistic": SlippageScenario("optimistic", 0.0001, 0.0001),
    "base": SlippageScenario("base", 0.0002, 0.0002),
    "stress": SlippageScenario("stress", 0.0005, 0.0005),
}
