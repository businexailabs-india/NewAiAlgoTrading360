# Testing Guide

## Unit (`libs/mcp-connectors/tests`)

- YAML registry load
- Capability validation
- Dhan mock connection
- Zerodha / Angel One `not_configured`
- Paper order fill
- Live order blocked by default
- Credential masking + LocalEncryptedSecretManager
- Order status / symbol normalization

## Integration (`services/mcp-connector-service/tests`)

1. List Indian providers  
2. Connect mock Dhan → test → snapshot  
3. Preview + paper execute; live Dhan blocked  
4. Cross-tenant isolation  
5. DhanLaxmi context has no secrets  
6. Advisory provider context paper/live-locked  
7. Health monitor run  

## Simulation scenarios (MockTradingProvider flags)

- `connected=False` — provider API down  
- `token_expired=True`  
- `rate_limited=True`  
- `stale=True` — stale quotes  
- `reject_orders=True` — broker reject  
- Kill switch: `KILL_SWITCH=true` / settings.kill_switch  
- Duplicate preview via same `idempotency_key`  

## Run

```bash
pip install -e libs/advisory-core -e libs/mcp-connectors pyyaml pytest pytest-asyncio httpx
pytest libs/mcp-connectors/tests services/mcp-connector-service/tests -q
```
