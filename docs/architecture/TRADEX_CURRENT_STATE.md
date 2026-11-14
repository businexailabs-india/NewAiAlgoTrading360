# TradeX — Current State (as inspected 2026-11-14)

Evidence level: **I = inspected directly (file/command output seen)**, **U = not inspected / not verified**.
Nothing here has been load-tested. Nothing has been tested against a real DhanHQ or IBKR account.

## 1. Repository / Git (I)

| Item | Finding |
|---|---|
| Branch | `main` (only branch; `origin/main` is the only remote branch) |
| Remote | `origin` = `https://github.com/businexailabs-india/NewAiAlgoTrading360.git` (read access confirmed with `git ls-remote`; **push access not verified**) |
| HEAD | `b73b8ae Initial commit - NewAiAlgoTrading360 AI Trading Platform` |
| Git identity | **`user.name` / `user.email` are not configured** (neither local nor global) — commits cannot be created until the operator supplies an identity |
| CI/CD | **No `.github/` directory** — no pipelines exist |
| Uncommitted work | ~52 untracked source files from the six-bot work (`libs/tradex-bots`, `services/algo-bots-service`, one Prisma migration) plus `__pycache__/*.pyc` (not ignored — `.gitignore` has no `__pycache__` rule) |
| Missing directory | `libs/tradex-vwap-ema` was listed as untracked at the start of this session and **no longer exists on disk**. It was never committed, so it cannot be restored from Git. Its role (single-bot v1) is superseded by `libs/tradex-bots`, but the removal was not made by this audit; the operator should confirm it was intentional. |

## 2. Applications and services (I, by directory listing)

* Frontend: React/Vite app in `src/` (`Dockerfile.frontend`, nginx conf in `infra/docker`).
* Backend: Node/Express/TypeScript in `backend/` with Prisma (92 models) on PostgreSQL.
* Python services (`services/`): ai-advisory, alert-to-algo, algo-library, basket-order, dhanhq-sidecar, dhanlaxmi-assistant, execution-governance, external-algo-discovery, language-intent, market-data, mcp-connector, multi-account-allocation, oms-execution, order-entry, paper-test-orchestrator, paper-trading, portfolio, report-service, risk-service, strategy-service, strategy-signal-gateway, trade-approval, tradingview-connect, voice-gateway, webhook-security.
  **Whether each is functional was not verified.**
* Python libs (`libs/`): advisory-core (HMAC `ServiceAuth`, Kafka IO, telemetry), live-risk-gate, paper-broker, risk-rules, market-simulator, etc. (U beyond names).
* New this engagement: `libs/tradex-bots` (six bots, risk, OMS, paper, backtest, analytics, reports, jobs; SQLite runtime store) and a partial `services/algo-bots-service` (HMAC verify + RBAC matrix written; **no HTTP routes yet, no tests**).

## 3. Six bots (I — own code)

`libs/tradex-bots/src/tradex_bots/bots/bot01..06.py`, registered in `BOT_REGISTRY`. 123 library tests pass (`python -m pytest tests -q`, last full run 123 passed / 110 s). Evidence for correctness is synthetic-data and invariant tests only; no real market data, no profitability claim.

## 4. Brokers

* DhanHQ: `libs/tradex-bots/src/tradex_bots/dhan.py` + `dhan_feed.py` (mock-transport tests only; **not verified against a Dhan sandbox or account**). Separately `services/dhanhq-sidecar` and `backend` MCP/Dhan code exist (U).
* **IBKR: removed on purpose** — commit `25a5f8b "Remove US/IBKR trading and deepen India F&O paper desk."`. `backend/src/market-analytics/brokers/registry.ts` now always returns the simulated adapter. Only an MCP provider stub remains (`services/mcp-connector-service/providers/ibkr_provider.py`, U).

## 5. Data / messaging / infrastructure

| Area | Finding |
|---|---|
| PostgreSQL | Prisma migrations through `20261114100000_algo_trading_bots` (mine, **unapplied to any real DB**; verified only on a throwaway `postgres:16-alpine` container: 33 tables, RLS, immutability triggers) |
| Redis | in `docker-compose.yml` and `docker-compose.algo-mvp.yml`; actual usage in code U |
| Kafka-compatible | Redpanda in `docker-compose.advisory.yml`; transactional outbox in `backend/src/events/outbox.service.ts`; `advisory_core.kafka_io` (U runtime) |
| ClickHouse | **absent** |
| Kubernetes / Helm / Kustomize | **absent** (docker-compose only) |
| Observability | `advisory_core.telemetry` and dhanlaxmi `telemetry.py` exist (OpenTelemetry-style, U); no Prometheus/Grafana config found |
| Load testing | no k6/Locust/Gatling assets found |

## 6. Identity and security

* Backend has `auth.middleware.ts`, `auth.service.ts`, JWT/helmet/rate-limit dependencies (I by grep).
* `User`, `Tenant`, `TenantMembership`, `AuditLog` models exist; `TenantMembership.role` is `owner|admin|member|viewer`.
* **No OIDC, TOTP/MFA, session table, or token revocation found** in `backend/src`.
* The auth middleware has a **development bypass** that yields a synthetic ADMIN when `NODE_ENV` is not `production`. Must be disabled/guarded before any live-affecting route is exposed.
* Gateway→service HMAC (`tenant:user:role:request_id:ts`) signs identity only — not method, path or body.
* `backend/src/services/advisory-gateway.service.ts` falls back to `dev-service-hmac-secret-change-me` if `SERVICE_HMAC_SECRET` is unset.

## 7. Tests (I)

* Python: `libs/tradex-bots/tests` (123 tests, passing). Repo-level `tests/` (unit, integration, phase2–4, simulation) — **not run in this audit**.
* Frontend/e2e: `e2e/market-analytics.spec.ts` — not run.
