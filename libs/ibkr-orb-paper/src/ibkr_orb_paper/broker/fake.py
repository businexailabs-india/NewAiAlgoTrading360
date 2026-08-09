from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ibkr_orb_paper.broker.protocol import BrokerError
from ibkr_orb_paper.domain.models import AccountSnapshot, Bar, BracketOrderSpec, ContractInfo


class FakeIBKRAdapter:
    """In-memory IBKR adapter for tests — never touches network."""

    def __init__(
        self,
        *,
        accounts: list[str] | None = None,
        selected: str | None = None,
        bars: list[Bar] | None = None,
        delayed: bool = False,
        data_age: float = 1.0,
        net_liq: float = 2400.0,
    ) -> None:
        self._accounts = accounts or ["DU1234567", "DU9999999"]
        self._selected = selected
        self._bars = bars or []
        self._delayed = delayed
        self._data_age = data_age
        self._net_liq = net_liq
        self._connected = False
        self._order_id = 100
        self._placed: list[BracketOrderSpec] = []
        self._open: list[dict] = []
        self._positions: list[dict] = []
        self._executions: list[dict] = []
        self.submit_calls = 0

    def connect(self) -> None:
        self._connected = True

    def disconnect(self) -> None:
        self._connected = False

    def is_connected(self) -> bool:
        return self._connected

    def list_managed_accounts(self) -> list[str]:
        return list(self._accounts)

    def select_account(self, account_id: str) -> AccountSnapshot:
        if account_id not in self._accounts:
            raise BrokerError(f"account {account_id} not in managed accounts")
        self._selected = account_id
        is_paper = account_id.upper().startswith("DU")
        return AccountSnapshot(account_id, self._net_liq, "USD", is_paper)

    def qualify_contract(
        self, symbol: str, sec_type: str, exchange: str, currency: str, primary: str
    ) -> ContractInfo:
        return ContractInfo(
            symbol=symbol,
            con_id=756733,
            exchange=exchange,
            primary_exchange=primary,
            currency=currency,
            min_tick=0.01,
            time_zone_id="America/New_York",
        )

    def historical_bars(self, con_id: int, bar_size: str, duration: str = "5 D") -> list[Bar]:
        return list(self._bars)

    def market_data_age_seconds(self) -> float:
        return self._data_age

    def market_data_is_delayed(self) -> bool:
        return self._delayed

    def next_order_id(self) -> int:
        self._order_id += 1
        return self._order_id

    def place_bracket(self, spec: BracketOrderSpec) -> dict[str, int]:
        self.submit_calls += 1
        parent = self.next_order_id()
        stop = self.next_order_id()
        target = self.next_order_id()
        spec.parent_order_id = parent
        spec.stop_order_id = stop
        spec.target_order_id = target
        self._placed.append(spec)
        self._open.append(
            {
                "order_id": parent,
                "status": "Submitted",
                "symbol": spec.symbol,
                "strategy_id": spec.strategy_id,
            }
        )
        return {"parent": parent, "stop": stop, "target": target}

    def open_orders(self) -> list[dict]:
        return list(self._open)

    def positions(self) -> list[dict]:
        return list(self._positions)

    def executions(self) -> list[dict]:
        return list(self._executions)

    def cancel_order(self, order_id: int) -> None:
        self._open = [o for o in self._open if o.get("order_id") != order_id]


def make_synthetic_orb_day(
    *,
    tz_name: str = "America/New_York",
    breakout: bool = True,
) -> list[Bar]:
    """One RTH session of 15-min bars with OR then optional breakout + warmup history."""
    tz = ZoneInfo(tz_name)
    bars: list[Bar] = []
    price = 500.0
    t = datetime(2024, 5, 20, 10, 0, tzinfo=tz)
    end_warm = datetime(2024, 6, 3, 9, 30, tzinfo=tz)
    while t < end_warm:
        if t.weekday() < 5 and 10 <= t.hour <= 15:
            close = price + 0.08
            bars.append(Bar(t, price, price + 0.4, price - 0.2, close, 1_000_000, True))
            price = close
        t += timedelta(minutes=15)

    # Session continues the uptrend so close > EMA and EMA slope > 0
    base = price
    session_start = datetime(2024, 6, 3, 9, 45, tzinfo=tz)
    or1_close = base + 0.4
    or2_close = base + 0.7
    or_high = base + 1.0
    bars.extend(
        [
            Bar(session_start, base, base + 0.8, base - 0.3, or1_close, 2_000_000, True),
            Bar(
                session_start + timedelta(minutes=15),
                or1_close,
                or_high,
                or1_close - 0.2,
                or2_close,
                1_800_000,
                True,
            ),
        ]
    )
    if breakout:
        bo_close = or_high + 1.2
        bars.append(
            Bar(
                session_start + timedelta(minutes=30),
                or2_close,
                bo_close + 0.3,
                or2_close - 0.1,
                bo_close,
                3_500_000,
                True,
            )
        )
    else:
        bars.append(
            Bar(
                session_start + timedelta(minutes=30),
                or2_close,
                or_high - 0.1,
                or2_close - 0.3,
                or2_close - 0.1,
                1_200_000,
                True,
            )
        )
    return bars