"""Paper trading broker — market/limit simulation with slippage & brokerage."""

from __future__ import annotations

from typing import Any

from market_simulator import MockMarketDataFeed
from risk_rules import RiskGuard360
from schemas.paper import (
    OrderSide,
    OrderStatus,
    OrderType,
    PaperOrder,
    PaperPosition,
    PaperTrade,
    PaperTradingAccount,
)
from schemas.risk import RiskRules


class PaperBroker:
    def __init__(
        self,
        risk: RiskGuard360 | None = None,
        market: MockMarketDataFeed | None = None,
        slippage_bps: float = 5.0,
        brokerage_per_order: float = 20.0,
    ):
        self.risk = risk or RiskGuard360()
        self.market = market or MockMarketDataFeed()
        self.slippage_bps = slippage_bps
        self.brokerage_per_order = brokerage_per_order
        self.accounts: dict[str, PaperTradingAccount] = {}
        self.orders: list[PaperOrder] = []
        self.trades: list[PaperTrade] = []
        self._trades_today: dict[str, int] = {}
        self._daily_loss: dict[str, float] = {}

    def create_account(self, user_id: str, starting_balance: float = 1_000_000.0) -> PaperTradingAccount:
        acct = PaperTradingAccount(
            user_id=user_id,
            starting_balance=starting_balance,
            cash_balance=starting_balance,
        )
        self.accounts[acct.account_id] = acct
        return acct

    def get_account(self, account_id: str) -> PaperTradingAccount | None:
        return self.accounts.get(account_id)

    def place_order(
        self,
        order: PaperOrder,
        risk_rules: RiskRules | None = None,
    ) -> PaperOrder:
        acct = self.accounts.get(order.account_id)
        if not acct:
            order.status = OrderStatus.REJECTED
            order.reject_reason = "account_not_found"
            self.orders.append(order)
            return order

        quote = self.market.get_quote(order.symbol)
        mark = quote.ltp
        if order.order_type == OrderType.LIMIT and order.limit_price is not None:
            # Fill only if market crosses limit
            if order.side == OrderSide.BUY and mark > order.limit_price:
                order.status = OrderStatus.REJECTED
                order.reject_reason = "limit_not_reached"
                self.orders.append(order)
                return order
            if order.side == OrderSide.SELL and mark < order.limit_price:
                order.status = OrderStatus.REJECTED
                order.reject_reason = "limit_not_reached"
                self.orders.append(order)
                return order
            fill_base = order.limit_price
        else:
            fill_base = mark

        check = self.risk.check_paper_order(
            order,
            acct,
            risk_rules=risk_rules,
            mark_price=fill_base,
            trades_today=self._trades_today.get(acct.account_id, 0),
            daily_realized_loss=self._daily_loss.get(acct.account_id, 0.0),
        )
        if not check.allowed:
            order.status = OrderStatus.REJECTED
            order.reject_reason = ",".join(check.breaches) or check.reason
            self.orders.append(order)
            return order

        slip = fill_base * (self.slippage_bps / 10_000.0)
        fill = fill_base + slip if order.side == OrderSide.BUY else fill_base - slip
        notional = fill * order.quantity
        brokerage = self.brokerage_per_order

        if order.side == OrderSide.BUY:
            cost = notional + brokerage
            if cost > acct.cash_balance:
                order.status = OrderStatus.REJECTED
                order.reject_reason = "insufficient_cash"
                self.orders.append(order)
                return order
            acct.cash_balance -= cost
            self._upsert_position(acct, order.symbol, order.quantity, fill)
        else:
            pos = self._find_position(acct, order.symbol)
            if not pos or pos["quantity"] < order.quantity:
                order.status = OrderStatus.REJECTED
                order.reject_reason = "insufficient_position"
                self.orders.append(order)
                return order
            pnl = (fill - pos["average_price"]) * order.quantity - brokerage
            acct.cash_balance += notional - brokerage
            acct.realized_pnl += pnl
            if pnl < 0:
                self._daily_loss[acct.account_id] = self._daily_loss.get(acct.account_id, 0.0) + abs(pnl)
            self._reduce_position(acct, order.symbol, order.quantity)
            trade = PaperTrade(
                account_id=acct.account_id,
                order_id=order.order_id,
                symbol=order.symbol,
                side=order.side,
                quantity=order.quantity,
                price=fill,
                pnl=pnl,
            )
            self.trades.append(trade)
            acct.closed_trades.append(trade.model_dump(mode="json"))

        order.status = OrderStatus.FILLED
        order.filled_price = round(fill, 2)
        order.filled_qty = order.quantity
        order.slippage = round(slip, 4)
        order.brokerage = brokerage
        self.orders.append(order)
        self._trades_today[acct.account_id] = self._trades_today.get(acct.account_id, 0) + 1
        self._mark_to_market(acct)
        self.accounts[acct.account_id] = acct
        return order

    def _find_position(self, acct: PaperTradingAccount, symbol: str) -> dict[str, Any] | None:
        for p in acct.open_positions:
            if p.get("symbol") == symbol:
                return p
        return None

    def _upsert_position(self, acct: PaperTradingAccount, symbol: str, qty: int, price: float) -> None:
        pos = self._find_position(acct, symbol)
        if not pos:
            acct.open_positions.append(
                PaperPosition(
                    symbol=symbol, quantity=qty, average_price=price, last_price=price
                ).model_dump(mode="json")
            )
            return
        total_qty = pos["quantity"] + qty
        avg = ((pos["average_price"] * pos["quantity"]) + (price * qty)) / total_qty
        pos["quantity"] = total_qty
        pos["average_price"] = avg
        pos["last_price"] = price

    def _reduce_position(self, acct: PaperTradingAccount, symbol: str, qty: int) -> None:
        pos = self._find_position(acct, symbol)
        if not pos:
            return
        pos["quantity"] -= qty
        if pos["quantity"] <= 0:
            acct.open_positions = [p for p in acct.open_positions if p.get("symbol") != symbol]

    def _mark_to_market(self, acct: PaperTradingAccount) -> None:
        upnl = 0.0
        for p in acct.open_positions:
            q = self.market.get_quote(p["symbol"])
            p["last_price"] = q.ltp
            p["unrealized_pnl"] = (q.ltp - p["average_price"]) * p["quantity"]
            upnl += p["unrealized_pnl"]
        acct.unrealized_pnl = upnl

    def list_orders(self, account_id: str | None = None) -> list[PaperOrder]:
        if not account_id:
            return list(self.orders)
        return [o for o in self.orders if o.account_id == account_id]

    def list_trades(self, account_id: str | None = None) -> list[PaperTrade]:
        if not account_id:
            return list(self.trades)
        return [t for t in self.trades if t.account_id == account_id]

    def list_positions(self, account_id: str) -> list[dict[str, Any]]:
        acct = self.accounts.get(account_id)
        if not acct:
            return []
        self._mark_to_market(acct)
        return list(acct.open_positions)
