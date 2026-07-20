# Phase 3 — Indian MCP Provider Integration

## Providers (YAML-driven)

Configured in `config/mcp-providers/`:

| File | Role |
|------|------|
| `india-brokers.yaml` | Broker + paper/mock adapters |
| `phase3-providers.yaml` | Canonical Phase-3 preference order |
| `provider-capabilities.yaml` | Capability matrix |
| `provider-permissions.yaml` | RBAC |

Phase-3 set: **Dhan, Zerodha, Angel One, Upstox, Fyers, ICICI Breeze, Kotak Neo, Alice Blue, Finvasia Shoonya, Paper Trading, Mock Trading**.

Business logic resolves providers via `MCPProviderRegistry` / `resolve_preferred_provider` — IDs are not hardcoded.

## Hard rules

- `live_trading_default: false` for every provider
- Credentials encrypted at rest (`LocalEncryptedSecretManager`; Vault/AWS stubs for prod)
- Credentials masked on all public APIs and assistant contexts
- Cross-tenant connection access returns 404

## Key APIs

- `GET /mcp/providers` · capabilities · required-credentials
- `POST /mcp/connections` · snapshot · health · orders (paper allowed / live blocked)
- `GET /mcp/dhanlaxmi/context` · `/provider-status` · `/dhan-status`
- `GET /mcp/advisory/provider-context`
- Admin: `/admin/mcp/providers`, enable/disable, health, audit

## Consumers

- **AI Advisory** — `collect_broker_context` uses `fetch_provider_account_context` + YAML preference
- **DhanLaxmi** — provider status query via registry; secrets never returned

## Tests

`tests/phase3/test_indian_mcp_providers.py` plus `libs/mcp-connectors/tests` and `services/mcp-connector-service/tests`.
