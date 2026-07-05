-- CreateTable
CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "broker_connection_id" TEXT,
    "broker_order_id" TEXT,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'NSE',
    "instrument_type" TEXT NOT NULL DEFAULT 'EQUITY',
    "option_details" JSONB,
    "trade_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2),
    "trigger_price" DECIMAL(10,2),
    "order_type" TEXT NOT NULL DEFAULT 'MARKET',
    "product" TEXT NOT NULL DEFAULT 'CNC',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_paper" BOOLEAN NOT NULL DEFAULT true,
    "agent_id" TEXT,
    "rejection_reason" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trading_agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'paper',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "engine_id" TEXT,
    "config" JSONB NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trading_agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signals" JSONB,
    "orders_placed" JSONB,
    "summary" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "prediction_engines" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "engine_type" TEXT NOT NULL,
    "symbols" JSONB NOT NULL,
    "parameters" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deploy_target" TEXT,
    "deploy_url" TEXT,
    "accuracy" DECIMAL(5,2),
    "last_trained_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prediction_engines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "prediction_results" (
    "id" TEXT NOT NULL,
    "engine_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "prediction" JSONB NOT NULL,
    "actual_outcome" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "screener_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "screener_results_pkey" PRIMARY KEY ("id")
);
