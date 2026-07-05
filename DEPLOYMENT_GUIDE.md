# SmartTrade Platform — Deployment Guide

## Architecture

```
Frontend (Vercel)  ──►  Backend API (GCP Cloud Run / AWS App Runner)
                              │
                              ├── PostgreSQL (Prisma)
                              ├── QuantConnect API
                              ├── Broker APIs (Zerodha/Upstox)
                              └── Prediction Engines → Vercel / AWS inference
```

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Environment variables configured (see `backend/.env.example`)

## Local Development

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with DATABASE_URL, JWT_SECRET, broker keys
npm install
npx prisma migrate dev
npm run dev

# Frontend (separate terminal)
cd ..
cp .env.example .env
npm install
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001

## Database Migration (Prisma — unified layer)

```bash
cd backend
npx prisma migrate dev --name add_prediction_engines
npx prisma generate
```

## Deploy Frontend to Vercel

```bash
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:
- `VITE_API_URL` = your backend URL + `/api`
- `BACKEND_API_URL` = same (for serverless predict proxy)

The `vercel.json` rewrites `/api/*` to your Cloud Run backend.

## Deploy Backend to GCP Cloud Run

```bash
cd backend
npm run deploy:cloud-run
```

## Deploy Backend + Predictions to AWS

```bash
# Build and push Docker image, deploy App Runner + API Gateway
.\aws\deploy.ps1 -Region ap-south-1
```

After deployment, set in backend environment:
- `AWS_PREDICTION_URL` = CloudFormation output `PredictionApiUrl`
- `AWS_REGION` = ap-south-1

## Prediction Engine Workflow

1. **Create** — POST `/api/predictions/engines` with name, type, symbols
2. **Train** — POST `/api/predictions/engines/:id/train` (backtests on historical data)
3. **Predict** — POST `/api/predictions/engines/:id/predict` (live signals)
4. **Deploy** — POST `/api/predictions/engines/:id/deploy` with `{ "target": "vercel" | "aws" }`

Engine types: `momentum`, `mean_reversion`, `ml_regression`, `ensemble`

## Authentication

All API routes (except `/health`, `/api/market/status`, `/api/market/indices`) require JWT.

Register at `/api/auth/register`, login at `/api/auth/login`.

Frontend stores token in `localStorage.authToken`.

## Broker Integration

1. Set Zerodha/Upstox API keys in backend `.env`
2. GET `/api/broker/:broker/login` → redirect user to OAuth
3. Callback stores encrypted tokens in PostgreSQL
4. POST `/api/broker/:brokerId/sync` → pulls live holdings

## QuantConnect

Set `QC_USER_ID` and `QC_API_TOKEN` in backend env. Routes mounted at `/api/quantconnect/*`.
