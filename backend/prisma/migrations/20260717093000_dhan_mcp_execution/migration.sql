-- Dhan MCP + execution control schema
-- Safe additive migration for existing local/prod databases

ALTER TABLE "broker_connections"
  ADD COLUMN IF NOT EXISTS "display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "external_account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "client_id_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "credentials_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "credential_key_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "provider_type" TEXT NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS "mcp_server_config_id" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "capabilities" JSONB,
  ADD COLUMN IF NOT EXISTS "last_validated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE TABLE IF NOT EXISTS "mcp_server_configs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'dhan',
  "transport" TEXT NOT NULL DEFAULT 'HTTP',
  "endpoint" TEXT NOT NULL,
  "command" TEXT,
  "args" JSONB,
  "headers_encrypted" TEXT,
  "environment_encrypted" TEXT,
  "auth_config_encrypted" TEXT,
  "credential_key_version" INTEGER NOT NULL DEFAULT 1,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_health_status" TEXT,
  "last_health_checked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "discovered_tools" JSONB,
  "capabilities" JSONB,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_server_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_execution_contexts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "active_broker_connection_id" TEXT,
  "active_mcp_server_config_id" TEXT,
  "execution_mode" TEXT NOT NULL DEFAULT 'PAPER',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_execution_contexts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trading_controls" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "user_id" TEXT,
  "broker_connection_id" TEXT,
  "live_trading_enabled" BOOLEAN NOT NULL DEFAULT false,
  "kill_switch" BOOLEAN NOT NULL DEFAULT false,
  "approval_state" TEXT NOT NULL DEFAULT 'NONE',
  "max_order_value" DECIMAL(14,2),
  "max_daily_order_value" DECIMAL(14,2),
  "max_daily_loss" DECIMAL(14,2),
  "max_open_exposure" DECIMAL(14,2),
  "require_paper_qualify" BOOLEAN NOT NULL DEFAULT true,
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trading_controls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "execution_attempts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT,
  "broker_connection_id" TEXT,
  "mcp_server_config_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "request_redacted" JSONB,
  "response_redacted" JSONB,
  "broker_status" TEXT,
  "correlation_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "reconciled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_execution_contexts_user_id_key" ON "user_execution_contexts"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "trading_controls_scope_user_id_broker_connection_id_key"
  ON "trading_controls"("scope", "user_id", "broker_connection_id");
CREATE UNIQUE INDEX IF NOT EXISTS "execution_attempts_user_id_idempotency_key_key"
  ON "execution_attempts"("user_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "broker_connections_user_id_broker_is_active_idx"
  ON "broker_connections"("user_id", "broker", "is_active");
CREATE INDEX IF NOT EXISTS "broker_connections_user_id_status_is_enabled_idx"
  ON "broker_connections"("user_id", "status", "is_enabled");
CREATE INDEX IF NOT EXISTS "mcp_server_configs_user_id_provider_is_enabled_idx"
  ON "mcp_server_configs"("user_id", "provider", "is_enabled");
CREATE INDEX IF NOT EXISTS "trading_controls_scope_live_trading_enabled_idx"
  ON "trading_controls"("scope", "live_trading_enabled");
CREATE INDEX IF NOT EXISTS "execution_attempts_order_id_idx" ON "execution_attempts"("order_id");
CREATE INDEX IF NOT EXISTS "execution_attempts_correlation_id_idx" ON "execution_attempts"("correlation_id");

DO $$ BEGIN
  ALTER TABLE "mcp_server_configs"
    ADD CONSTRAINT "mcp_server_configs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_execution_contexts"
    ADD CONSTRAINT "user_execution_contexts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_execution_contexts"
    ADD CONSTRAINT "user_execution_contexts_active_broker_connection_id_fkey"
    FOREIGN KEY ("active_broker_connection_id") REFERENCES "broker_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_execution_contexts"
    ADD CONSTRAINT "user_execution_contexts_active_mcp_server_config_id_fkey"
    FOREIGN KEY ("active_mcp_server_config_id") REFERENCES "mcp_server_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "broker_connections"
    ADD CONSTRAINT "broker_connections_mcp_server_config_id_fkey"
    FOREIGN KEY ("mcp_server_config_id") REFERENCES "mcp_server_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trading_controls"
    ADD CONSTRAINT "trading_controls_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trading_controls"
    ADD CONSTRAINT "trading_controls_broker_connection_id_fkey"
    FOREIGN KEY ("broker_connection_id") REFERENCES "broker_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "execution_attempts"
    ADD CONSTRAINT "execution_attempts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "execution_attempts"
    ADD CONSTRAINT "execution_attempts_broker_connection_id_fkey"
    FOREIGN KEY ("broker_connection_id") REFERENCES "broker_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed global trading control (paper-first)
INSERT INTO "trading_controls" ("id", "scope", "live_trading_enabled", "kill_switch", "approval_state", "require_paper_qualify")
SELECT gen_random_uuid()::text, 'GLOBAL', false, false, 'NONE', true
WHERE NOT EXISTS (SELECT 1 FROM "trading_controls" WHERE "scope" = 'GLOBAL' AND "user_id" IS NULL AND "broker_connection_id" IS NULL);
