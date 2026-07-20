# Production Deployment Checklist

## Security

- [ ] `LIVE_TRADING_ENABLED=false` until OMS/RMS certified
- [ ] Rotate `SERVICE_HMAC_SECRET` and `LOCAL_SECRET_KEY`
- [ ] Switch `SECRET_MANAGER_PROVIDER` to Vault/AWS/GCP/Azure
- [ ] Confirm no secrets in logs, LLM prompts, or API responses
- [ ] IP allowlist + 2FA placeholders wired for live trading
- [ ] Kill switch runbook documented

## Config

- [ ] Mount `config/mcp-providers` read-only
- [ ] Enable only contracted brokers (`MCP_ENABLE_*`)
- [ ] Set real `DHAN_BASE_URL` / broker endpoints only after UAT
- [ ] Kafka topics created on Redpanda/MSK

## Runtime

- [ ] `docker compose -f docker-compose.advisory.yml up -d mcp-connector-service`
- [ ] Health: `GET /health` → providers_loaded > 0
- [ ] Prometheus scrape `:9104` metrics
- [ ] Health monitor interval tuned
- [ ] Gateway `MCP_CONNECTOR_SERVICE_URL` points to service

## Compliance

- [ ] Audit trail for connect/test/preview/credential updates
- [ ] Tenant isolation verified
- [ ] Paper-only advisory when broker disconnected
