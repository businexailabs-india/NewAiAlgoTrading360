-- BusineX AI TradeX: six-bot algorithmic trading platform - persistence schema (PostgreSQL).
-- Idempotent and additive: everything lives in the dedicated "algo" schema so it cannot collide with the
-- existing public tables (e.g. public.risk_events, public.paper_accounts). References public.tenants/users only.
-- Mirrors libs/tradex-bots store.py (SQLite dev/test schema). NOTE: the Python runtime currently executes against
-- SQLite; a PostgreSQL repository adapter is NOT yet implemented (see docs/algo-bots/KNOWN_LIMITATIONS.md).
-- Apply: npx prisma migrate deploy   (validated in CI-less local run against postgres:16 - see docs/algo-bots/TESTING.md)

CREATE SCHEMA IF NOT EXISTS algo;

-- ============================================================================================ identity / accounts
CREATE TABLE IF NOT EXISTS algo.trading_accounts (
  tenant_id        TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  account_id       TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('PAPER','LIVE')),
  display_name     TEXT,
  broker_account_id UUID,
  bot_id           TEXT,                       -- set for per-bot independent paper ledgers
  starting_balance NUMERIC(18,4),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id)
);

CREATE TABLE IF NOT EXISTS algo.broker_accounts (
  broker_account_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id             TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  broker              TEXT NOT NULL DEFAULT 'DHAN',
  client_id_masked    TEXT NOT NULL,           -- e.g. ******2345; the full id/token are NEVER stored here
  credential_ref      TEXT,                    -- reference into the secret manager / encrypted store
  token_expires_at    TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'DISCONNECTED',
  static_ip_status    TEXT NOT NULL DEFAULT 'UNVERIFIED',
  permissions_verified_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_algo_broker_accounts_tenant ON algo.broker_accounts(tenant_id);

-- ============================================================================================ bots
CREATE TABLE IF NOT EXISTS algo.bots (
  tenant_id       TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  bot_id          TEXT NOT NULL,
  name            TEXT,
  strategy_type   TEXT,
  status          TEXT NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED','RUNNING','PAUSED','ERROR')),
  execution_mode  TEXT NOT NULL DEFAULT 'PAPER' CHECK (execution_mode IN ('PAPER','LIVE')),
  live_enabled    BOOLEAN NOT NULL DEFAULT false,
  version         TEXT,
  config_json     JSONB,
  config_hash     TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT,
  row_version     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, account_id, bot_id),
  FOREIGN KEY (tenant_id, account_id) REFERENCES algo.trading_accounts(tenant_id, account_id) ON DELETE RESTRICT,
  CHECK (NOT live_enabled OR execution_mode = 'LIVE')
);
-- DB-enforced invariant: at most ONE live-enabled bot per account.
CREATE UNIQUE INDEX IF NOT EXISTS ux_algo_one_live_bot ON algo.bots(tenant_id, account_id) WHERE live_enabled;

