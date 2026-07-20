# Adding a New Indian Broker Provider

1. **YAML** — add entry to `config/mcp-providers/india-brokers.yaml` with `provider_id`, exchanges, capabilities, `credentials_required`, `live_trading_default: false`, `adapter_class`.

2. **Adapter package**

```
libs/mcp-connectors/src/mcp_connectors/india/<provider_id>/
  __init__.py
  provider.py   # subclass PlaceholderBrokerProvider or BaseTradingMCPProvider
```

3. **Implement** connect/auth/account/market/preview methods. Wire live place/modify/cancel only behind `_place_live_order` (gates enforced by base class).

4. **Normalize** symbols, order status, product type, order type via `base/mappings.py`.

5. **Secrets** — accept credentials in `connect()` but store only via `SecretManager` in the service layer; adapter keeps `_present` flag only.

6. **Tests** — mock HTTP fixtures + not_configured graceful path.

7. **Docs** — add `<provider>-mcp-guide.md`.

8. **Env** — `MCP_ENABLE_<PROVIDER>=false` by default until certified.
