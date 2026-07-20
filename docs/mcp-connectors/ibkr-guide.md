# Interactive Brokers (IBKR) MCP Connector Guide

## Overview

BusineXAi TradeOS360 connects to Interactive Brokers through the **IBKR MCP Provider** (`provider_id: ibkr`). The connector is **paper-first**: paper trading is the default, and live trading is locked unless explicitly enabled through environment flags and the OMS/RMS approval chain.

AI Advisory and DhanLaxmi may **read** masked account/portfolio/market context. They must **never** place IBKR orders directly.

## TWS vs IB Gateway vs Web API vs FIX

| Mode | Description | Status in TradeOS360 |
|------|-------------|----------------------|
| **TWS API** | Trader Workstation socket API (ibapi) | Primary target (`tws_api`) |
| **IB Gateway** | Headless IB Gateway socket API | Supported connection mode (`ib_gateway`) |
| **Client Portal Web API** | HTTPS REST/WebSocket | Placeholder only |
| **FIX** | Institutional FIX session | Placeholder only |

Paper TWS commonly listens on port **7497**; live TWS on **7496**. Gateway paper is often **4002**, live **4001**. Runtime ports always come from `IBKR_PORT` — never hardcode in application logic.

## Paper trading setup

1. Install TWS or IB Gateway and enable API access (Configure → API → Settings).
2. Log into a **paper** account.
3. Note the API socket port (paper TWS default is typically 7497).
4. Set environment variables (see below) with `IBKR_MODE=paper` and `IBKR_LIVE_TRADING_ENABLED=false`.
5. For local/dev without TWS, keep `IBKR_USE_MOCK=true` (default) — uses `MockIBKRClient`.

## Environment variables

```
IBKR_HOST=127.0.0.1
IBKR_PORT=7497
IBKR_CLIENT_ID=1001
IBKR_ACCOUNT_ID=
IBKR_MODE=paper
IBKR_LIVE_TRADING_ENABLED=false
IBKR_CONNECT_TIMEOUT_SECONDS=15
IBKR_USE_MOCK=true
IBKR_CONNECTION_MODE=mock
MCP_ENABLE_IBKR=true
LIVE_TRADING_ENABLED=false
```

Do not commit real account IDs or credentials. Account identifiers are masked in API responses and audit logs.

## Local setup steps

1. Ensure `config/mcp-providers/global-brokers.yaml` is loaded (registry includes it automatically).
2. From repo root:
   ```powershell
   $env:MCP_ENABLE_IBKR="true"
   $env:IBKR_USE_MOCK="true"
   $env:IBKR_MODE="paper"
   python -m pytest libs/mcp-connectors/tests/test_ibkr_provider.py -q
   ```
3. Start MCP connector service and call:
   - `POST /mcp/providers/ibkr/connect`
   - `GET /mcp/providers/ibkr/account-summary`
   - `POST /mcp/providers/ibkr/orders/preview`
   - `POST /mcp/providers/ibkr/orders/paper` (OMS role + approvals required)

Optional: install `ibapi` for future real TWS sockets. Without it, `MockIBKRClient` remains the default.

## Production deployment notes

- Run IB Gateway (preferred) or TWS on a secured host/VPC.
- Inject `IBKR_*` via secret manager / orchestrator env — never bake into images.
- Keep `IBKR_LIVE_TRADING_ENABLED=false` until the live checklist is complete.
- Network: allow app → Gateway/TWS on the configured port only.
- Use unique `IBKR_CLIENT_ID` per service instance.
- Compliance must receive redacted audit events for connect/orders/executions.

## Safety rules

1. Paper trading is default (`IBKR_MODE=paper`).
2. Live trading disabled by default (`IBKR_LIVE_TRADING_ENABLED=false`).
3. AI Advisory / DhanLaxmi cannot place IBKR orders.
4. Every executable order requires: **User Approval → RMS → OMS → IBKR Connector**.
5. Every order requires an **idempotency key**.
6. All IBKR request/response audits redact account IDs and secrets.
7. Live path uses `place_order_disabled_by_default` and platform `LiveOrderGateContext`.

## Testing checklist

- [ ] Provider appears in registry (`provider_id=ibkr`)
- [ ] Paper port default is 7497 from env
- [ ] Mock account summary / positions map correctly
- [ ] Market order preview accepted in paper mode
- [ ] Paper order accepted via OMS-approved path
- [ ] Live order rejected when `IBKR_LIVE_TRADING_ENABLED=false`
- [ ] Direct AI/DhanLaxmi order rejected
- [ ] Account id masked; audit log present
- [ ] Simulation: disconnect, timeout, duplicate idempotency, MD down, contract missing, reject, partial fill

## Live trading enablement checklist

Only after explicit ops/compliance sign-off:

1. [ ] `LIVE_TRADING_ENABLED=true` (platform)
2. [ ] `IBKR_LIVE_TRADING_ENABLED=true`
3. [ ] `IBKR_MODE=live`
4. [ ] `IBKR_PORT` set to live TWS/Gateway port
5. [ ] `IBKR_USE_MOCK=false` and real ibapi harness certified
6. [ ] Per-connection `provider_live_trading_enabled=true` (admin)
7. [ ] Kill switch off; RMS + user approval required
8. [ ] Caller role is `oms_service` only
9. [ ] Idempotency keys enforced end-to-end
10. [ ] Compliance audit verified on a canary paper→live promotion

## Package layout

```
libs/mcp-connectors/src/mcp_connectors/global/ibkr/
  models.py
  provider.py
  contract_mapper.py
  order_mapper.py
  market_data_mapper.py
  ibkr_client.py
  errors.py
  config.py

libs/mcp-connectors/src/mcp_connectors/ibkr.py   # public import shim
services/mcp-connector-service/providers/ibkr_provider.py
config/mcp-providers/global-brokers.yaml
```

Import tip: the folder name `global` is a Python keyword. Prefer:

```python
from mcp_connectors.ibkr import IBKRMCPProvider, MockIBKRClient
```

## APIs

| Method | Path |
|--------|------|
| GET | `/mcp/providers/ibkr` |
| POST | `/mcp/providers/ibkr/connect` |
| GET | `/mcp/providers/ibkr/health` |
| GET | `/mcp/providers/ibkr/account-summary` |
| GET | `/mcp/providers/ibkr/positions` |
| GET | `/mcp/providers/ibkr/orders` |
| GET | `/mcp/providers/ibkr/executions` |
| GET | `/mcp/providers/ibkr/contract-search?query=AAPL` |
| GET | `/mcp/providers/ibkr/quote/{symbol}` |
| GET | `/mcp/providers/ibkr/historical-data` |
| POST | `/mcp/providers/ibkr/orders/preview` |
| POST | `/mcp/providers/ibkr/orders/paper` |
| POST | `/mcp/providers/ibkr/orders/live-disabled` |
