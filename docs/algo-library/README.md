# AlgoLibrary360 (Phase 1)

Paper-only strategy templates for BusineXAi TradeOS360.

## Templates

1. Moving Average Crossover  
2. RSI Mean Reversion  
3. VWAP Intraday  
4. Opening Range Breakout  
5. Supertrend Trend Following  
6. Bollinger Band Mean Reversion  
7. Long Call / Long Put Options  
8. Covered Call  
9. Portfolio Rebalancing  
10. AI Advisory-to-Algo placeholder  
11. DhanLaxmi Prompt-to-Algo placeholder  

## Rules

- `live_trading_enabled` is always `false`
- `paper_trading_required` is always `true`
- Every strategy must include stop-loss, max daily loss, max position size
- Results always include a risk warning — **no profit promises**

## Service

- Port: `8099`
- OpenAPI: http://localhost:8099/docs
- `GET /algos/templates`
- `POST /algos/templates/{id}/create-strategy`
