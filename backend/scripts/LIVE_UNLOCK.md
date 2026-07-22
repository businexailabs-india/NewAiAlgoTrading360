# Controlled Live Options Unlock

Paper acceptance already passed (`READY_FOR_FEATURE_LIVE_OPTIONS=YES`). This pack turns on live submit **gates** and verifies a **preview-only** dry-run. It does **not** place a broker order unless you explicitly opt in.

## 1. Enable env flags

In `backend/.env`:

```env
FEATURE_LIVE_OPTIONS=true
LIVE_TRADING_ENABLED=true
```

Restart the backend after changing env.

## 2. Approve controls + readiness check

```powershell
cd backend
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
$env:APPLY_CONTROLS = "true"
# Optional: pin to a desk user that already has a Dhan account selected
# $env:UNLOCK_EMAIL = "you@example.com"
# $env:UNLOCK_PIN = "2468"
npm run test:unlock:live
```

Report: `backend/scripts/output/live-unlock-report.json`

| ID | Check |
|----|--------|
| L1 | `FEATURE_LIVE_OPTIONS=true` |
| L2 | `LIVE_TRADING_ENABLED=true` |
| L3 | Unlock user resolved |
| L4 | TradingControl GLOBAL+USER approved, kill off |
| L5 | Active broker connection |
| L6 | Desk LIVE mode + liveEnabled |
| L7 | Funds probe |
| L8 | Live preview 1-lot (no submit) |
| L9 | Submit skipped unless dual opt-in |

`READY_FOR_MANUAL_ONE_LOT=YES` means you may place **one** intentional live order from the UI.

## 3. Manual one-lot dry-run (UI)

1. TopBar → **LIVE** (Trading PIN)
2. Confirm kill switch is **OFF** (Integrations)
3. Options chain → liquid **NIFTY** CE, **1 lot**, NRML
4. Live Options Terminal → Preview → Submit (PIN + confirm)
5. Immediately verify Orders / Positions / MTM
6. Cancel or square-off when done

## 4. Optional scripted submit (real money)

Only if you accept real capital risk:

```powershell
$env:APPLY_CONTROLS = "true"
$env:LIVE_UNLOCK_SUBMIT = "true"
$env:LIVE_UNLOCK_I_UNDERSTAND_REAL_MONEY = "YES"
$env:UNLOCK_PIN = "your-trading-pin"
npm run test:unlock:live
```

## Kill / rollback

```env
FEATURE_LIVE_OPTIONS=false
# or
LIVE_TRADING_ENABLED=false
```

Or Integrations → **Kill Switch ON**.

Do not leave live flags on in shared/prod without monitoring.

## Token expiry

If unlock reports `DH-901` / funds `401`, refresh `DHAN_ACCESS_TOKEN` in `backend/.env` from the DhanHQ developer portal, then re-run:

```powershell
$env:APPLY_CONTROLS = "true"
npm run test:unlock:live
```

Gates (L1–L6, L8) can be green while L7 fails — **do not place a live order until L7 passes**.