CREATE TABLE IF NOT EXISTS algo.bot_config_versions (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  bot_id       TEXT NOT NULL,
  version      TEXT NOT NULL,
  config_hash  TEXT NOT NULL,
  config_json  JSONB NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_id, bot_id, config_hash),
  FOREIGN KEY (tenant_id, account_id, bot_id) REFERENCES algo.bots(tenant_id, account_id, bot_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS algo.fee_schedules (
  version         TEXT PRIMARY KEY,
  effective_from  DATE NOT NULL,
  schedule_json   JSONB NOT NULL,
  verified_note   TEXT,                       -- who verified the rates against broker publications, and when
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================================ signals
CREATE TABLE IF NOT EXISTS algo.bot_signals (
  id               BIGSERIAL PRIMARY KEY,
  ts               TIMESTAMPTZ NOT NULL,
  tenant_id        TEXT NOT NULL,
  account_id       TEXT NOT NULL,
  mode             TEXT NOT NULL CHECK (mode IN ('BACKTEST','PAPER','LIVE')),
  bot_id           TEXT NOT NULL,
  strategy_version TEXT,
  config_hash      TEXT,
  symbol           TEXT NOT NULL,
  candle_start     TIMESTAMPTZ NOT NULL,
  signal           BOOLEAN NOT NULL,
  status           TEXT NOT NULL DEFAULT 'GENERATED',
  reject_reasons   JSONB,
  checks           JSONB,
  values_json      JSONB,
  UNIQUE (tenant_id, account_id, mode, bot_id, symbol, candle_start),
  FOREIGN KEY (tenant_id, account_id) REFERENCES algo.trading_accounts(tenant_id, account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_algo_signals_ts ON algo.bot_signals(tenant_id, account_id, ts DESC);

-- ============================================================================================ orders / fills
CREATE TABLE IF NOT EXISTS algo.order_intents (
  intent_id        UUID PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  account_id       TEXT NOT NULL,
  mode             TEXT NOT NULL CHECK (mode IN ('PAPER','LIVE')),
  bot_id           TEXT,
  strategy_version TEXT,
  config_hash      TEXT,
  symbol           TEXT NOT NULL,
  security_id      TEXT,
  side             TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  role             TEXT NOT NULL CHECK (role IN ('ENTRY','STOP','EXIT')),
  parent_intent_id UUID REFERENCES algo.order_intents(intent_id) ON DELETE RESTRICT,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  order_type       TEXT NOT NULL CHECK (order_type IN ('MARKET','LIMIT','STOP_LOSS','STOP_LOSS_MARKET')),
  price            NUMERIC(18,4),
  trigger_price    NUMERIC(18,4),
  ref_price        NUMERIC(18,4),
  ref_bid          NUMERIC(18,4),
  ref_ask          NUMERIC(18,4),
  correlation_id   TEXT NOT NULL UNIQUE CHECK (char_length(correlation_id) <= 30),
  dedupe_key       TEXT NOT NULL UNIQUE,
  state            TEXT NOT NULL CHECK (state IN ('CREATED','RISK_APPROVED','SUBMITTING','ACKNOWLEDGED',
                     'PARTIALLY_FILLED','FILLED','PROTECTED','EXIT_PENDING','CLOSED','CANCELLED','REJECTED','UNKNOWN')),
  filled_qty       INTEGER NOT NULL DEFAULT 0 CHECK (filled_qty >= 0),
  avg_price        NUMERIC(18,6),
  broker_order_id  TEXT,
  signal_id        TEXT,
  planned          JSONB,
  created_at       TIMESTAMPTZ NOT NULL,
  submitted_at     TIMESTAMPTZ,
  acked_at         TIMESTAMPTZ,
  first_fill_at    TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL,
  row_version      INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id, account_id) REFERENCES algo.trading_accounts(tenant_id, account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_algo_intents_state ON algo.order_intents(tenant_id, account_id, mode, state);
CREATE INDEX IF NOT EXISTS ix_algo_intents_parent ON algo.order_intents(parent_intent_id);

CREATE TABLE IF NOT EXISTS algo.order_events (
  id          BIGSERIAL PRIMARY KEY,
  intent_id   UUID NOT NULL REFERENCES algo.order_intents(intent_id) ON DELETE RESTRICT,
  event_key   TEXT NOT NULL UNIQUE,
  from_state  TEXT,
  to_state    TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL,
  payload     JSONB
);

CREATE TABLE IF NOT EXISTS algo.broker_orders (
  broker_order_id TEXT NOT NULL,
  intent_id       UUID REFERENCES algo.order_intents(intent_id) ON DELETE RESTRICT,
  tenant_id       TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  correlation_id  TEXT,
  status          TEXT,
  filled_qty      INTEGER,
  avg_price       NUMERIC(18,6),
  raw             JSONB,
  updated_at      TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, account_id, broker_order_id)
);

CREATE TABLE IF NOT EXISTS algo.trade_fills (
  fill_key        TEXT PRIMARY KEY,           -- tenant:account:mode:broker_trade_id (idempotent ingestion)
  intent_id       UUID NOT NULL REFERENCES algo.order_intents(intent_id) ON DELETE RESTRICT,
  tenant_id       TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  mode            TEXT NOT NULL,
  bot_id          TEXT,
  broker_order_id TEXT,
  symbol          TEXT,
  side            TEXT CHECK (side IN ('BUY','SELL')),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  price           NUMERIC(18,6) NOT NULL CHECK (price > 0),
  ts              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_algo_fills_intent ON algo.trade_fills(intent_id);

-- ============================================================================================ positions / costs
CREATE TABLE IF NOT EXISTS algo.trading_positions (
  position_id          TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  account_id           TEXT NOT NULL,
  mode                 TEXT NOT NULL CHECK (mode IN ('PAPER','LIVE')),
  bot_id               TEXT,
  strategy_version     TEXT,
  config_hash          TEXT,
  symbol               TEXT NOT NULL,
  security_id          TEXT,
  quantity             INTEGER NOT NULL CHECK (quantity > 0),     -- long-only: never negative (no shorting)
  avg_price            NUMERIC(18,6) NOT NULL,
  entry_ref_price      NUMERIC(18,6),
  stop_price           NUMERIC(18,4),
  target_price         NUMERIC(18,4),
  stop_distance        NUMERIC(18,4),
  planned_risk         NUMERIC(18,4),
  protection_status    TEXT NOT NULL CHECK (protection_status IN ('UNPROTECTED','PROTECTED','LOST')),
  protective_intent_id UUID REFERENCES algo.order_intents(intent_id) ON DELETE RESTRICT,
  entry_intent_id      UUID REFERENCES algo.order_intents(intent_id) ON DELETE RESTRICT,
  state                TEXT NOT NULL CHECK (state IN ('OPEN','CLOSED')),
  opened_at            TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  exit_reason          TEXT,
  exit_avg_price       NUMERIC(18,6),
  exit_ref_price       NUMERIC(18,6),
  gross_pnl            NUMERIC(18,4),
  slippage_cost        NUMERIC(18,4),
  charges              NUMERIC(18,4),
  net_pnl              NUMERIC(18,4),
  r_multiple           NUMERIC(12,4),
  last_price           NUMERIC(18,4),
  unrealized_pnl       NUMERIC(18,4),
  fee_version          TEXT,
  row_version          INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id, account_id) REFERENCES algo.trading_accounts(tenant_id, account_id) ON DELETE RESTRICT,
  CHECK (state <> 'CLOSED' OR (closed_at IS NOT NULL AND net_pnl IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_algo_positions_acct ON algo.trading_positions(tenant_id, account_id, mode, state);
CREATE INDEX IF NOT EXISTS ix_algo_positions_bot ON algo.trading_positions(tenant_id, bot_id, mode, closed_at);

CREATE TABLE IF NOT EXISTS algo.position_events (
  id           BIGSERIAL PRIMARY KEY,
  position_id  TEXT NOT NULL REFERENCES algo.trading_positions(position_id) ON DELETE RESTRICT,
  ts           TIMESTAMPTZ NOT NULL,
  kind         TEXT NOT NULL,
  details      JSONB
);

CREATE TABLE IF NOT EXISTS algo.trading_costs (
  position_id         TEXT PRIMARY KEY REFERENCES algo.trading_positions(position_id) ON DELETE RESTRICT,
  tenant_id           TEXT NOT NULL,
  account_id          TEXT NOT NULL,
  mode                TEXT,
  bot_id              TEXT,
  fee_version         TEXT,
  brokerage           NUMERIC(18,4), stt NUMERIC(18,4), exchange_txn NUMERIC(18,4), sebi NUMERIC(18,4),
  stamp               NUMERIC(18,4), gst NUMERIC(18,4), ipft NUMERIC(18,4), other NUMERIC(18,4),
  total               NUMERIC(18,4),
  contract_note_total NUMERIC(18,4),
  reconciled          BOOLEAN
);

-- ============================================================================================ risk
CREATE TABLE IF NOT EXISTS algo.control_flags (
  tenant_id  TEXT NOT NULL,
  account_id TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT,
  reason     TEXT,
  PRIMARY KEY (tenant_id, account_id, key)
);

CREATE TABLE IF NOT EXISTS algo.risk_events (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT,
  account_id  TEXT,
  mode        TEXT,
  bot_id      TEXT,
  kind        TEXT NOT NULL,
  severity    TEXT NOT NULL,
  details     JSONB
);
CREATE INDEX IF NOT EXISTS ix_algo_risk_events_ts ON algo.risk_events(tenant_id, ts DESC);

CREATE TABLE IF NOT EXISTS algo.capital_reservations (
  reservation_id UUID PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  account_id     TEXT NOT NULL,
  mode           TEXT NOT NULL,
  bot_id         TEXT NOT NULL,
  symbol         TEXT NOT NULL,
  amount         NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  status         TEXT NOT NULL CHECK (status IN ('ACTIVE','RELEASED','CONSUMED')),
  intent_id      UUID,
  created_at     TIMESTAMPTZ NOT NULL,
  released_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_algo_resv_active ON algo.capital_reservations(tenant_id, account_id, mode, status);

CREATE TABLE IF NOT EXISTS algo.daily_account_pnl (
  tenant_id    TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  mode         TEXT NOT NULL,
  trade_date   DATE NOT NULL,
  entries      INTEGER NOT NULL DEFAULT 0,
  realized_net NUMERIC(18,4) NOT NULL DEFAULT 0,
  gross        NUMERIC(18,4) NOT NULL DEFAULT 0,
  charges      NUMERIC(18,4) NOT NULL DEFAULT 0,
  locked       BOOLEAN NOT NULL DEFAULT false,
  lock_reason  TEXT,
  PRIMARY KEY (tenant_id, account_id, mode, trade_date)
);

CREATE TABLE IF NOT EXISTS algo.portfolio_snapshots (
  id             BIGSERIAL PRIMARY KEY,
  ts             TIMESTAMPTZ NOT NULL,
  tenant_id      TEXT NOT NULL,
  account_id     TEXT,
  mode           TEXT,
  cash           NUMERIC(18,4),
  exposure       NUMERIC(18,4),
  realized_net   NUMERIC(18,4),
  unrealized     NUMERIC(18,4),
  open_positions INTEGER
);

CREATE TABLE IF NOT EXISTS algo.live_approvals (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  bot_id       TEXT,
  operator     TEXT NOT NULL,
  approved_at  TIMESTAMPTZ NOT NULL,
  valid_until  TIMESTAMPTZ NOT NULL,
  scope        JSONB,
  revoked      BOOLEAN NOT NULL DEFAULT false
);

-- Trading-specific RBAC. Resolved by the algo service on EVERY request; the gateway-supplied role is only a
-- coarse hint (owner/admin => platform_admin). No row => viewer (least privilege).
CREATE TABLE IF NOT EXISTS algo.role_assignments (
  tenant_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('platform_admin','trading_admin','trader','risk_manager','viewer')),
  granted_by   TEXT NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, user_id)
);

-- ============================================================================================ paper trading
CREATE TABLE IF NOT EXISTS algo.paper_accounts (
  tenant_id        TEXT NOT NULL,
  account_id       TEXT NOT NULL,
  bot_id           TEXT NOT NULL,
  starting_balance NUMERIC(18,4) NOT NULL,
  cash             NUMERIC(18,4) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, account_id, bot_id)
);

-- ============================================================================================ backtests
CREATE TABLE IF NOT EXISTS algo.backtest_runs (
  run_id            UUID PRIMARY KEY,
  tenant_id         TEXT,
  account_id        TEXT,
  bot_id            TEXT NOT NULL,
  strategy_version  TEXT,
  config_hash       TEXT,
  params_json       JSONB,
  symbols           JSONB,
  date_from         DATE,
  date_to           DATE,
  slippage_scenario TEXT,
  fee_version       TEXT,
  vwap_method       TEXT,
  kind              TEXT,                      -- FULL | WALK_FORWARD | OOS | HOLDOUT
  created_at        TIMESTAMPTZ NOT NULL,
  metrics_json      JSONB,
  data_quality      JSONB
);
CREATE TABLE IF NOT EXISTS algo.backtest_trades (
  id            BIGSERIAL PRIMARY KEY,
  run_id        UUID NOT NULL REFERENCES algo.backtest_runs(run_id) ON DELETE CASCADE,
  symbol        TEXT,
  entry_ts      TIMESTAMPTZ,
  exit_ts       TIMESTAMPTZ,
  quantity      INTEGER,
  entry_price   NUMERIC(18,6),
  exit_price    NUMERIC(18,6),
  gross_pnl     NUMERIC(18,4),
  slippage_cost NUMERIC(18,4),
  charges       NUMERIC(18,4),
  net_pnl       NUMERIC(18,4),
  r_multiple    NUMERIC(12,4),
  exit_reason   TEXT,
  segment       TEXT                           -- TRAIN | VALIDATION | TEST | HOLDOUT
);
CREATE INDEX IF NOT EXISTS ix_algo_bt_trades_run ON algo.backtest_trades(run_id);

-- ============================================================================================ market data (shared, non-tenant)
CREATE TABLE IF NOT EXISTS algo.instruments (
  symbol           TEXT NOT NULL,
  exchange_segment TEXT NOT NULL DEFAULT 'NSE_EQ',
  security_id      TEXT NOT NULL,
  tick_size        NUMERIC(10,4) NOT NULL DEFAULT 0.05,
  lot_size         INTEGER NOT NULL DEFAULT 1,
  series           TEXT NOT NULL DEFAULT 'EQ',
  isin             TEXT,
  asm_gsm_flag     TEXT NOT NULL DEFAULT 'N',
  buy_sell_allowed BOOLEAN NOT NULL DEFAULT true,
  master_as_of     DATE,
  PRIMARY KEY (exchange_segment, symbol)
);

CREATE TABLE IF NOT EXISTS algo.market_candles (
  symbol           TEXT NOT NULL,
  interval_minutes SMALLINT NOT NULL DEFAULT 5,
  start_ts         TIMESTAMPTZ NOT NULL,
  open             NUMERIC(18,4) NOT NULL,
  high             NUMERIC(18,4) NOT NULL,
  low              NUMERIC(18,4) NOT NULL,
  close            NUMERIC(18,4) NOT NULL,
  volume           NUMERIC(20,2) NOT NULL,
  turnover         NUMERIC(24,4),               -- NULL when the source provides no traded value
  source           TEXT NOT NULL,               -- DHAN_HISTORICAL | DHAN_LIVE_AGG | IMPORT
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, interval_minutes, start_ts, source),
  CHECK (high >= low AND high >= open AND high >= close AND low <= open AND low <= close AND volume >= 0)
);

CREATE TABLE IF NOT EXISTS algo.indicator_snapshots (
  symbol       TEXT NOT NULL,
  start_ts     TIMESTAMPTZ NOT NULL,
  bot_id       TEXT NOT NULL,
  config_hash  TEXT NOT NULL,
  values_json  JSONB NOT NULL,
  PRIMARY KEY (symbol, start_ts, bot_id, config_hash)
);

-- TimescaleDB is optional: convert to hypertables only if the extension is already available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS timescaledb;
      PERFORM create_hypertable('algo.market_candles', 'start_ts', if_not_exists => TRUE, migrate_data => TRUE);
      PERFORM create_hypertable('algo.indicator_snapshots', 'start_ts', if_not_exists => TRUE, migrate_data => TRUE);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'TimescaleDB hypertable setup skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'timescaledb not available: algo.market_candles remains a plain table';
  END IF;
END $$;

-- ============================================================================================ analytics / reports / ops
CREATE TABLE IF NOT EXISTS algo.analytics_daily_summary (
  tenant_id    TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  mode         TEXT NOT NULL,
  bot_id       TEXT NOT NULL,
  trade_date   DATE NOT NULL,
  trades       INTEGER,
  wins         INTEGER,
  gross        NUMERIC(18,4),
  charges      NUMERIC(18,4),
  net          NUMERIC(18,4),
  refreshed_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, account_id, mode, bot_id, trade_date)
);

CREATE TABLE IF NOT EXISTS algo.generated_reports (
  report_id    UUID PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  account_id   TEXT,
  kind         TEXT NOT NULL,
  fmt          TEXT NOT NULL CHECK (fmt IN ('csv','xlsx','pdf')),
  mode         TEXT,
  date_from    TEXT,
  date_to      TEXT,
  generated_at TIMESTAMPTZ NOT NULL,
  data_as_of   TEXT NOT NULL,
  generated_by TEXT,
  path         TEXT,                           -- object-storage key in production
  row_count    INTEGER,
  sha256       TEXT
);

CREATE TABLE IF NOT EXISTS algo.integration_errors (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT,
  account_id  TEXT,
  source      TEXT NOT NULL,
  payload     JSONB,
  error       TEXT,
  attempts    INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS algo.system_health_events (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL,
  tenant_id  TEXT,
  account_id TEXT,
  component  TEXT NOT NULL,
  status     TEXT NOT NULL,
  details    JSONB
);

CREATE TABLE IF NOT EXISTS algo.data_quality_issues (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT NOT NULL,
  account_id  TEXT,
  mode        TEXT,
  check_name  TEXT NOT NULL,
  severity    TEXT NOT NULL,
  ref         TEXT,
  details     JSONB,
  status      TEXT NOT NULL DEFAULT 'OPEN',
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  UNIQUE (tenant_id, check_name, ref, status)
);

CREATE TABLE IF NOT EXISTS algo.reconciliation_discrepancies (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT NOT NULL,
  account_id  TEXT,
  mode        TEXT,
  kind        TEXT NOT NULL,
  ref         TEXT,
  expected    TEXT,
  actual      TEXT,
  status      TEXT NOT NULL DEFAULT 'OPEN',
  details     JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

-- ============================================================================================ audit (append-only, hash chained)
CREATE TABLE IF NOT EXISTS algo.audit_events (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL,
  tenant_id  TEXT,                              -- NULL = platform/system event
  account_id TEXT,
  mode       TEXT,
  bot_id     TEXT,
  actor      TEXT,
  action     TEXT NOT NULL,
  details    JSONB,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_algo_audit_tenant_ts ON algo.audit_events(tenant_id, ts DESC);

-- Immutability: audit trail, order state history and fills can never be updated, deleted or truncated.
CREATE OR REPLACE FUNCTION algo.forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on algo.% is not allowed (append-only)', TG_OP, TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_events','order_events','trade_fills'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON algo.%I', t || '_immutable_row', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON algo.%I FOR EACH ROW EXECUTE FUNCTION algo.forbid_mutation()',
                   t || '_immutable_row', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON algo.%I', t || '_immutable_trunc', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON algo.%I FOR EACH STATEMENT EXECUTE FUNCTION algo.forbid_mutation()',
                   t || '_immutable_trunc', t);
  END LOOP;
END $$;

-- ============================================================================================ tenant isolation (RLS)
-- Application sessions MUST run `SET LOCAL app.tenant_id = '<tenant>'` per transaction and connect as a role that is
-- NOT the table owner / superuser (FORCE makes owners subject to the policy too). Missing setting => no rows.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'algo' AND c.column_name = 'tenant_id' AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE algo.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE algo.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON algo.%I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON algo.%I
                      USING (tenant_id = current_setting('app.tenant_id', true))
                      WITH CHECK (tenant_id = current_setting('app.tenant_id', true))$p$, t);
  END LOOP;
END $$;

-- backtest_trades has no tenant_id: isolate through its parent run.
ALTER TABLE algo.backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo.backtest_trades FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON algo.backtest_trades;
CREATE POLICY tenant_isolation ON algo.backtest_trades
  USING (EXISTS (SELECT 1 FROM algo.backtest_runs r WHERE r.run_id = backtest_trades.run_id
                 AND r.tenant_id = current_setting('app.tenant_id', true)));
ALTER TABLE algo.position_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo.position_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON algo.position_events;
CREATE POLICY tenant_isolation ON algo.position_events
  USING (EXISTS (SELECT 1 FROM algo.trading_positions p WHERE p.position_id = position_events.position_id
                 AND p.tenant_id = current_setting('app.tenant_id', true)));
ALTER TABLE algo.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo.order_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON algo.order_events;
CREATE POLICY tenant_isolation ON algo.order_events
  USING (EXISTS (SELECT 1 FROM algo.order_intents i WHERE i.intent_id = order_events.intent_id
                 AND i.tenant_id = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM algo.order_intents i WHERE i.intent_id = order_events.intent_id
                 AND i.tenant_id = current_setting('app.tenant_id', true)));

-- ============================================================================================ application role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'algo_app') THEN
    BEGIN
      CREATE ROLE algo_app NOLOGIN;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not create role algo_app (insufficient privilege): create it manually and GRANT as below';
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'algo_app') THEN
    GRANT USAGE ON SCHEMA algo TO algo_app;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA algo TO algo_app;
    REVOKE UPDATE ON algo.audit_events, algo.order_events, algo.trade_fills FROM algo_app;
    GRANT SELECT ON public.tenants TO algo_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA algo TO algo_app;
    -- deliberately NO DELETE / TRUNCATE on any algo table: retention is run by a separate privileged job.
  END IF;
END $$;
