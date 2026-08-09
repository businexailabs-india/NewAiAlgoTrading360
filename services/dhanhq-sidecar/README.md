# DhanHQ Sidecar (official [DhanHQ-py](https://github.com/dhan-oss/DhanHQ-py))

Python FastAPI bridge around `dhanhq` for TradeOS360. Node keeps OMS (`DhanDirectAdapter`); this sidecar owns SDK-native calls (option chain, quotes, historical, research).

## Quick start

```powershell
cd services/dhanhq-sidecar
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Reuse backend credentials
$env:DHAN_CLIENT_ID = (Select-String -Path ..\..\backend\.env -Pattern '^DHAN_CLIENT_ID=').Line.Split('=',2)[1]
$env:DHAN_ACCESS_TOKEN = (Select-String -Path ..\..\backend\.env -Pattern '^DHAN_ACCESS_TOKEN=').Line.Split('=',2)[1]

# Smoke / research (no server required)
python scripts/smoke_dhanhq.py
python scripts/research_option_chain.py

# Run sidecar
uvicorn app.main:app --host 0.0.0.0 --port 8099 --reload
```

Or Docker:

```powershell
docker compose -f docker-compose.dhanhq.yml --env-file backend/.env up -d --build
```

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | SDK + env status |
| GET | `/v1/funds` | Fund limits |
| GET | `/v1/holdings` | Holdings |
| GET | `/v1/positions` | Positions |
| GET | `/v1/orders` | Order book |
| POST | `/v1/quotes/ohlc` | Snapshot OHLC |
| POST | `/v1/option-chain` | Full chain |
| GET | `/v1/expiry-list` | Expiries for underlying |
| POST | `/v1/historical` | Daily / minute OHLC |
| POST | `/v1/orders/place` | **Gated** — needs `DHANHQ_ALLOW_LIVE_ORDERS=true` |

Credentials: env `DHAN_CLIENT_ID` + `DHAN_ACCESS_TOKEN`, or pass in JSON body / query.

## Wire to Express

```
DHAN_SIDECAR_URL=http://127.0.0.1:8099
```

Gateway routes under `/api/integrations/dhanhq/*` proxy health, funds, option-chain.

## Safety

- Live place-order disabled by default
- Prefer paper OMS in Node for agents; use sidecar for market data / chain / research
