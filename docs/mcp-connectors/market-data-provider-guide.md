# Market Data Provider Guide

Configured in `config/mcp-providers/india-market-data.yaml`.

| provider_id | Notes |
|-------------|-------|
| truedata | ticks, websocket, history, option chain, greeks |
| globaldatafeeds | ticks, websocket, history, symbol master |
| accord | EOD, fundamentals, corporate actions, news |
| bse_direct / nse_direct | placeholders requiring exchange agreements |
| mock_market_data | full deterministic implementation for CI/demo |

Advisory rule: if market data unavailable → `backtest_only_or_no_trade`.

Env: `TRUEDATA_API_KEY`, `GLOBALDATAFEEDS_API_KEY`, `ACCORD_API_KEY`.
