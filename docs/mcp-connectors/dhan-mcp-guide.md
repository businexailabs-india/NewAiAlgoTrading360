# Dhan MCP Provider Guide (first-priority Indian broker)

| Field | Value |
|-------|-------|
| provider_id | `dhan` |
| adapter | `DhanMCPProvider` |
| HTTP client | `DhanHQConnector` |
| auth | `client_id` + `access_token` (+ optional `api_key`) |
| live_trading_default | **false** |

## Components

| Module | Role |
|--------|------|
| `credentials.py` | Credential schema + env mapping + masking |
| `connector.py` | `DhanHQConnector` mock/live HTTP |
| `fixtures.py` | Mock profile, funds, holdings, positions, orders, trades, LTP |
| `provider.py` | Normalized MCP methods + audit log |
| `dtos.py` | Snapshot + assistant status DTOs |

## APIs (mcp-connector-service)

- `GET /mcp/providers/dhan/credential-schema`
- `POST /mcp/connections` `{ "provider_id": "dhan", "config": { "use_mock": true } }`
- `GET /mcp/connections/{id}/snapshot` — profile, margins, holdings, positions, order book, trade book
- `GET /mcp/dhanlaxmi/dhan-status` — masked status for “mera Dhan account status batao”
- `POST .../orders/preview` — preview only
- `POST .../orders/execute-disabled` — **403** unless OMS/RMS gates + `LIVE_TRADING_ENABLED`

## Modes

- **Mock/demo (default)** — fixtures; no network
- **Live HTTP** — only if `DHAN_CLIENT_ID` + `DHAN_ACCESS_TOKEN` + `DHAN_BASE_URL` + `DHAN_ALLOW_LIVE_HTTP=true`

## Env

```
MCP_ENABLE_DHAN=true
DHAN_BASE_URL=
DHAN_API_KEY=
DHAN_CLIENT_ID=
DHAN_ACCESS_TOKEN=
DHAN_USE_MOCK=true
DHAN_ALLOW_LIVE_HTTP=false
LIVE_TRADING_ENABLED=false
```

## Integrations

- **DhanLaxmi** — `/mcp/dhanlaxmi/dhan-status` + chat intent for Dhan account status (no secrets)
- **AI Advisory** — `broker=dhan` loads Dhan margins/holdings/positions/snapshot via `get_connector("dhan")`

## Normalization

- Order status: `TRADED` → `FILLED`, `PENDING` → `PENDING`
- Product: `INTRADAY` → `MIS`, `CNC` → `CNC`
- Symbols: `NSE:RELIANCE`
