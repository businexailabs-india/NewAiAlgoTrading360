# TradeX — Million-User Gap Analysis (2026-11-14)

Status values: IMPLEMENTED_TESTED · IMPLEMENTED_UNTESTED · PARTIALLY_IMPLEMENTED · MISSING · BROKEN · BLOCKED · NOT_VERIFIED (exists/unknown, not inspected).
"Tested" means automated tests I executed. No performance/capacity test of any kind has been run.

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Six bots, strategy registry, versioning | IMPLEMENTED_TESTED (functional, synthetic data) | `libs/tradex-bots`, 123 tests pass. No real-data validation; no profitability claim |
| 2 | Shared indicator computation | PARTIALLY_IMPLEMENTED | in-process frame/base-feature memoisation only; not a distributed cache; ~25 ms/bot-eval measured on synthetic data |
| 3 | Deterministic signal ids / dedupe across workers | MISSING | signals use autoincrement ids; no UNIQUE on (bot, version, config, symbol, candle) |
| 4 | Distributed workers / fenced execution ownership | MISSING | library OMS is single-process (SQLite); no lease/fencing token |
| 5 | Per-account risk engine, atomic capital reservation | PARTIALLY_IMPLEMENTED | `risk.py`, `CapitalAllocator` tested in SQLite (serialised by process lock). Not Postgres-backed; concurrency across processes untested |
| 6 | OMS state machine, idempotency, UNKNOWN reconciliation | IMPLEMENTED_TESTED (SQLite, mocks) | 19 OMS tests incl. timeout→UNKNOWN→query; not tested against Postgres or real broker |
| 7 | DhanHQ adapter | IMPLEMENTED_UNTESTED against broker | mock-transport tests only; endpoints unverified vs current Dhan docs/sandbox |
| 8 | IBKR adapter | MISSING / BLOCKED | deliberately removed in `25a5f8b`; NSE-via-IBKR eligibility unverified; needs operator decision |
| 9 | Broker capability matrix, per-broker quotas | MISSING | |
| 10 | Market-data fabric (feed adapter→Kafka→aggregator) | PARTIALLY_IMPLEMENTED | Dhan feed parser/client + candle validation exist (mock tests); no Kafka path, no subscription dedupe, no entitlements model |
| 11 | Kafka event contracts, schema registry, DLQ, replay | PARTIALLY_IMPLEMENTED | backend outbox + topics file + Redpanda compose exist (NOT_VERIFIED); none of the 12 required topics/contracts verified |
| 12 | Multi-tenant identity (users, tenants, memberships) | PARTIALLY_IMPLEMENTED | Prisma `User/Tenant/TenantMembership` exist; roles/permissions tables, `user_sessions`, `strategy_subscriptions`, `user_risk_profiles`, `user_preferences`, `user_audit_events` not found |
| 13 | OIDC/OAuth2, MFA, session revocation | MISSING | none found in `backend/src` |
| 14 | RBAC enforced in backend | PARTIALLY_IMPLEMENTED | matrix + HMAC verify written in `services/algo-bots-service/app/{rbac,security}.py`; routes + 48 API tests now exist (auth, RBAC matrix, tenant isolation, live gate, reports) - run via TestClient + in-memory SQLite only, never over a real network or Postgres; legacy auth has dev bypass (security risk) |
| 15 | Postgres RLS / tenant isolation | PARTIALLY_IMPLEMENTED | `algo` schema: RLS+FORCE, non-owner role, verified on a throwaway PG16 (33 tables). Legacy `public` tables: none. Not applied to any real DB |
| 16 | Partitioning, read replicas, PITR, pooling | MISSING | design only; partitioning deferred until access patterns measured |
| 17 | Backup/restore | PARTIALLY_IMPLEMENTED | AES-256-GCM SQLite backup + verified restore tested; Postgres PITR absent |
| 18 | ClickHouse analytics + CDC | MISSING | SQL analytics from persisted records exist (tested, SQLite). Justification for ClickHouse unmeasured |
| 19 | Redis caching/rate limiting | NOT_VERIFIED | Redis in compose; usage unknown; no cache layer in new library |
| 20 | Kubernetes manifests, HPA/KEDA/PDB/NetworkPolicy | MISSING | docker-compose only |
| 21 | WebSocket/SSE dashboard gateway | MISSING | |
| 22 | Observability (OTel, Prometheus, Grafana, alerts) | PARTIALLY_IMPLEMENTED | `advisory_core.telemetry` exists (NOT_VERIFIED); no dashboards/alerts |
| 23 | Load-test framework + staged runs A–E | MISSING | **no capacity has been measured**; therefore maximum validated capacity = 0 users beyond unit tests |
| 24 | Chaos/failure testing | MISSING | only unit-level failure injection (paper broker timeouts, feed backoff) |
| 25 | CI/CD | MISSING | no `.github/` |
| 26 | Git workflow / push | BLOCKED | no git identity configured; push permission unverified |
| 27 | HA/DR targets, runbooks | MISSING | |
| 28 | Security/compliance (WAF, TLS, scanning, retention) | MISSING / PARTIALLY | audit hash-chain + masking + formula-injection protection implemented and tested in library; no scanning, WAF, TLS config |
| 29 | Regulatory review | BLOCKED | requires counsel/operator; not obtainable by code |

## Highest-risk findings
1. **Nothing has run against Postgres at runtime** (only the migration). The library's runtime store is SQLite; a Postgres repository adapter is the prerequisite for items 4, 5, 16, 18.
2. **Auth dev-bypass** and the hard-coded fallback HMAC secret in the legacy gateway must be removed or fenced before any live-affecting route is exposed.
3. **No distributed execution ownership** — running two replicas today could double-submit.
4. IBKR scope conflicts with an earlier deliberate removal.
