-- Market Analytics additive tables (paper-only product surface)
-- Apply via: npx prisma migrate deploy (or migrate dev)

CREATE TYPE "MaDataSource" AS ENUM ('DEMO', 'SIMULATED', 'BROKER_PAPER', 'TV_BACKTEST');
CREATE TYPE "MaTradingMode" AS ENUM ('signal', 'simulated', 'broker_paper');

CREATE TABLE IF NOT EXISTS "ma_broker_accounts" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "connection_name" TEXT NOT NULL,
  "broker_type" TEXT NOT NULL,
  "paper_account_id" TEXT NOT NULL,
  "base_currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "last_sync_at" TIMESTAMP(3),
  "data_entitlement" TEXT NOT NULL DEFAULT 'unknown',
  "connection_health" TEXT NOT NULL DEFAULT 'unknown',
  "buying_power" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "net_liquidation" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "cash_balance" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "realized_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "unrealized_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "reconcile_ok" BOOLEAN NOT NULL DEFAULT false,
  "encrypted_creds" TEXT,
  "is_demo" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_broker_accounts_tenant_broker_acct_key"
  ON "ma_broker_accounts"("tenant_id", "broker_type", "paper_account_id");

CREATE TABLE IF NOT EXISTS "ma_contracts" (
  "id" TEXT PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "security_type" TEXT NOT NULL DEFAULT 'STK',
  "con_id" TEXT,
  "min_tick" DECIMAL(20,10) NOT NULL DEFAULT 0.01,
  "lot_size" DECIMAL(20,8) NOT NULL DEFAULT 1,
  "multiplier" DECIMAL(20,8) NOT NULL DEFAULT 1,
  "primary_exchange" TEXT,
  "time_zone_id" TEXT NOT NULL DEFAULT 'America/New_York',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_contracts_symbol_ex_ccy_sec_key"
  ON "ma_contracts"("symbol", "exchange", "currency", "security_type");

CREATE TABLE IF NOT EXISTS "ma_market_data_snapshots" (
  "id" TEXT PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "bid" DECIMAL(20,8),
  "ask" DECIMAL(20,8),
  "last" DECIMAL(20,8),
  "volume" DECIMAL(20,4),
  "is_delayed" BOOLEAN NOT NULL DEFAULT false,
  "is_stale" BOOLEAN NOT NULL DEFAULT false,
  "age_seconds" INTEGER NOT NULL DEFAULT 0,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_strategies" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "strategy_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "pine_version" TEXT NOT NULL DEFAULT '6',
  "parameters" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_strategies_tenant_key" ON "ma_strategies"("tenant_id", "strategy_key");

CREATE TABLE IF NOT EXISTS "ma_strategy_versions" (
  "id" TEXT PRIMARY KEY,
  "strategy_id" TEXT NOT NULL REFERENCES "ma_strategies"("id") ON DELETE CASCADE,
  "version" TEXT NOT NULL,
  "parameters" JSONB NOT NULL,
  "change_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_strategy_assignments" (
  "id" TEXT PRIMARY KEY,
  "strategy_id" TEXT NOT NULL REFERENCES "ma_strategies"("id") ON DELETE CASCADE,
  "broker_account_id" TEXT NOT NULL REFERENCES "ma_broker_accounts"("id") ON DELETE CASCADE,
  "symbol" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_strategy_assignments_uniq"
  ON "ma_strategy_assignments"("strategy_id", "broker_account_id", "symbol");

CREATE TABLE IF NOT EXISTS "ma_webhook_endpoints" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "strategy_id" TEXT REFERENCES "ma_strategies"("id") ON DELETE SET NULL,
  "endpoint_token" TEXT NOT NULL UNIQUE,
  "secret_hash" TEXT NOT NULL,
  "secret_hint" TEXT,
  "last_received_at" TIMESTAMP(3),
  "last_accepted_at" TIMESTAMP(3),
  "last_rejected_at" TIMESTAMP(3),
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "duplicate_count" INTEGER NOT NULL DEFAULT 0,
  "expired_count" INTEGER NOT NULL DEFAULT 0,
  "rotated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_tradingview_alerts" (
  "id" TEXT PRIMARY KEY,
  "endpoint_id" TEXT NOT NULL REFERENCES "ma_webhook_endpoints"("id") ON DELETE CASCADE,
  "signal_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "payload_redacted" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "reject_reason" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_tv_alerts_endpoint_signal"
  ON "ma_tradingview_alerts"("endpoint_id", "signal_id");

CREATE TABLE IF NOT EXISTS "ma_normalized_signals" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "strategy_id" TEXT REFERENCES "ma_strategies"("id") ON DELETE SET NULL,
  "alert_id" TEXT UNIQUE REFERENCES "ma_tradingview_alerts"("id") ON DELETE SET NULL,
  "signal_id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "reference_price" DECIMAL(20,8) NOT NULL,
  "entry_price" DECIMAL(20,8),
  "stop_price" DECIMAL(20,8),
  "target_price" DECIMAL(20,8),
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "expected_risk" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "reject_reason" TEXT,
  "indicators" JSONB,
  "bar_time" TIMESTAMP(3),
  "data_age_seconds" INTEGER,
  "broker_account_id" TEXT,
  "order_id" TEXT,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_risk_evaluations" (
  "id" TEXT PRIMARY KEY,
  "signal_id" TEXT NOT NULL REFERENCES "ma_normalized_signals"("id") ON DELETE CASCADE,
  "gate_name" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "detail" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_portfolio_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "equity" DECIMAL(20,8) NOT NULL,
  "equity_peak" DECIMAL(20,8) NOT NULL,
  "daily_pnl" DECIMAL(20,8) NOT NULL,
  "weekly_pnl" DECIMAL(20,8) NOT NULL,
  "drawdown_pct" DECIMAL(10,6) NOT NULL,
  "capital_deployed" DECIMAL(20,8) NOT NULL,
  "capital_at_risk" DECIMAL(20,8) NOT NULL,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_positions" (
  "id" TEXT PRIMARY KEY,
  "broker_account_id" TEXT NOT NULL REFERENCES "ma_broker_accounts"("id") ON DELETE CASCADE,
  "symbol" TEXT NOT NULL,
  "quantity" DECIMAL(20,8) NOT NULL,
  "avg_price" DECIMAL(20,8) NOT NULL,
  "current_price" DECIMAL(20,8),
  "market_value" DECIMAL(20,8),
  "unrealized_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "realized_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "stop_price" DECIMAL(20,8),
  "target_price" DECIMAL(20,8),
  "strategy_id" TEXT,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_orders" (
  "id" TEXT PRIMARY KEY,
  "broker_account_id" TEXT NOT NULL REFERENCES "ma_broker_accounts"("id") ON DELETE CASCADE,
  "signal_id" TEXT REFERENCES "ma_normalized_signals"("id") ON DELETE SET NULL,
  "app_order_id" TEXT NOT NULL UNIQUE,
  "idempotency_key" TEXT NOT NULL UNIQUE,
  "broker_order_id" TEXT,
  "strategy_id" TEXT,
  "symbol" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "order_type" TEXT NOT NULL,
  "quantity" DECIMAL(20,8) NOT NULL,
  "filled_qty" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "limit_price" DECIMAL(20,8),
  "stop_price" DECIMAL(20,8),
  "target_price" DECIMAL(20,8),
  "status" TEXT NOT NULL,
  "parent_order_id" TEXT,
  "role" TEXT NOT NULL DEFAULT 'entry',
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_order_events" (
  "id" TEXT PRIMARY KEY,
  "order_id" TEXT NOT NULL REFERENCES "ma_orders"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL,
  "detail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_executions" (
  "id" TEXT PRIMARY KEY,
  "broker_account_id" TEXT NOT NULL REFERENCES "ma_broker_accounts"("id") ON DELETE CASCADE,
  "order_id" TEXT REFERENCES "ma_orders"("id") ON DELETE SET NULL,
  "exec_id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "qty" DECIMAL(20,8) NOT NULL,
  "price" DECIMAL(20,8) NOT NULL,
  "commission" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED'
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_executions_acct_exec"
  ON "ma_executions"("broker_account_id", "exec_id");

CREATE TABLE IF NOT EXISTS "ma_trades" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "qty" DECIMAL(20,8) NOT NULL,
  "entry_price" DECIMAL(20,8) NOT NULL,
  "exit_price" DECIMAL(20,8),
  "gross_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "net_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "fees" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "ma_daily_performance" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "gross_pnl" DECIMAL(20,8) NOT NULL,
  "net_pnl" DECIMAL(20,8) NOT NULL,
  "fees" DECIMAL(20,8) NOT NULL,
  "trades" INTEGER NOT NULL DEFAULT 0,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED'
);
CREATE UNIQUE INDEX IF NOT EXISTS "ma_daily_perf_uniq"
  ON "ma_daily_performance"("tenant_id", "day", "source");

CREATE TABLE IF NOT EXISTS "ma_equity_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "equity" DECIMAL(20,8) NOT NULL,
  "source" "MaDataSource" NOT NULL DEFAULT 'SIMULATED',
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_reconciliation_runs" (
  "id" TEXT PRIMARY KEY,
  "broker_account_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "detail" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_system_health_events" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT,
  "kind" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "detail" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_audit_events" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entity_id" TEXT,
  "detail" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ma_kill_switches" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
