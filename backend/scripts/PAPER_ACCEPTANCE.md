# Paper Options Acceptance Pack

Run this **before** enabling live options submit.

## Command

```bash
cd backend
# Use system Node if nvm path is broken
npx ts-node --transpile-only scripts/paper-acceptance.ts
```

Optional:

```bash
# Keep the acceptance user in DB
set ACCEPTANCE_KEEP_USER=true

# Also try live Dhan scrip-master sync (network)
set ACCEPTANCE_TRY_DHAN_SYNC=true
```

Report written to: `backend/scripts/output/paper-acceptance-report.json`

## What it proves

| ID | Check |
|----|--------|
| A1 | Master seeded from feed-shaped CSV (no hard-coded strike ladder) |
| A2 | Underlyings / expiries / chain from instrument master |
| A3 | Mode switch requires Trading PIN; wrong PIN rejected; PAPER mode |
| A4 | Risk blocks invalid lot, expired contract, naked short |
| A5 | Paper preview/place never sets `liveBrokerSubmit` |
| A6 | Live options submit gated while `FEATURE_LIVE_OPTIONS=false` |
| A7 | Paper strategy saved (clone-to-live path input) |

Exit code `0` + `READY_FOR_FEATURE_LIVE_OPTIONS=YES` means automated gates passed.

## Unlock live (manual sign-off)

Only after report says YES — follow **[LIVE_UNLOCK.md](./LIVE_UNLOCK.md)**:

1. Set `FEATURE_LIVE_OPTIONS=true` + `LIVE_TRADING_ENABLED=true`
2. `APPLY_CONTROLS=true npm run test:unlock:live`
3. Refresh `DHAN_ACCESS_TOKEN` until funds probe (L7) passes
4. First live order: **1 lot**, liquid index option, then reconcile

Do **not** enable live submit if any blocking check failed.
