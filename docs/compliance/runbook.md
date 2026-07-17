# Advisory engine runbook

## Local bring-up

1. Ensure Postgres (`smarttrade`) and Redis are running.
2. Apply Prisma migration for tenants/outbox:
   ```bash
   cd backend && npx prisma migrate deploy && npx prisma generate
   ```
3. Start advisory stack:
   ```bash
   docker compose -f docker-compose.advisory.yml up -d --build
   ```
4. Set gateway env (`backend/.env`):
   - `AI_ADVISORY_SERVICE_URL=http://localhost:8091`
   - `PAPER_TEST_SERVICE_URL=http://localhost:8092`
   - `EXTERNAL_ALGO_SERVICE_URL=http://localhost:8093`
   - `MCP_CONNECTOR_SERVICE_URL=http://localhost:8094`
   - `SERVICE_HMAC_SECRET=...` (same as compose)
5. Restart TypeScript gateway; login should return `advisory.status=preparing`.

## Health checks

| Service | URL |
|---------|-----|
| AI advisory | `http://localhost:8091/health` |
| Paper test | `http://localhost:8092/health` |
| External discovery | `http://localhost:8093/health` |
| MCP connector | `http://localhost:8094/health` |
| Redpanda console | `http://localhost:8085` |

## Common failures

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Advisory stuck on preparing | Outbox not dispatching / service down | Check `EventOutbox` status; hit advisory `/health`; review gateway logs `outbox.*` |
| 401/403 from Python services | HMAC mismatch | Align `SERVICE_HMAC_SECRET` |
| Prisma `tenant` / `eventOutbox` missing | Migration not applied | `prisma migrate deploy` |
| Live request always blocked | Expected default | Confirm paper qualification, disclosure, admin approval, `LIVE_TRADING_ENABLED`, kill switch |

## Verification

```powershell
# From repo root
powershell -File scripts/run-advisory-tests.ps1
cd backend; npm run test:unit; npx tsc --noEmit
```

## Kill switch

If live risk is elevated, set global trading control kill switch and ensure `LIVE_TRADING_ENABLED=false`. Advisory continues to generate paper-only recommendations.
