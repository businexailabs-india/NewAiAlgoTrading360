# TradeX — Target Architecture (DESIGN ONLY — nothing below is implemented unless the gap analysis says so)

The 1M-registered / 100k-concurrent / 6M-subscription figures are **planning targets**. No capacity is claimed.

## 0. Sizing reality check (arithmetic, not measurement)

* Registered users ≠ concurrent users ≠ trading accounts. Only accounts with a live/paper-running bot generate order flow.
* Six strategies on 5-minute candles: signal computation is **per instrument × strategy variant**, not per user.
  With ~500 NSE symbols × 6 bots there are ~3,000 evaluations per 5-minute boundary (~10/s average, bursty at the boundary). This is small; the cost is **fan-out**, not computation.
* Fan-out: a signal must be evaluated against each subscribed account's risk policy. 6 M subscriptions × signal rate is the number that drives Kafka/DB sizing. It must be modelled with an explicit "active-account %" and "signal hit-rate" before any infrastructure sizing is claimed.
* The binding ceilings are external: DhanHQ per-account/API rate limits, one SEBI-compliant static IP per account, and exchange-data licensing (a broker feed licensed to one account must not be redistributed to other users). Platform-side scaling does not raise these.

## 1. Principles

1. PostgreSQL is the **only** source of truth for orders, fills, positions, capital reservations, risk state, audit.
2. Kafka (or Redpanda) carries events; it is never the authority and never assumed exactly-once toward a broker.
3. Redis is cache/rate-limit/coordination only; losing it must not lose financial state or weaken a risk check.
4. ClickHouse is read-only analytics fed by CDC/outbox; never consulted for pre-trade risk.
5. One execution owner per trading account (fenced). Fail closed on uncertainty.
6. Live trading off by default, one live bot per account, explicit trading-admin approval, no automatic paper→live.

## 2. Logical components

```
Browser ─TLS─ CDN/WAF ─ api-gateway (Express) ─ HMAC ─┬─ user/identity
                                                       ├─ algo-bots-service (REST, RBAC)
 websocket-gateway ◄── snapshots/deltas ◄─ Redis pub/sub└─ reporting workers
Broker feed → feed-adapter → normalise → [market.ticks] → candle-aggregator → [market.candles]
 → indicator/strategy workers (shared per symbol+config hash) → [strategy.signals]
 → per-account risk+OMS executors (partition key = trading_account_id, fenced lease)
 → broker-adapter (Dhan; IBKR only if decided, see §6) → [order.events/trade.fills]
 → Postgres (authoritative) ─outbox→ Kafka ─→ ClickHouse (analytics)
```

## 3. Key mechanisms (what must be built)

| Concern | Design |
|---|---|
| Signal dedupe across workers | deterministic `signal_id = hash(bot_id, version, config_hash, symbol, candle_start)`; `UNIQUE` in Postgres; consumers idempotent |
| Shared indicators | cache keyed by `(symbol, candle_start, base_feature_args)`; compatible variants share, incompatible do not (already implemented in-process in `bots/base.py`) |
| Per-account serialisation | Kafka partition by `trading_account_id` **plus** DB advisory lock / row lock on the account's risk row; capital reservation is a single transaction |
| Execution ownership | lease row `(account_id, owner, fencing_token, expires_at)`; every broker call and DB write carries the token; stale token ⇒ reject |
| Uncertain order | state `UNKNOWN` → query broker by correlation id → reconcile → resume; never blind resubmit (implemented in library OMS; not yet distributed) |
| Stale signals | each signal has `valid_until` (candle close + grace); executor rejects after it |
| Tenancy | `tenant_id` on every row; Postgres RLS (`app.tenant_id`) with a non-owner app role (implemented in the `algo` schema migration; not yet for legacy `public` tables) |
| Dashboards | per-user subscription to aggregates only; coalesced deltas at ≤1–2 Hz; sequence numbers + snapshot on reconnect; slow consumers dropped, never back-pressuring execution |
| Rate limits | token bucket per account and per broker (Redis for speed; Postgres-backed state is not required because over-limit just delays) |

## 4. Data stores

PostgreSQL (primary + sync replica(s), PITR via WAL archiving, PgBouncer) — partition `bot_signals`, `order_events`, `trade_fills`, `market_candles`, `audit_events` by time **after** measuring; start unpartitioned. Redis (cluster/sentinel, `maxmemory` + `allkeys-lru` for caches only, ACL + TLS). ClickHouse introduced only if measured reporting volume justifies it (the library's SQL analytics are adequate far below that).

## 5. Kubernetes (design)

Stateless: frontend, api-gateway, algo-bots-service (read/API), websocket-gateway, reporting workers (HPA/KEDA). Stateful-ownership: per-account executors run as a **leased worker pool** (not blindly scaled replicas). PDBs, anti-affinity, topology spread, startup/readiness/liveness probes, NetworkPolicies, external secrets. Rolling upgrades must drain account leases first.

## 6. Open decisions that block design

1. **IBKR**: the repository deliberately removed IBKR (commit `25a5f8b`). Access to NSE cash equities through IBKR depends on account residency/permissions that must be verified with IBKR and counsel; this document does **not** assume it is available. A capability matrix (Dhan vs IBKR) is a design deliverable once this is decided.
2. Identity provider (OIDC issuer, MFA mechanism) — none exists in the backend today.
3. Target cloud / managed-service choices for Postgres, Kafka, Redis, ClickHouse (drives cost estimates).
4. Regulatory/compliance review (SEBI retail-algo, NSE, broker terms, data licensing, advisory/distribution registration) — **not obtained; technical work is not approval.**
