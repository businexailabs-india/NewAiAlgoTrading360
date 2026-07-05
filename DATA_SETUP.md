# Historical Data & ML Training Guide

## Quick Start

```bash
cd backend

# Collect 10 years of NIFTY 50 daily OHLCV data (Yahoo Finance)
npm run collect-data

# Or 5 years
npm run collect-data:5y
```

Data is saved to: `backend/data/historical/{SYMBOL}.json`

## What Gets Collected

- **48+ NIFTY 50 stocks** (10 years daily bars)
- Each file: open, high, low, close, volume per trading day
- Manifest: `backend/data/historical/manifest.json`

## Train/Test Split

Prediction engines use an **80/20 train/test split** on local historical data:

| Set | Purpose |
|-----|---------|
| Train (80%) | Fit momentum, mean-reversion, regression signals |
| Test (20%) | Measure out-of-sample accuracy |

Training metrics stored in engine `parameters.lastTraining`:
- `trainAccuracy` — in-sample
- `testAccuracy` — out-of-sample (used as engine accuracy %)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/status` | List local datasets |
| GET | `/api/data/symbol/:symbol` | View symbol data + split info |
| POST | `/api/data/collect` | Trigger collection `{ "years": 10 }` |

## Re-collect After Updates

```bash
npm run collect-data
```

Large JSON files are gitignored — regenerate on each machine.

## Current Collection Stats

Last run collected **~118,000 bars** across **48 symbols** (10 years).

Failed symbols (Yahoo ticker issues): retry with alternate symbols manually.
