# MCP Connectors

`BaseTradingMCPConnector` defines broker/MCP capabilities for advisory context only.

## Implementations

| Connector | Status |
|-----------|--------|
| PaperTradingMCPConnector | Functional simulation |
| MockTradingMCPConnector | Unit tests |
| Dhan / Zerodha / Angel / Upstox / IBKR / Alpaca | Capability placeholders (`not_configured`) until MCP/API wired |

## Hard rules

- `execute_order_disabled_by_default()` always raises.
- Live execution must go through OMS + RMS on the TypeScript gateway.
- Secrets never leave the gateway; connectors receive redacted snapshots only.
