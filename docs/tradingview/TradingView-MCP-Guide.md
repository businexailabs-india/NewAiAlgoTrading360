# TradingView MCP Provider

TradingView is registered as an MCP **signal integration** provider (`provider_id: tradingview`).

It is **not** a broker. It manages webhook connections, alert payload templates, symbol mapping, and paper/signal preview. Alerts never place live orders.

## Enable

```bash
MCP_ENABLE_TRADINGVIEW=true
MCP_PROVIDERS_CONFIG_DIR=./config/mcp-providers
```

Config: `config/mcp-providers/tradingview.yaml`  
Adapter: `mcp_connectors.tradingview.TradingViewMCPProvider`

## Capabilities

| Capability | Purpose |
|------------|---------|
| `WEBHOOK_CONNECTIONS` | Create / list / rotate webhook secrets |
| `ALERT_PAYLOADS` | Pine alert JSON templates |
| `SYMBOL_MAPPING` | Map TV tickers → NSE/BSE symbols |
| `SIGNAL_PREVIEW` / `ORDER_PREVIEW` | Validate alerts into paper intents |

`LIVE_ORDER_EXECUTION` is **not** advertised. Live click-trading from TV is blocked.

## HTTP (mcp-connector-service)

| Method | Path |
|--------|------|
| POST | `/mcp/providers/tradingview/connect` |
| GET | `/mcp/providers/tradingview/health` |
| GET | `/mcp/providers/tradingview/connections` |
| POST | `/mcp/providers/tradingview/rotate-secret` |
| GET | `/mcp/providers/tradingview/payload-templates` |
| GET | `/mcp/providers/tradingview/map-symbol?symbol=RELIANCE` |
| POST | `/mcp/providers/tradingview/preview-alert` |
| POST | `/mcp/providers/tradingview/orders/preview` |

Generic registry: `GET /mcp/providers` includes `tradingview` (aliases: `tv`, `trading_view`).

## Safety

1. Paper / signal mode only (`mode` forced away from LIVE).
2. Webhook secrets returned once at connect/rotate; never sent to LLMs.
3. Live path still requires OMS/RMS gates platform-wide; TV provider raises on live place.
4. Existing Express TradingView Connect (`TradingViewConnectService`) remains the UI webhook ingest SoT; this MCP adapter exposes the same semantics to advisory / MCP clients.

## Claude / Bifrost

LLM routing (Bifrost → Claude) is unchanged. DhanLaxmi / advisory may call MCP provider context; TradingView appears as a connected signal provider with redacted secrets — not as an execution broker.
