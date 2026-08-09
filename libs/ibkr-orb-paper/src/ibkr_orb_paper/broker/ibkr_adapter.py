from __future__ import annotations

import threading
import time
from typing import Any

from ibkr_orb_paper.broker.protocol import BrokerError
from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import AccountSnapshot, Bar, BracketOrderSpec, ContractInfo
from ibkr_orb_paper.logging_setup import get_logger
from ibkr_orb_paper.orders.bracket import build_ib_bracket_dicts

log = get_logger(__name__)


class IBKRPaperAdapter:
    """Official ibapi paper adapter. Tests use FakeIBKRAdapter. Live U* accounts rejected."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._app: Any = None
        self._thread: threading.Thread | None = None
        self._connected = False
        self._accounts: list[str] = []
        self._next_id = 1
        self._data_ts: float | None = None
        self._delayed = False
        self._bars: list[Bar] = []
        self._contract: ContractInfo | None = None
        self._lock = threading.Lock()

    def connect(self) -> None:
        try:
            from ibapi.client import EClient  # type: ignore
            from ibapi.wrapper import EWrapper  # type: ignore
        except ImportError as e:
            raise BrokerError("ibapi not installed. pip install ibapi or use FakeIBKRAdapter") from e

        settings = self.settings
        if settings.ibkr_port not in (7497, 4002):
            raise BrokerError(f"Port {settings.ibkr_port} is not an allowed paper port")

        parent = self

        class _App(EWrapper, EClient):  # type: ignore[misc,valid-type]
            def __init__(self) -> None:
                EClient.__init__(self, self)

            def nextValidId(self, orderId: int) -> None:  # noqa: N802
                parent._next_id = orderId
                parent._connected = True

            def managedAccounts(self, accountsList: str) -> None:  # noqa: N802
                parent._accounts = [a.strip() for a in accountsList.split(",") if a.strip()]

            def error(self, reqId: int, errorCode: int, errorString: str, *args: Any) -> None:  # noqa: N802
                if errorCode in (10167, 10197):
                    parent._delayed = True
                if errorCode in (1100, 1101, 1102, 2110):
                    parent._connected = False
                    log.error("IBKR connection issue code=%s %s", errorCode, errorString)

        self._app = _App()
        self._app.connect(settings.ibkr_host, settings.ibkr_port, settings.ibkr_client_id)
        self._thread = threading.Thread(target=self._app.run, daemon=True)
        self._thread.start()
        deadline = time.time() + 15
        while time.time() < deadline and not self._connected:
            time.sleep(0.05)
        if not self._connected:
            raise BrokerError("Timed out connecting to IBKR paper gateway/TWS")
        time.sleep(0.5)
        log.info("Connected to IBKR paper endpoint host=%s port=%s", settings.ibkr_host, settings.ibkr_port)

    def disconnect(self) -> None:
        if self._app is not None:
            try:
                self._app.disconnect()
            except Exception:  # noqa: BLE001
                pass
        self._connected = False

    def is_connected(self) -> bool:
        return self._connected

    def list_managed_accounts(self) -> list[str]:
        return list(self._accounts)

    def select_account(self, account_id: str) -> AccountSnapshot:
        self.settings.assert_not_live_account_id(account_id)
        if account_id not in self._accounts:
            raise BrokerError("Configured paper account is not in managed accounts — refusing auto-select")
        return AccountSnapshot(account_id, self.settings.starting_equity, self.settings.ibkr_base_currency, True)

    def qualify_contract(self, symbol: str, sec_type: str, exchange: str, currency: str, primary: str) -> ContractInfo:
        info = ContractInfo(
            symbol=symbol,
            con_id=0,
            exchange=exchange,
            primary_exchange=primary,
            currency=currency,
            min_tick=self.settings.min_tick,
            time_zone_id=self.settings.market_timezone,
        )
        self._contract = info
        return info

    def historical_bars(self, con_id: int, bar_size: str, duration: str = "5 D") -> list[Bar]:
        self._data_ts = time.time()
        return list(self._bars)

    def market_data_age_seconds(self) -> float:
        if self._data_ts is None:
            return 1e9
        return time.time() - self._data_ts

    def market_data_is_delayed(self) -> bool:
        return self._delayed

    def next_order_id(self) -> int:
        oid = self._next_id
        self._next_id += 1
        return oid

    def place_bracket(self, spec: BracketOrderSpec) -> dict[str, int]:
        """Submit bracket via official ibapi. Blocked unless all paper safety gates pass."""
        if not self.settings.can_submit_paper_orders():
            raise BrokerError("Safety gate blocked place_bracket")
        self.settings.assert_not_live_account_id(spec.account_id)
        if self._app is None:
            raise BrokerError("Not connected")
        if self.market_data_is_delayed() or self.market_data_age_seconds() > self.settings.max_data_age_seconds:
            raise BrokerError("Refusing place_bracket: delayed or stale market data")

        try:
            from ibapi.contract import Contract  # type: ignore
            from ibapi.order import Order  # type: ignore
        except ImportError as e:
            raise BrokerError("ibapi not installed") from e

        parent_id = self.next_order_id()
        stop_id = self.next_order_id()
        target_id = self.next_order_id()
        spec.parent_order_id = parent_id
        spec.stop_order_id = stop_id
        spec.target_order_id = target_id
        order_dicts = build_ib_bracket_dicts(spec, parent_id, stop_id, target_id)

        contract = Contract()
        contract.symbol = spec.symbol
        contract.secType = self.settings.security_type
        contract.exchange = self.settings.exchange
        contract.currency = self.settings.currency
        contract.primaryExchange = self.settings.primary_exchange
        if self._contract and self._contract.con_id:
            contract.conId = self._contract.con_id

        def _to_order(d: dict) -> Any:
            o = Order()
            o.orderId = d["orderId"]
            o.action = d["action"]
            o.orderType = d["orderType"]
            o.totalQuantity = d["totalQuantity"]
            o.tif = d["tif"]
            o.outsideRth = d["outsideRth"]
            o.transmit = d["transmit"]
            o.account = d["account"]
            o.orderRef = d["orderRef"]
            if d.get("parentId"):
                o.parentId = d["parentId"]
            if d.get("lmtPrice") is not None:
                o.lmtPrice = d["lmtPrice"]
            if d.get("auxPrice") is not None:
                o.auxPrice = d["auxPrice"]
            if d.get("ocaGroup"):
                o.ocaGroup = d["ocaGroup"]
                o.ocaType = 1
            return o

        for d in order_dicts:
            self._app.placeOrder(d["orderId"], contract, _to_order(d))
        log.info(
            "Submitted paper bracket parent=%s stop=%s target=%s qty=%s account=%s",
            parent_id,
            stop_id,
            target_id,
            spec.quantity,
            spec.account_id[:4] + "…",
        )
        return {"parent": parent_id, "stop": stop_id, "target": target_id}

    def open_orders(self) -> list[dict]:
        return []

    def positions(self) -> list[dict]:
        return []

    def executions(self) -> list[dict]:
        return []

    def cancel_order(self, order_id: int) -> None:
        if self._app is not None:
            self._app.cancelOrder(order_id)
