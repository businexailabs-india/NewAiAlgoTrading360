# Provider Registry Guide

`MCPProviderRegistry` loads:

- `config/mcp-providers/india-brokers.yaml`
- `config/mcp-providers/india-market-data.yaml`
- `config/mcp-providers/provider-capabilities.yaml`
- `config/mcp-providers/provider-permissions.yaml`

Override directory with `MCP_PROVIDERS_CONFIG_DIR`.

## API

| Method | Purpose |
|--------|---------|
| `load_providers_from_yaml()` | Reload configs |
| `register_provider(id, factory)` | Code registration |
| `get_provider(id)` | Adapter instance |
| `list_providers()` / `list_enabled_providers()` | Catalog |
| `list_providers_by_country/capability/exchange` | Filters |
| `validate_provider_config` / `validate_credentials_schema` | Validation |
| `get_provider_capabilities` | Normalized capability matrix |

## REST

- `GET /mcp/providers?country=IN`
- `GET /mcp/providers/{id}/capabilities`
- `GET /mcp/providers/{id}/required-credentials`
- `POST /mcp/providers/{id}/validate-config`
- `POST /mcp/providers/reload` (admin/oms)

Enable flags: `MCP_ENABLE_DHAN`, `MCP_ENABLE_ZERODHA`, … and `PAPER_TRADING_ENABLED`.
