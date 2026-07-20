# Indian MCP Provider Framework — BusineXAi TradeOS360

Unified MCP-style connector layer for Indian brokers, market data, paper trading, and mock providers.

## Architecture

```
UI / DhanLaxmi / AI Advisory
        │
        ▼
mcp-connector-service (FastAPI :8094)
        │
        ├── MCPProviderRegistry (YAML config)
        ├── SecretManager (encrypted credentials)
        ├── ConnectionStore (tenant-isolated)
        └── BaseTradingMCPProvider adapters
                ├── india/dhan, zerodha, angelone, ...
                ├── india/paper_trading, mock
                └── market_data/truedata, mock, ...
```

**Hard rules**

1. Live order execution disabled unless `LIVE_TRADING_ENABLED=true` **and** caller is OMS **and** RMS + user approvals exist **and** kill switch is off.
2. AI Advisory / DhanLaxmi never receive raw API keys, tokens, passwords, or TOTP secrets.
3. All live trades: approval → RMS → OMS → execution router → broker adapter.
4. Broker-specific logic lives only inside provider adapters — never in trading services.

## Quick start

```bash
docker compose -f docker-compose.advisory.yml up -d mcp-connector-service
curl http://localhost:8094/health
```

Config: `config/mcp-providers/*.yaml`  
Library: `libs/mcp-connectors`  
Service: `services/mcp-connector-service`

## Docs index

1. [Indian MCP Provider Architecture](./indian-mcp-provider-architecture.md)
2. [Provider Registry Guide](./provider-registry-guide.md)
3. [Adding a New Indian Broker Provider](./provider-onboarding-guide.md)
4. [Dhan MCP Provider Guide](./dhan-mcp-guide.md)
5. [Zerodha Provider Guide](./zerodha-mcp-guide.md)
6. [Angel One Provider Guide](./angelone-mcp-guide.md)
7. [Upstox Provider Guide](./upstox-mcp-guide.md)
8. [Market Data Provider Guide](./market-data-provider-guide.md)
9. [Credential Security Guide](./credential-security-guide.md)
10. [Testing Guide](./testing-guide.md)
11. [Production Deployment Checklist](./production-deployment-checklist.md)
12. [Indian Broker Provider Guide](./indian-broker-provider-guide.md)
13. [Phase 2 Real Provider Readiness](./phase2-readiness.md)
