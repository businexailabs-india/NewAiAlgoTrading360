"""StrategyEngine — validate + paper-test + deploy-paper (never live)."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from market_simulator import MockMarketDataFeed
from paper_broker import PaperBroker
from performance_metrics import compute_performance
from risk_rules import RiskGuard360
from schemas.market import MarketRegime
from schemas.paper import OrderSide, OrderType, PaperOrder
from schemas.reports import PaperTestReport
from schemas.strategy import RISK_WARNING, StrategyConfig, StrategyStatus
from strategy_engine.signals import candles_to_df, generate_signals
from strategy_engine.validator import validate_strategy


class StrategyEngine:
    def __init__(
        self,
        broker: PaperBroker | None = None,
        risk: RiskGuard360 | None = None,
        market: MockMarketDataFeed | None = None,
    ):
        self.risk = risk or RiskGuard360()
        self.market = market or MockMarketDataFeed()
        self.broker = broker or PaperBroker(risk=self.risk, market=self.market)
        self.strategies: dict[str, StrategyConfig] = {}
        self.paper_tests: dict[str, PaperTestReport] = {}

    def save_strategy(self, strategy: StrategyConfig) -> StrategyConfig:
        strategy.live_trading_enabled = False
        strategy.paper_trading_required = True
        self.strategies[strategy.strategy_id] = strategy
        return strategy

    def get_strategy(self, strategy_id: str) -> StrategyConfig | None:
        return self.strategies.get(strategy_id)

    def list_strategies(self) -> list[StrategyConfig]:
        return list(self.strategies.values())

    def validate(self, strategy_id: str) -> dict[str, Any]:
        s = self.strategies[strategy_id]
        result = validate_strategy(s, self.risk)
        self.strategies[strategy_id] = s
        return result.model_dump(mode="json")

    def paper_test(
        self,
        strategy_id: str,
        account_id: str | None = None,
        regime: str = "trending",
        bars: int = 120,
    ) -> PaperTestReport:
        s = self.strategies[strategy_id]
        s.live_trading_enabled = False
        validation = validate_strategy(s, self.risk)
        if not validation.ok:
            raise ValueError(f"strategy_invalid: {validation.errors}")

        if not account_id:
            acct = self.broker.create_account(s.created_by)
            account_id = acct.account_id
        acct = self.broker.get_account(account_id)
        if not acct:
            raise ValueError("account_not_found")

        s.status = StrategyStatus.PAPER_TESTING
        symbol = s.symbols[0]
        candles = self.market.generate_candles(
            symbol, s.timeframe if s.timeframe in ("1m", "5m", "15m", "1d") else "5m", n=bars, regime=regime
        )
        df = candles_to_df(candles)
        signals = generate_signals(s.strategy_type, df, s.parameters)
        qty = max(1, int(s.position_sizing.get("max_qty", 10) or 10))
        qty = min(qty, 10)
        position = 0
        orders_placed = 0
        entry_price = 0.0
        trade_pnls: list[float] = []
        breaches: list[str] = []

        for i, sig in enumerate(signals):
            price = float(df["close"].iloc[i])
            # stop-loss check
            if position > 0 and entry_price > 0:
                dd = (entry_price - price) / entry_price * 100
                if dd >= s.risk_rules.stop_loss_percent:
                    order = PaperOrder(
                        account_id=account_id,
                        strategy_id=s.strategy_id,
                        symbol=symbol,
                        side=OrderSide.SELL,
                        order_type=OrderType.MARKET,
                        quantity=position,
                    )
                    filled = self.broker.place_order(order, s.risk_rules)
                    orders_placed += 1
                    if filled.status.value == "FILLED":
                        trade_pnls.append((filled.filled_price or price) - entry_price)
                        position = 0
                        entry_price = 0.0
                    elif filled.reject_reason:
                        breaches.append(filled.reject_reason)
                    continue

            if sig == "BUY" and position == 0:
                order = PaperOrder(
                    account_id=account_id,
                    strategy_id=s.strategy_id,
                    symbol=symbol,
                    side=OrderSide.BUY,
                    order_type=OrderType.MARKET,
                    quantity=qty,
                )
                filled = self.broker.place_order(order, s.risk_rules)
                orders_placed += 1
                if filled.status.value == "FILLED":
                    position = qty
                    entry_price = filled.filled_price or price
                elif filled.reject_reason:
                    breaches.append(filled.reject_reason)
            elif sig == "SELL" and position > 0:
                order = PaperOrder(
                    account_id=account_id,
                    strategy_id=s.strategy_id,
                    symbol=symbol,
                    side=OrderSide.SELL,
                    order_type=OrderType.MARKET,
                    quantity=position,
                )
                filled = self.broker.place_order(order, s.risk_rules)
                orders_placed += 1
                if filled.status.value == "FILLED":
                    trade_pnls.append((filled.filled_price or price) - entry_price)
                    position = 0
                    entry_price = 0.0
                elif filled.reject_reason:
                    breaches.append(filled.reject_reason)

        # square-off leftover
        if position > 0:
            order = PaperOrder(
                account_id=account_id,
                strategy_id=s.strategy_id,
                symbol=symbol,
                side=OrderSide.SELL,
                order_type=OrderType.MARKET,
                quantity=position,
            )
            filled = self.broker.place_order(order, s.risk_rules)
            orders_placed += 1
            if filled.status.value == "FILLED":
                trade_pnls.append((filled.filled_price or entry_price) - entry_price)

        # Prefer realized trade pnls from broker closed trades for this account
        closed = [
            float(t.get("pnl") or 0)
            for t in (self.broker.get_account(account_id).closed_trades if self.broker.get_account(account_id) else [])
        ]
        pnls = closed if closed else trade_pnls
        perf = compute_performance(s.strategy_id, pnls, acct.starting_balance, list(set(breaches)))
        report = PaperTestReport(
            test_id=str(uuid4()),
            strategy_id=s.strategy_id,
            account_id=account_id,
            performance=perf,
            orders_placed=orders_placed,
            risk_warning=RISK_WARNING,
            live_trading_enabled=False,
            status="completed",
        )
        self.paper_tests[report.test_id] = report
        s.status = StrategyStatus.VALIDATED
        self.strategies[s.strategy_id] = s
        return report

    def deploy_paper(self, strategy_id: str) -> StrategyConfig:
        s = self.strategies[strategy_id]
        s.live_trading_enabled = False
        result = validate_strategy(s, self.risk)
        if not result.ok:
            raise ValueError(f"cannot_deploy: {result.errors}")
        s.status = StrategyStatus.PAPER_DEPLOYED
        self.strategies[strategy_id] = s
        return s

    def deploy_live(
        self,
        strategy_id: str,
        *,
        paper_qualified: bool = False,
        admin_approved: bool = False,
    ) -> StrategyConfig:
        """Mark strategy live-eligible. Does not place broker orders (OMS required)."""
        s = self.strategies[strategy_id]
        result = validate_strategy(s, self.risk)
        if not result.ok:
            raise ValueError(f"cannot_deploy_live: {result.errors}")
        s.unlock_live(paper_qualified=paper_qualified, admin_approved=admin_approved)
        self.strategies[strategy_id] = s
        return s

    def pause(self, strategy_id: str) -> StrategyConfig:
        s = self.strategies[strategy_id]
        s.status = StrategyStatus.PAUSED
        return s

    def stop(self, strategy_id: str) -> StrategyConfig:
        s = self.strategies[strategy_id]
        s.status = StrategyStatus.STOPPED
        return s
