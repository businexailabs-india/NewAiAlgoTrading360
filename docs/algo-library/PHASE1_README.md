# Phase 1 — Algo Library + Paper Trading MVP

## Quick start

```bash
# Install libs (editable)
pip install -e libs/schemas -e libs/algo-templates -e libs/risk-rules \
  -e libs/market-simulator -e libs/paper-broker -e libs/performance-metrics \
  -e libs/strategy-engine -e libs/algo-platform-store

# Run tests
pytest tests/unit tests/integration tests/simulation -q

# Docker
docker compose -f docker-compose.algo-mvp.yml up --build
```

## Extension points

- Replace `MockMarketDataFeed` with Dhan MCP / live market-data providers  
- Wire `PaperBroker` to OMS only after RMS + user approval  
- Keep `live_trading_enabled=False` until dedicated live-trading phase  
