# MCP Provider Admin Console (Frontend)

Dynamic Admin Console for the Indian MCP Provider Configuration Framework.

## Location

- Module: `apps/web-admin/src/modules/mcp-providers`
- Components: `apps/web-admin/src/components/mcp` (re-exported from `src/components/mcp`)
- API client: `src/api/mcpProviders.ts`
- Hooks: `src/hooks/mcp`
- Entry: Admin Console → **MCP Providers** tab

Logical routes (in-SPA nav store):

| Path | Page |
|------|------|
| `/admin/mcp/providers` | Marketplace |
| `/admin/mcp/providers/[id]` | Detail |
| `/admin/mcp/providers/[id]/connect` | Connect wizard |
| `/admin/mcp/connections` | Connections |
| `/admin/mcp/connections/[id]/snapshot` | Snapshot |
| `/admin/mcp/health` | Health |
| `/admin/mcp/capabilities` | Capability matrix |
| `/admin/mcp/market-data` | Market data setup |
| `/admin/mcp/live-trading-controls` | Live trading controls |
| `/admin/mcp/audit` | Audit logs |

## Backend proxy

Browser → Node BFF (`/api/mcp/*`, `/api/admin/mcp/*`) → mcp-connector-service (`:8094`).

HMAC (`SERVICE_HMAC_SECRET`) is signed only on the server.

Local admin API bypass: `LOCAL_MCP_ADMIN_BYPASS=true` or `LOCAL_AUTH_BYPASS=true`.

Frontend permission open (local): `VITE_MCP_ADMIN_ALLOW_ALL=true` (default in Vite define).

## Health WebSocket

Socket.IO room/channel: `mcp.connection.health.changed`  
Node polls `/admin/mcp/provider-health` and broadcasts. UI also polls REST.

## Security

- No raw API keys / tokens in UI after submit (masked only)
- Live trading locked banner on all critical surfaces
- Live order execution permission switch forced off
- Audit export uses redacted backend rows
