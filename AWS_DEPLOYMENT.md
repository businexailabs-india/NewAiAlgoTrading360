# AWS Deployment — SmartTrade Platform

Deploy the backend to **AWS only** (RDS PostgreSQL + S3 + ECS Fargate + ALB + API Gateway).  
The Vercel frontend proxies `/api/*` to the AWS backend via `BACKEND_API_URL`.

## Architecture

```
Vercel (SPA)  ──proxy /api──►  ALB  ──►  ECS Fargate (Node backend)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              RDS PostgreSQL    S3 (historical)   API Gateway (/predict)
```

| Service | Purpose |
|---------|---------|
| **ECS Fargate** | Backend API container |
| **RDS PostgreSQL** | Users, portfolios, orders, predictions |
| **S3** | 10-year historical OHLCV data for ML training |
| **ALB** | Public HTTP endpoint for backend |
| **API Gateway** | Deployed prediction engine inference URL |

## Prerequisites

1. **AWS CLI** — `aws configure` with valid access keys
2. **Docker Desktop** — build and push container to ECR
3. **Node.js 20+** — local build steps
4. **Vercel CLI** (optional) — auto-update frontend after deploy

## Quick deploy

```powershell
cd backend
npm install
npm run collect-data          # optional: fetch 10yr NIFTY50 data locally
npm run deploy:aws            # full stack + optional Vercel update
```

With data upload to S3:

```powershell
cd backend
npm run deploy:aws -- -UploadData
```

## After deployment

Outputs are saved to `aws/deployment-output.json`:

- `backendUrl` — set as **BACKEND_API_URL** in Vercel
- `predictionApiUrl` — AWS prediction inference URL (set on ECS automatically)
- `s3Bucket` — historical data bucket
- `databaseEndpoint` — RDS host

### Vercel environment variables

| Variable | Value |
|----------|-------|
| `BACKEND_API_URL` | `http://smarttrade-alb-xxx.ap-south-1.elb.amazonaws.com` |
| `VITE_API_URL` | `/api` |

### Upload historical data

```powershell
.\aws\upload-historical-data.ps1
```

## Troubleshooting

### `InvalidClientTokenId`

Run `aws configure` with new IAM access keys.

### Docker not found

Install Docker Desktop or deploy from a machine with Docker.
