# AI Algo Advisory & Strategy Marketplace Engine

Production-oriented vertical slice for BusineXAi TradeOS.

## Quick start

1. Apply Prisma migration for tenants/outbox (`backend/prisma/migrations/20260717110000_advisory_tenants_outbox`).
2. Set `SERVICE_HMAC_SECRET` and advisory service URLs in `backend/.env` (see `.env.example`).
3. Start Python services (or Compose):

```bash
docker compose -f docker-compose.advisory.yml up -d --build
```

4. Run advisory unit tests (per-service; avoids colliding `app` packages):

```powershell
powershell -File scripts/run-advisory-tests.ps1
# or: cd backend && npm run test:advisory
```

5. Gateway unit checks:

```bash
cd backend && npm run test:unit
```

6. If Prisma migrate history is out of sync with an existing DB, apply tenants/outbox SQL idempotently:

```bash
cd backend && npx ts-node --transpile-only scripts/apply-advisory-migration.ts
```

## Docs

- [docs/ai-advisory](docs/ai-advisory)
- [docs/mcp-connectors](docs/mcp-connectors)
- [docs/strategy-marketplace](docs/strategy-marketplace)
- [docs/compliance](docs/compliance)

## UI

- Dashboard: login advisory card (polls `/api/advisory/latest`)
- AI Advisor / Strategies → AI Algo Advisory panel
