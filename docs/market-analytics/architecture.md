# Market Analytics — Architecture

## Layers

1. **TradingView** — Pine v6 indicator/strategy + `alert()` JSON webhooks  
2. **Webhook security** — path token, body secret (timing-safe), replay/idempotency, expiry  
3. **Normalization** — ORB schema 1.0; server recalculates stop/target/qty  
4. **Risk** — paper account, connection, reconcile, data freshness, session, position/order, daily/weekly loss, drawdown, kill switch  
5. **Brokers** — `BrokerAdapter` → `SimulatedBrokerAdapter` | `IBKRPaperAdapter`  
6. **Persistence** — Prisma `Ma*` models + in-memory store for local/demo (`MA_USE_MEMORY_STORE`)  
7. **Realtime** — SSE `/api/v1/events/stream` + client refetch  
8. **UI** — Vite TradeOS module `src/modules/market-analytics`

## Data-source labels

`DEMO` | `SIMULATED` | `BROKER_PAPER` | `TV_BACKTEST` — never merged into one unlabeled performance series.

## Security

- Broker credentials server-side only; never `VITE_*` secrets  
- Secrets redacted in logs/API responses  
- Tenant isolation on all read/write paths  
- Viewers read-only; paper actions require trader/owner/admin  
