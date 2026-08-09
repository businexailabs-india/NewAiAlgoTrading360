# BxAi Trade Market Analytics

> **PAPER TRADING / RESEARCH ONLY.** Live order execution is not available and cannot be enabled in this product surface.

Paper and TradingView Strategy Tester results do **not** predict live returns.

## Architecture

```text
TradingView / Pine Script
        ↓ signed webhook alerts
Express /api/v1 (auth + risk)
        ↓ SimulatedBrokerAdapter | IBKRPaperAdapter
Application store (memory + Prisma Ma* schema)
        ↓ SSE / refetch
Vite TradeOS Market Analytics UI
```

## TradingView integration limitations

- No public API for TradingView account balances, positions, or arbitrary chart data.
- Do not scrape TradingView or store TradingView passwords.
- Use Pine alerts + webhooks only.
- Charting: development uses a **ChartProvider** canvas / Lightweight Charts fallback.
- **TradingView Advanced Charts / Trading Platform** require a commercial license — wire via `ChartProvider` when licensed.

## Local install

```bash
# Backend
cd backend
cp .env.example .env   # fill DATABASE_URL etc.; do not commit .env
npm install
npx prisma generate
npx prisma migrate deploy   # applies Ma* migration when DB available
npm run dev                 # :3001

# Frontend (repo root)
npm install
npm run dev                 # :3000
```

Docker: use existing [`backend/docker-compose.yml`](../backend/docker-compose.yml) for Postgres + Redis.

## Safety defaults

| Variable | Default | Purpose |
|----------|---------|---------|
| `TRADING_MODE` | `signal` | signal / simulated / broker_paper |
| `ENABLE_PAPER_ORDERS` | `NO` | Must be `YES` for submit |
| `PAPER_ORDER_CONFIRMATION` | `NO` | Second server-side flag |
| `MA_USE_MEMORY_STORE` | `true` | Local/demo store without DB |

Live `U*` accounts rejected. Paper IDs: `DU*` (IBKR) or `SIM-*` (simulated). Never auto-selects first account.

## Progression

1. **Signal-only** — webhooks stored; brackets validated; no submit  
2. **Internal simulation** — `TRADING_MODE=simulated` + both paper flags  
3. **Broker paper** — verified paper account + reconcile OK + 20-session checklist  

## Pine Script

- [`tradingview/pine/orb_regime_long_indicator.pine`](../../tradingview/pine/orb_regime_long_indicator.pine)
- [`tradingview/pine/orb_regime_long_strategy.pine`](../../tradingview/pine/orb_regime_long_strategy.pine)
- Alert guide: [`tradingview/pine/ALERT_JSON.md`](../../tradingview/pine/ALERT_JSON.md)

Webhook: `POST /api/v1/webhooks/tradingview/{endpointToken}` with body secret.

## UI

Sidebar → **Market Analytics** (paper badge). Pages: Overview, Markets, Strategies, Signals, Paper Trading, Orders, Positions, Portfolio, Performance, Risk, Broker Accounts, TradingView Setup, Alerts, Audit, Settings.

DEMO seed data is labeled **DEMO** and must not be mixed with real account results.

## Kill switch

Blocks new entries; cancels only this strategy’s unfilled entry orders. Does **not** auto-liquidate positions.

## Tests

```bash
cd backend && npm run test:market-analytics
# frontend
npm test -- src/modules/market-analytics
# e2e (optional, needs servers)
npx playwright test e2e/market-analytics.spec.ts
```

## Operational checklist (before automated broker-paper)

- [ ] ≥20 sessions signal validation  
- [ ] ≥100 paper signals reviewed  
- [ ] Duplicate / replay tests passed  
- [ ] Restart reconciliation verified  
- [ ] Transaction-cost reporting verified  
- [ ] Drawdown controls verified  

## Troubleshooting

| Issue | Check |
|-------|--------|
| 401 webhook | Secret + endpoint token |
| Duplicate always | Same `signal_id` — expected |
| Paper not submitting | Both YES flags + mode not `signal` + reconcile OK |
| IBKR connect fails | Paper port 7497/4002; account `DU…` |

## IBKR paper notes

TWS paper socket is often **7497**; IB Gateway paper often **4002**. Validate locally. Full `ibapi` placeOrder remains in [`libs/ibkr-orb-paper`](../../libs/ibkr-orb-paper); TS `IBKRPaperAdapter` enforces safety and bridges.
