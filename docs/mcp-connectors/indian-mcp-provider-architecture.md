# Indian MCP Provider Architecture

Product: **BusineXAi TradeOS360**  
Assistant: **DhanLaxmi**

## Goals

- One common `BaseTradingMCPProvider` for all Indian brokers and data vendors
- YAML-driven registry — no hardcoded broker switches in trading services
- Secure defaults: live trading off, secrets encrypted, full audit trail
- Paper + mock providers for advisory, demos, and CI

## Layers

| Layer | Responsibility |
|-------|----------------|
| Config YAML | Provider metadata, capabilities, credential schema |
| Registry | Load/validate/list/filter providers; instantiate adapters |
| SecretManager | Encrypt/store/rotate credentials; never log plaintext |
| mcp-connector-service | REST APIs, tenant isolation, health monitor, Kafka events |
| Adapters | Broker-specific HTTP/MCP binding + normalization maps |
| Consumers | DhanLaxmi, AI Advisory, OMS/RMS (live only) |

## Order path

```
User / Strategy
  → Order Preview (always allowed if connected)
  → User Approval
  → RMS Approval
  → OMS
  → place_order_disabled_by_default (gates)
  → Broker adapter
```

AI Advisory may preview and recommend — never execute.

## Kafka topics

- `mcp.provider.registered`
- `mcp.connection.created|tested|failed|connected|disconnected|health.changed`
- `mcp.account.snapshot.updated`
- `mcp.market.quote.received|tick.received`
- `mcp.order.preview.created`
- `mcp.provider.rate_limit.warning`
- `compliance.audit.created`

## Extending to a real broker API

1. Keep the same adapter class
2. Set `DHAN_BASE_URL` (or provider base URL) and `DHAN_USE_MOCK=false`
3. Implement real HTTP calls inside the adapter (replace `ProviderHTTPClient` mock fixtures)
4. Keep normalization maps (`map_order_status`, etc.) as the only translation layer OMS sees
