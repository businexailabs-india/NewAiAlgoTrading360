"""IBKRClient — TWS/Gateway adapter with MockIBKRClient for tests.

Uses `ibapi` when installed; otherwise MockIBKRClient is the safe default.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import uuid4

from .config import IBKRConnectionConfig
from .contract_mapper import (
    contract_to_ibapi_dict,
    resolve_mock_contract,
    search_mock_contracts,
    to_contract_request,
)
from .errors import (
    IBKRConnectionError,
    IBKRContractNotFoundError,
    IBKRDuplicateOrderError,
    IBKRMarketDataUnavailableError,
    IBKROrderRejectedError,
    IBKRTimeoutError,
)
from .market_data_mapper import bars_from_raw, map_timeframe, tick_from_raw
from .models import (
    IBKRAccountSummary,
    IBKRContract,
    IBKRContractRequest,
    IBKRExecution,
    IBKRHistoricalBar,
    IBKRMarketDataTick,
    IBKROrderRequest,
    IBKROrderResponse,
    IBKRPosition,
)
from .order_mapper import response_from_client, to_ibapi_order_dict


def _mask_account(account_id: str) -> str:
    if not account_id:
        return ""
    if len(account_id) <= 4:
        return "*" * len(account_id)
    return ("*" * (len(account_id) - 4)) + account_id[-4:]


def ibapi_available() -> bool:
    try:
        import ibapi  # noqa: F401

        return True
    except ImportError:
        return False


class IBKRClient(ABC):
    """Adapter interface for Interactive Brokers TWS API / IB Gateway."""

    def __init__(
        self,
        config: IBKRConnectionConfig | None = None,
        audit_hook: Callable[[str, dict[str, Any]], None] | None = None,
    ):
        self.config = config or IBKRConnectionConfig.from_env_and_overrides()
        self._audit_hook = audit_hook
        self._connected = False
        self._next_order_id = 1000

    def _audit(self, action: str, details: dict[str, Any]) -> None:
        safe = {
            k: v
            for k, v in details.items()
            if "password" not in k.lower() and k.lower() not in ("account_id", "account")
        }
        if "account_id" in details:
            safe["account_id_masked"] = _mask_account(str(details.get("account_id") or ""))
        if self._audit_hook:
            self._audit_hook(action, safe)

    @abstractmethod
    async def connect_to_tws_or_gateway(self) -> dict[str, Any]: ...

    @abstractmethod
    async def disconnect(self) -> dict[str, Any]: ...

    @abstractmethod
    async def request_account_summary(self) -> IBKRAccountSummary: ...

    @abstractmethod
    async def request_positions(self) -> list[IBKRPosition]: ...

    @abstractmethod
    async def request_open_orders(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def request_executions(self) -> list[IBKRExecution]: ...

    @abstractmethod
    async def request_contract_details(self, req: IBKRContractRequest) -> list[IBKRContract]: ...

    @abstractmethod
    async def request_market_data(self, symbol: str) -> IBKRMarketDataTick: ...

    @abstractmethod
    async def request_historical_data(
        self, symbol: str, timeframe: str, from_date: str, to_date: str
    ) -> list[IBKRHistoricalBar]: ...

    @abstractmethod
    async def place_paper_order(self, order: IBKROrderRequest) -> IBKROrderResponse: ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> IBKROrderResponse: ...

    @abstractmethod
    async def modify_order(self, order_id: str, modify: dict[str, Any]) -> IBKROrderResponse: ...

    @abstractmethod
    async def receive_order_status(self, order_id: str) -> dict[str, Any]: ...

    @abstractmethod
    async def receive_execution_details(self, order_id: str | None = None) -> list[IBKRExecution]: ...


class MockIBKRClient(IBKRClient):
    """Deterministic paper/demo client — no TWS required."""

    def __init__(
        self,
        config: IBKRConnectionConfig | None = None,
        audit_hook: Callable[[str, dict[str, Any]], None] | None = None,
        *,
        simulate_disconnect: bool = False,
        simulate_timeout: bool = False,
        market_data_down: bool = False,
    ):
        super().__init__(config=config, audit_hook=audit_hook)
        self.simulate_disconnect = simulate_disconnect
        self.simulate_timeout = simulate_timeout
        self.market_data_down = market_data_down
        self._orders: dict[str, dict[str, Any]] = {}
        self._idempotency: dict[str, str] = {}
        self._executions: list[IBKRExecution] = []
        self._positions: dict[str, IBKRPosition] = {
            "AAPL": IBKRPosition(
                account_id_masked=_mask_account(self.config.account_id or "DU1234567"),
                symbol="AAPL",
                position=100,
                avg_cost=185.5,
                market_price=190.0,
                market_value=19000.0,
                unrealized_pnl=450.0,
                con_id=265598,
            )
        }
        self._quotes = {
            "AAPL": {"bid": 189.9, "ask": 190.1, "last": 190.0, "close": 188.5, "volume": 1_200_000},
            "MSFT": {"bid": 419.5, "ask": 420.0, "last": 419.8, "close": 418.0, "volume": 800_000},
            "SPY": {"bid": 520.1, "ask": 520.2, "last": 520.15, "close": 518.0, "volume": 5_000_000},
        }

    async def connect_to_tws_or_gateway(self) -> dict[str, Any]:
        if self.simulate_disconnect:
            self._audit("ibkr.connect_failed", {"reason": "simulated_disconnect"})
            raise IBKRConnectionError("TWS disconnected / IB Gateway unavailable")
        if self.simulate_timeout:
            await asyncio.sleep(0.01)
            raise IBKRTimeoutError("IBKR connect timeout")
        self._connected = True
        acct = self.config.account_id or "DU1234567"
        self._audit(
            "ibkr.connect",
            {"ok": True, "mode": "paper", "port": self.config.port, "account_id": acct},
        )
        return {
            "ok": True,
            "mode": "paper",
            "connection_mode": "mock",
            "host": self.config.host,
            "port": self.config.port,
            "client_id": self.config.client_id,
            "account_id_masked": _mask_account(acct),
            "ibapi_installed": ibapi_available(),
        }

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        self._audit("ibkr.disconnect", {"ok": True})
        return {"ok": True, "status": "disconnected"}

    def _require_connected(self) -> None:
        if not self._connected or self.simulate_disconnect:
            raise IBKRConnectionError("Not connected to TWS/IB Gateway")

    async def request_account_summary(self) -> IBKRAccountSummary:
        self._require_connected()
        acct = self.config.account_id or "DU1234567"
        summary = IBKRAccountSummary(
            account_id_masked=_mask_account(acct),
            currency="USD",
            net_liquidation=250000.0,
            total_cash=125000.0,
            buying_power=500000.0,
            available_funds=200000.0,
            excess_liquidity=180000.0,
            maintenance_margin=15000.0,
            init_margin=20000.0,
            unrealized_pnl=450.0,
            realized_pnl=120.0,
            mode="paper",
        )
        self._audit("ibkr.account_summary", summary.model_dump())
        return summary

    async def request_positions(self) -> list[IBKRPosition]:
        self._require_connected()
        rows = list(self._positions.values())
        self._audit("ibkr.positions", {"count": len(rows)})
        return rows

    async def request_open_orders(self) -> list[dict[str, Any]]:
        self._require_connected()
        return [
            {
                "provider_order_id": oid,
                "symbol": o["symbol"],
                "side": o["side"],
                "quantity": o["quantity"],
                "order_type": o["order_type"],
                "status": o["status"],
                "mode": "paper",
                "idempotency_key": o.get("idempotency_key"),
            }
            for oid, o in self._orders.items()
            if o["status"] not in ("FILLED", "CANCELLED", "REJECTED")
        ]

    async def request_executions(self) -> list[IBKRExecution]:
        self._require_connected()
        return list(self._executions)

    async def request_contract_details(self, req: IBKRContractRequest) -> list[IBKRContract]:
        self._require_connected()
        try:
            if req.symbol and not req.strike:
                hits = search_mock_contracts(req.symbol)
                if hits:
                    return hits
            return [resolve_mock_contract(req)]
        except IBKRContractNotFoundError:
            self._audit("ibkr.contract_not_found", {"symbol": req.symbol})
            raise

    async def request_market_data(self, symbol: str) -> IBKRMarketDataTick:
        self._require_connected()
        if self.market_data_down:
            raise IBKRMarketDataUnavailableError(f"Market data unavailable for {symbol}")
        key = symbol.upper().split(":")[-1]
        raw = self._quotes.get(key)
        if not raw:
            raise IBKRMarketDataUnavailableError(f"No quote for {key}")
        tick = tick_from_raw(key, raw)
        self._audit("ibkr.quote", {"symbol": key, "last": tick.last})
        return tick

    async def request_historical_data(
        self, symbol: str, timeframe: str, from_date: str, to_date: str
    ) -> list[IBKRHistoricalBar]:
        self._require_connected()
        key = symbol.upper().split(":")[-1]
        last = float((self._quotes.get(key) or {}).get("last") or 100.0)
        bars = bars_from_raw(
            [
                {
                    "time": from_date or datetime.now(timezone.utc).strftime("%Y%m%d"),
                    "open": last - 1,
                    "high": last + 1,
                    "low": last - 2,
                    "close": last,
                    "volume": 10000,
                }
            ]
        )
        self._audit(
            "ibkr.historical",
            {"symbol": key, "timeframe": map_timeframe(timeframe), "bars": len(bars)},
        )
        return bars

    async def place_paper_order(self, order: IBKROrderRequest) -> IBKROrderResponse:
        self._require_connected()
        if order.quantity <= 0:
            raise IBKROrderRejectedError("quantity must be > 0")
        if order.order_type == "BRACKET":
            # Placeholder — reject explicit bracket until fully implemented
            raise IBKROrderRejectedError("BRACKET orders are placeholder-only")
        if order.idempotency_key and order.idempotency_key in self._idempotency:
            raise IBKRDuplicateOrderError(
                f"Duplicate idempotency key: {order.idempotency_key}"
            )
        # Validate contract exists
        creq = to_contract_request(
            order.symbol,
            sec_type=order.sec_type,
            exchange=order.exchange,
            currency=order.currency,
            last_trade_date_or_contract_month=order.last_trade_date_or_contract_month,
            strike=order.strike,
            right=order.right,
            multiplier=order.multiplier,
        )
        resolve_mock_contract(creq)

        oid = str(self._next_order_id)
        self._next_order_id += 1
        fill_price = float(
            order.limit_price
            or (self._quotes.get(order.symbol.upper()) or {}).get("last")
            or 100.0
        )
        # Partial fill simulation when quantity > 50 and odd
        filled = float(order.quantity)
        status = "Filled"
        if order.quantity > 50 and int(order.quantity) % 2 == 1:
            filled = float(int(order.quantity) // 2)
            status = "PartiallyFilled"

        self._orders[oid] = {
            "symbol": order.symbol.upper(),
            "side": order.side,
            "quantity": order.quantity,
            "order_type": order.order_type,
            "status": "PARTIAL" if status == "PartiallyFilled" else "FILLED",
            "idempotency_key": order.idempotency_key,
            "filled_qty": filled,
            "avg_fill_price": fill_price,
        }
        if order.idempotency_key:
            self._idempotency[order.idempotency_key] = oid

        exec_row = IBKRExecution(
            exec_id=f"exec-{uuid4().hex[:10]}",
            provider_order_id=oid,
            symbol=order.symbol.upper(),
            side=order.side,
            shares=filled,
            price=fill_price,
            time=datetime.now(timezone.utc).isoformat(),
            account_id_masked=_mask_account(self.config.account_id or "DU1234567"),
            commission=1.0,
        )
        self._executions.append(exec_row)

        # Update portfolio
        pos = self._positions.get(order.symbol.upper())
        signed = filled if order.side == "BUY" else -filled
        if pos:
            new_qty = pos.position + signed
            self._positions[order.symbol.upper()] = pos.model_copy(
                update={
                    "position": new_qty,
                    "market_price": fill_price,
                    "market_value": new_qty * fill_price,
                }
            )
        elif order.side == "BUY":
            self._positions[order.symbol.upper()] = IBKRPosition(
                account_id_masked=_mask_account(self.config.account_id or "DU1234567"),
                symbol=order.symbol.upper(),
                position=filled,
                avg_cost=fill_price,
                market_price=fill_price,
                market_value=filled * fill_price,
            )

        resp = response_from_client(
            provider_order_id=oid,
            status=status,
            message="Paper order accepted (MockIBKRClient)",
            filled_qty=filled,
            avg_fill_price=fill_price,
            mode="paper",
            idempotency_key=order.idempotency_key,
            raw={
                "ibapi_order": to_ibapi_order_dict(order),
                "ibapi_contract": contract_to_ibapi_dict(resolve_mock_contract(creq)),
            },
        )
        self._audit(
            "ibkr.paper_order",
            {
                "provider_order_id": oid,
                "symbol": order.symbol,
                "side": order.side,
                "quantity": order.quantity,
                "status": resp.status,
                "idempotency_key": order.idempotency_key,
            },
        )
        return resp

    async def cancel_order(self, order_id: str) -> IBKROrderResponse:
        self._require_connected()
        o = self._orders.get(order_id)
        if not o:
            raise IBKROrderRejectedError(f"Unknown order_id: {order_id}")
        o["status"] = "CANCELLED"
        return response_from_client(
            provider_order_id=order_id,
            status="Cancelled",
            message="Paper order cancelled",
            mode="paper",
            idempotency_key=o.get("idempotency_key"),
        )

    async def modify_order(self, order_id: str, modify: dict[str, Any]) -> IBKROrderResponse:
        self._require_connected()
        o = self._orders.get(order_id)
        if not o:
            raise IBKROrderRejectedError(f"Unknown order_id: {order_id}")
        if "quantity" in modify:
            o["quantity"] = float(modify["quantity"])
        return response_from_client(
            provider_order_id=order_id,
            status="Submitted",
            message="Paper order modified",
            mode="paper",
            idempotency_key=o.get("idempotency_key"),
            raw={"modify_redacted": {k: v for k, v in modify.items() if "account" not in k.lower()}},
        )

    async def receive_order_status(self, order_id: str) -> dict[str, Any]:
        self._require_connected()
        o = self._orders.get(order_id)
        if not o:
            raise IBKROrderRejectedError(f"Unknown order_id: {order_id}")
        return {"provider_order_id": order_id, **o, "mode": "paper"}

    async def receive_execution_details(self, order_id: str | None = None) -> list[IBKRExecution]:
        self._require_connected()
        if order_id:
            return [e for e in self._executions if e.provider_order_id == order_id]
        return list(self._executions)


class RealIBKRClient(IBKRClient):
    """Optional ibapi-backed client. Requires `ibapi` and a running TWS/Gateway.

    This is a thin scaffold — production wiring should run ibapi's EClient/EWrapper
    on a dedicated network thread. Until fully wired, connect raises a clear error
    unless use_mock is forced.
    """

    async def connect_to_tws_or_gateway(self) -> dict[str, Any]:
        if not ibapi_available():
            raise IBKRConnectionError(
                "ibapi package not installed. pip install ibapi, or use MockIBKRClient (IBKR_USE_MOCK=true)."
            )
        # Scaffold: do not open a real socket here without an approved production harness.
        raise IBKRConnectionError(
            "Real IBKR TWS socket client is not enabled in this build. "
            "Use MockIBKRClient for paper tests, or complete the ibapi EClient harness."
        )

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        return {"ok": True, "status": "disconnected"}

    async def request_account_summary(self) -> IBKRAccountSummary:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def request_positions(self) -> list[IBKRPosition]:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def request_open_orders(self) -> list[dict[str, Any]]:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def request_executions(self) -> list[IBKRExecution]:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def request_contract_details(self, req: IBKRContractRequest) -> list[IBKRContract]:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def request_market_data(self, symbol: str) -> IBKRMarketDataTick:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def request_historical_data(
        self, symbol: str, timeframe: str, from_date: str, to_date: str
    ) -> list[IBKRHistoricalBar]:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def place_paper_order(self, order: IBKROrderRequest) -> IBKROrderResponse:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def cancel_order(self, order_id: str) -> IBKROrderResponse:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def modify_order(self, order_id: str, modify: dict[str, Any]) -> IBKROrderResponse:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def receive_order_status(self, order_id: str) -> dict[str, Any]:
        raise IBKRConnectionError("Real IBKR client not connected")

    async def receive_execution_details(self, order_id: str | None = None) -> list[IBKRExecution]:
        raise IBKRConnectionError("Real IBKR client not connected")


def build_ibkr_client(
    config: IBKRConnectionConfig,
    audit_hook: Callable[[str, dict[str, Any]], None] | None = None,
) -> IBKRClient:
    if config.use_mock or config.connection_mode == "mock":
        return MockIBKRClient(config=config, audit_hook=audit_hook)
    return RealIBKRClient(config=config, audit_hook=audit_hook)
