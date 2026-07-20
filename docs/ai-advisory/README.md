# AI Algo Advisory Engine

Login-triggered, compliance-aware strategy advisory for BusineXAi TradeOS.

## Architecture

```mermaid
flowchart LR
  Web[ReactFrontend] --> Gateway[TypeScriptGateway]
  Gateway --> Outbox[LoginEventOutbox]
  Outbox --> Advisory[AIAdvisoryService]
  Advisory --> MCP[MCPConnectorService]
  Advisory --> Paper[PaperTestOrchestrator]
  Advisory --> Ext[ExternalAlgoDiscovery]
  Paper --> RMS[GatewayRMS]
```

## Flow

1. User logs in → gateway enqueues `user.login.success` (non-blocking).
2. Frontend shows **AI advisory is being prepared**.
3. `ai-advisory-service` collects redacted broker/portfolio/market context.
4. Market regime + recommendation engine produce 3–5 candidates (incl. no-trade when needed).
5. User converts → immutable strategy version → paper test → save → paper deploy.
6. Live requires paper qualification, license validation, risk disclosure, explicit confirmation, admin RMS, and `LIVE_TRADING_ENABLED`.

## APIs (gateway)

- `POST /api/advisory/generate`
- `GET /api/advisory/latest`
- `POST /api/advisory/{id}/recommendations/{rid}/convert-to-algo`
- `POST /api/strategy-options/{id}/paper-test`
- `POST /api/strategy-options/{id}/request-live-approval`
- `POST /api/external-algos/discover`

## LLM provider

Default primary is **Bifrost → Claude** (`DEFAULT_LLM_PROVIDER=claude`, `BIFROST_ENABLED=true`).

```
BIFROST_ENABLED=true
BIFROST_BASE_URL=http://localhost:8080
DEFAULT_LLM_PROVIDER=claude
FALLBACK_LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=                 # optional secondary
OPENROUTER_MODEL=openai/gpt-4o-mini
ALLOW_MOCK_LLM=true
LLM_FORCE_ANTHROPIC=true
```

Start Bifrost with `npm run bifrost:up` (backend) or `docker compose -f docker-compose.bifrost.yml up -d`.  
Secrets and PII are redacted before any LLM call. If Bifrost is down, traffic falls back to OpenRouter (when keyed) then Mock / deterministic recommendation engine.

## Safety

- Never promises profit / guaranteed returns.
- Advisory never places orders.
- Live disabled by default.
- Paper test required.
- All AI decisions and approvals audited.
