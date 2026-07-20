# BusineXAi TradeOS360 — Phase 1 Algo MVP

**AlgoLibrary360 · AlgoBuilder360 · PaperTrade Lab · RiskGuard360**

Live trading is **disabled**. All strategies run in **paper mode only**.

## Architecture

```
libs/
  schemas, algo-templates, strategy-engine, risk-rules,
  market-simulator, paper-broker, performance-metrics, algo-platform-store
services/
  algo-library-service   :8099
  strategy-service       :8100
  paper-trading-service  :8101
  market-data-service    :8102
  risk-service           :8103
  portfolio-service      :8104
  report-service         :8105
```

## Run locally

```bash
pip install -e libs/schemas -e libs/algo-templates -e libs/risk-rules \
  -e libs/market-simulator -e libs/paper-broker -e libs/performance-metrics \
  -e libs/strategy-engine -e libs/algo-platform-store \
  -e services/algo-library-service -e services/strategy-service \
  -e services/paper-trading-service -e services/market-data-service \
  -e services/risk-service -e services/portfolio-service -e services/report-service \
  fastapi "uvicorn[standard]" numpy pandas httpx pytest

# one service example
uvicorn app.main:app --app-dir services/strategy-service --port 8100 --reload

# all via Docker
docker compose -f docker-compose.algo-mvp.yml up --build
```

OpenAPI: http://localhost:8100/docs

## Tests

```bash
pytest tests/unit tests/integration tests/simulation -q
```

## Seed

- demo-user  
- demo-paper-account — ₹10,00,000  
- demo-ma-strategy  

## Future

Dhan MCP / live trading integrate behind RMS + OMS + explicit approval. Do not enable `live_trading_enabled` in this phase.
