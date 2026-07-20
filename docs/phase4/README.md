# Phase 4 — Gated Go-Live (Dhan-first)

## Intent
Complete the live trading pipeline while keeping **live OFF by default**. Operators enable flags only after UAT.

## Flow
`User approve → RMS (live-risk-gate) → OMS (oms-execution-service) → MCP execute (oms_service) → Dhan _place_live_order`

## Safe defaults
| Flag | Default |
|------|---------|
| `LIVE_TRADING_ENABLED` | false |
| `DHAN_USE_MOCK` | true |
| `DHAN_ALLOW_LIVE_HTTP` | false |
| `ALLOW_STRATEGY_LIVE` | false |
| Connection `live_trading_enabled` | false |

## Enable for UAT (checklist)
1. Rotate secrets; set Vault/AWS secret manager in prod.
2. Set real Dhan credentials; `DHAN_USE_MOCK=false`, `DHAN_ALLOW_LIVE_HTTP=true`.
3. `LIVE_TRADING_ENABLED=true`, kill switch off.
4. Admin: `PUT /admin/mcp/connections/{id}/live-trading` `{ "enabled": true }`.
5. Approve order with OTP + RMS; OMS submits as `oms_service`.
6. Verify audit trails and kill-switch runbook.

## Key APIs
- `PUT /admin/mcp/connections/{id}/live-trading`
- `POST /oms/execute` · `POST /oms/kill-switch`
- `POST /approvals/{id}/approve` (queues OMS when live env + connection)
- MCP `.../orders/execute-disabled` (OMS role only)

## Not in scope
- Live ON by default in committed env files
- Full Zerodha/Angel live adapters
