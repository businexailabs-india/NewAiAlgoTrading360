"""PaperTradingProvider — full simulated broker for BusineXAi TradeOS360."""

from __future__ import annotations

import asyncio
from datetime import date, datetime
from typing import Any
from uuid import uuid4

from mcp_connectors.base.models import (
    NormalizedOrderRequest,
    NormalizedOrderResponse,
    ProviderConfig,
)
from mcp_connectors.base.provider import BaseTradingMCPProvider
from mcp_connectors.india.paper_trading.auth import refresh_auth
from mcp_connectors.india.paper_trading.rate_limits import RATE_LIMIT


class PaperTradingProvider(BaseTradingMCPProvider):
    provider_id = "paper_trading"
    provider_name = "BusineXAi Paper Trading Broker"
    provider_type = "simulated_broker"
    country = "IN"
    supported_exchanges = ["NSE", "BSE", "MCX"]
    supported_segments = ["equity", "equity_derivatives", "commodity"]
    supported_asset_classes = ["stocks", "futures", "options", "commodities"]

    def __init__(
        self,
        config: ProviderConfig | None = None,
        initial_cash: float = 100000.0,
        slippage_bps: float = 5.0,
        latency_ms: float = 25.0,
    ):
        super().__init__(config)
        self.cash = initial_cash
        self.slippage_bps = slippage_bps
        self.latency_ms = latency_ms
        self.holdings: list[dict[str, Any]] = []
        self.positions: list[dict[str, Any]] = []
        self.orders: list[dict[str, Any]] = []
        self.trades: list[dict[str, Any]] = []

    def get_rate_limits(self) -> dict[str, Any]:
        return RATE_LIMIT.to_dict()

    async def refresh_session(self) -> dict[str, Any]:
        result = await refresh_auth(True)
        return result.model_dump(mode="json")

    async def connect(self, credentials: dict[str, str], config: dict[str, Any] | None = None) -> dict[str, Any]:
        self._runtime_config = config or {}
        if config and "initial_cash" in config:
            self.cash = float(config["initial_cash"])
        if config and "slippage_bps" in config:
            self.slippage_bps = float(config["slippage_bps"])
        if config and "latency_ms" in config:
            self.latency_ms = float(config["latency_ms"])
        self._connected = True
        return {"ok": True, "status": "connected", "mode": "paper", "provider_id": self.provider_id}

    async def disconnect(self) -> dict[str, Any]:
        self._connected = False
        return {"ok": True, "status": "disconnected"}

    async def authenticate(self) -> dict[str, Any]:
        return {"ok": True, "status": "authenticated", "mode": "paper"}

    async def health_check(self) -> dict[str, Any]:
        return {
            "ok": self._connected,
            "status": "connected" if self._connected else "disconnected",
            "mode": "paper",
            "latency_ms": self.latency_ms,
        }

    async def get_account_profile(self) -> dict[str, Any]:
        return {"broker": "paper_trading", "masked_client_id": "PAPER****", "mode": "paper"}

    async def get_accounts(self) -> list[dict[str, Any]]:
        return [{"account_id": "paper-primary", "profile": await self.get_account_profile()}]

    async def get_margins(self) -> dict[str, Any]:
        utilized = sum(float(h.get("quantity", 0) * h.get("average_price", 0)) for h in self.holdings)
        return {"available": self.cash, "utilized": utilized, "currency": "INR", "mode": "paper"}

    async def get_holdings(self) -> list[dict[str, Any]]:
        return list(self.holdings)

    async def get_positions(self) -> list[dict[str, Any]]:
        return list(self.positions)

    async def get_orders(self) -> list[dict[str, Any]]:
        return list(self.orders)

    async def get_trades(self) -> list[dict[str, Any]]:
        return list(self.trades)

    async def get_instruments(self) -> list[dict[str, Any]]:
        return [
            {"exchange": "NSE", "segment": "EQ", "symbol": "RELIANCE", "provider_symbol": "RELIANCE"},
            {"exchange": "NSE", "segment": "EQ", "symbol": "TCS", "provider_symbol": "TCS"},
        ]

    async def search_instruments(self, query: str) -> list[dict[str, Any]]:
        q = (query or "").upper()
        return [i for i in await self.get_instruments() if q in i["symbol"]]

    async def get_live_quotes(self, symbols: list[str]) -> dict[str, Any]:
        return {
            "quotes": {
                self.normalize_symbol(s): {"ltp": 100.0 + (sum(ord(c) for c in s) % 40), "source": "paper_sim"}
                for s in symbols
            }
        }

    async def subscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        self._subscribed.update(symbols)
        return {"ok": True, "subscribed": list(self._subscribed), "mode": "paper"}

    async def unsubscribe_ticks(self, symbols: list[str]) -> dict[str, Any]:
        for s in symbols:
            self._subscribed.discard(s)
        return {"ok": True, "subscribed": list(self._subscribed)}

    async def get_historical_data(self, symbol, timeframe, from_date, to_date):
        bars = []
        price = 100.0
        for i in range(60):
            price += 1 if i % 3 else -0.5
            bars.append(
                {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "open": price - 0.2,
                    "high": price + 0.5,
                    "low": price - 0.5,
                    "close": price,
                    "volume": 10000 + i * 10,
                    "ts": i,
                }
            )
        return bars

    async def get_option_chain(self, symbol: str, expiry: str) -> dict[str, Any]:
        return {"symbol": symbol, "expiry": expiry, "chain": [], "note": "paper empty chain"}

    async def preview_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> dict[str, Any]:
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        qty = int(data.get("quantity") or 0)
        px = float(data.get("price") or 100.0)
        return {
            "preview": True,
            "accepted": True,
            "mode": "paper",
            "provider_id": self.provider_id,
            "estimated_cost": qty * px,
            "available_cash": self.cash,
            "order_redacted": {k: v for k, v in data.items() if "token" not in k.lower()},
        }

    async def place_paper_order(self, order_request: NormalizedOrderRequest | dict[str, Any]) -> NormalizedOrderResponse:
        """Paper execution is allowed (not gated by LIVE_TRADING_ENABLED)."""
        if self.latency_ms:
            await asyncio.sleep(min(self.latency_ms / 1000.0, 0.5))
        data = order_request.model_dump() if isinstance(order_request, NormalizedOrderRequest) else dict(order_request)
        qty = int(data.get("quantity") or 0)
        side = str(data.get("side") or "BUY").upper()
        symbol = str(data.get("symbol") or "")
        exchange = str(data.get("exchange") or "NSE")
        base_px = float(data.get("price") or 100.0)
        slip = base_px * (self.slippage_bps / 10000.0)
        fill_px = base_px + slip if side == "BUY" else max(0.05, base_px - slip)
        cost = qty * fill_px
        order_id = str(uuid4())
        status = "FILLED"
        message = "paper fill"
        if side == "BUY" and cost > self.cash:
            status = "REJECTED"
            message = "insufficient paper cash"
        else:
            if side == "BUY":
                self.cash -= cost
                self._upsert_holding(symbol, exchange, qty, fill_px)
            else:
                self.cash += cost
                self._upsert_holding(symbol, exchange, -qty, fill_px)
            trade = {
                "trade_id": str(uuid4()),
                "order_id": order_id,
                "symbol": symbol,
                "side": side,
                "quantity": qty,
                "price": fill_px,
                "status": "FILLED",
            }
            self.trades.append(trade)
        order = {
            "order_id": order_id,
            "symbol": symbol,
            "exchange": exchange,
            "side": side,
            "quantity": qty,
            "price": fill_px,
            "status": status,
            "mode": "paper",
        }
        self.orders.append(order)
        return NormalizedOrderResponse(
            provider_id=self.provider_id,
            provider_order_id=order_id,
            status=status,
            message=message,
            raw_response_redacted={"mode": "paper", "fill_price": fill_px},
        )

    def _upsert_holding(self, symbol: str, exchange: str, qty_delta: int, price: float) -> None:
        for h in self.holdings:
            if h["symbol"] == symbol and h["exchange"] == exchange:
                new_qty = int(h["quantity"]) + qty_delta
                if new_qty <= 0:
                    self.holdings.remove(h)
                else:
                    h["quantity"] = new_qty
                    h["average_price"] = price
                return
        if qty_delta > 0:
            self.holdings.append(
                {
                    "symbol": symbol,
                    "exchange": exchange,
                    "quantity": qty_delta,
                    "average_price": price,
                    "last_price": price,
                }
            )
