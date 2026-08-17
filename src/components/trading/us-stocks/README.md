# US Stocks Manual Trading (frontend)

Institutional IBKR workstation for US equities & ETFs: paper and live via **connection profiles**, order preview, broker-reply confirmation, and live book monitoring.

## Routing (Vite / App.tsx — not Next.js)

**Already wired:** Sidebar → **Trade → US Stocks (IBKR)** → section `trade-us-stocks` → window `us-stocks-manual-trading`.

There is **no** Next.js route at `/trade/us-stocks`. The HTTP API lives under `/api/trade/us-stocks/*` on the Express backend.

## Paper / live safety

- Environment is **`PAPER` | `LIVE` from the selected IBKR connection profile** (`profile.environment`).
- Switching paper ↔ live means **selecting a different IBKR profile**, never flipping a client `isPaper` boolean.
- Persistent environment banner + `document.title` (`[PAPER]` / `[LIVE]`) + chips on ticket, preview, and confirm modals.
- Preview never submits. Paper confirm: **Place Paper Order**. Live confirm: checkbox + typed `LIVE` + button like `LIVE BUY 25 SHARES`.
- IBKR `BROKER_CONFIRMATION_REQUIRED` shows the exact broker message; Confirm / Reject only — **never auto-confirm**.

## Backend API

Client: `api.ts` → `{API_BASE_URL}/trade/us-stocks/...` with `Authorization: Bearer` from `localStorage` (`authToken` / `token` / `accessToken`).

| Method | Path |
|--------|------|
| GET | `/session` |
| POST | `/session/establish` |
| GET | `/profiles` |
| POST | `/profiles/select` |
| GET | `/accounts` |
| GET | `/accounts/:accountId/summary` |
| GET | `/instruments/search?q=` |
| GET | `/instruments/:conId` |
| GET | `/instruments/:conId/capabilities` |
| GET | `/quotes/:conId` |
| GET | `/market-session` |
| GET | `/accounts/:accountId/positions` |
| GET | `/accounts/:accountId/orders` |
| GET | `/accounts/:accountId/executions` |
| POST | `/orders/preview` |
| POST | `/orders/submit` |
| POST | `/orders/reply/:messageId/confirm` |
| POST | `/orders/reply/:messageId/reject` |
| POST | `/orders/:orderId/modify` |
| DELETE | `/orders/:orderId` |
| GET | `/orders/:orderId` |
| GET | `/orders/:orderId/events` |
| GET | `/audit` |

If the backend is down or not mounted, the UI shows clear error / empty states (no silent fake fills).

## Mock mode

When the server runs with `IBKR_US_STOCKS_MODE=mock` (default), session/summary/quotes may be labeled **DEMO IBKR DATA**. Treat as demo — not a live entitlement.

## Remaining IBKR Client Portal Gateway config

Live adapter still requires server-side Gateway / Client Portal setup (credentials never in the browser):

- `IBKR_US_STOCKS_MODE=live` (only after ops sign-off)
- `IBKR_WEBAPI_BASE` (Client Portal Gateway base URL, typically local HTTPS)
- Authenticated paper vs live **profiles** created server-side
- Gateway SSL, SSO / tickle session, and account entitlements

See also `docs/mcp-connectors/ibkr-guide.md` for TWS/Gateway ports and paper-first policy. Client Portal Web API paths are documented as comments on the backend adapter only.

## Tests

```bash
npm test -- src/components/trading/us-stocks/__tests__/format-env.test.ts
```

Covers env labels, USD formatting, and that environment is derived from `profile.environment` (not a boolean alone).
