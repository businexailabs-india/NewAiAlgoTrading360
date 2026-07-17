"""advisory schema initial

Revision ID: 20260717_0001
Revises:
Create Date: 2026-07-17
"""

from alembic import op

revision = "20260717_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS advisory")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS advisory.advisory_sessions (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            user_id UUID NOT NULL,
            account_id VARCHAR(128),
            advisory_date DATE NOT NULL,
            market VARCHAR(32) DEFAULT 'NSE',
            broker VARCHAR(64) DEFAULT 'unknown',
            status VARCHAR(32) DEFAULT 'preparing',
            summary TEXT,
            model_version VARCHAR(64),
            prompt_version VARCHAR(32) DEFAULT 'v1',
            generated_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_advisory_daily UNIQUE (tenant_id, user_id, advisory_date)
        );
        CREATE TABLE IF NOT EXISTS advisory.advisory_input_snapshots (
            id UUID PRIMARY KEY,
            advisory_session_id UUID REFERENCES advisory.advisory_sessions(id) ON DELETE CASCADE,
            portfolio_snapshot_json JSONB DEFAULT '{}',
            margin_snapshot_json JSONB DEFAULT '{}',
            risk_profile_json JSONB DEFAULT '{}',
            market_snapshot_json JSONB DEFAULT '{}',
            active_strategy_snapshot_json JSONB DEFAULT '{}',
            broker_health_json JSONB DEFAULT '{}',
            market_regime_json JSONB DEFAULT '{}',
            data_sources_json JSONB DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS advisory.advisory_recommendations (
            id UUID PRIMARY KEY,
            advisory_session_id UUID REFERENCES advisory.advisory_sessions(id) ON DELETE CASCADE,
            recommendation_type VARCHAR(64) NOT NULL,
            title VARCHAR(256) NOT NULL,
            summary TEXT NOT NULL,
            asset_class VARCHAR(64) DEFAULT 'equity',
            exchange VARCHAR(32) DEFAULT 'NSE',
            symbols JSONB DEFAULT '[]',
            direction VARCHAR(32),
            timeframe VARCHAR(16) DEFAULT '5m',
            expected_holding_period VARCHAR(64),
            confidence_score DOUBLE PRECISION DEFAULT 0.5,
            risk_score DOUBLE PRECISION DEFAULT 0.5,
            required_capital DOUBLE PRECISION DEFAULT 0,
            max_loss_estimate DOUBLE PRECISION,
            stop_loss_required BOOLEAN DEFAULT TRUE,
            target_required BOOLEAN DEFAULT TRUE,
            explanation TEXT,
            warnings JSONB DEFAULT '[]',
            status VARCHAR(32) DEFAULT 'active',
            paper_only BOOLEAN DEFAULT TRUE
        );
        CREATE TABLE IF NOT EXISTS advisory.strategy_options (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            user_id UUID NOT NULL,
            advisory_recommendation_id UUID REFERENCES advisory.advisory_recommendations(id) ON DELETE SET NULL,
            strategy_type VARCHAR(64) NOT NULL,
            strategy_name VARCHAR(256) NOT NULL,
            version INTEGER DEFAULT 1,
            entry_rules_json JSONB DEFAULT '[]',
            exit_rules_json JSONB DEFAULT '[]',
            risk_rules_json JSONB DEFAULT '[]',
            position_sizing_json JSONB DEFAULT '{}',
            instruments_json JSONB DEFAULT '[]',
            timeframe VARCHAR(16) DEFAULT '5m',
            paper_test_required BOOLEAN DEFAULT TRUE,
            live_enabled BOOLEAN DEFAULT FALSE,
            source_type VARCHAR(64) DEFAULT 'ai_generated',
            source_name VARCHAR(128) DEFAULT 'BusineXAi Advisory',
            source_license_status VARCHAR(64) DEFAULT 'internal',
            validation_status VARCHAR(64) DEFAULT 'draft',
            saved BOOLEAN DEFAULT FALSE,
            paper_deployed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS advisory.strategy_configs (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            user_id UUID NOT NULL,
            strategy_option_id UUID,
            name VARCHAR(256) NOT NULL,
            current_version INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS advisory.strategy_versions (
            id UUID PRIMARY KEY,
            strategy_config_id UUID REFERENCES advisory.strategy_configs(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            config_json JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_strategy_version UNIQUE (strategy_config_id, version)
        );
        CREATE TABLE IF NOT EXISTS advisory.external_algo_candidates (
            id UUID PRIMARY KEY,
            tenant_id UUID,
            user_id UUID,
            source_name VARCHAR(128) NOT NULL,
            source_url VARCHAR(512),
            source_type VARCHAR(64) NOT NULL,
            title VARCHAR(256) NOT NULL,
            description TEXT,
            asset_class VARCHAR(64) DEFAULT 'equity',
            exchange VARCHAR(32) DEFAULT 'NSE',
            strategy_logic_raw JSONB DEFAULT '{}',
            normalized_strategy_json JSONB,
            license_status VARCHAR(64) DEFAULT 'license_unknown',
            verification_status VARCHAR(64) DEFAULT 'discovered',
            performance_claims_json JSONB DEFAULT '{}',
            risk_warnings JSONB DEFAULT '[]',
            imported_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS advisory.paper_test_results (
            id UUID PRIMARY KEY,
            strategy_option_id UUID REFERENCES advisory.strategy_options(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            account_id VARCHAR(128),
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ,
            initial_capital DOUBLE PRECISION NOT NULL,
            final_capital DOUBLE PRECISION,
            pnl DOUBLE PRECISION,
            pnl_percent DOUBLE PRECISION,
            max_drawdown DOUBLE PRECISION,
            win_rate DOUBLE PRECISION,
            trade_count INTEGER DEFAULT 0,
            profit_factor DOUBLE PRECISION,
            sharpe_ratio DOUBLE PRECISION,
            risk_breaches_json JSONB DEFAULT '[]',
            result_status VARCHAR(32) DEFAULT 'incomplete',
            qualified_for_live BOOLEAN DEFAULT FALSE,
            dataset_version VARCHAR(64)
        );
        CREATE TABLE IF NOT EXISTS advisory.user_strategy_approvals (
            id UUID PRIMARY KEY,
            strategy_option_id UUID REFERENCES advisory.strategy_options(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            approval_type VARCHAR(64) NOT NULL,
            approved_at TIMESTAMPTZ DEFAULT NOW(),
            ip_address VARCHAR(64),
            device_id VARCHAR(128),
            risk_disclosure_accepted BOOLEAN DEFAULT FALSE,
            approval_text TEXT
        );
        CREATE TABLE IF NOT EXISTS advisory.live_deployment_requests (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            user_id UUID NOT NULL,
            strategy_option_id UUID NOT NULL,
            status VARCHAR(32) DEFAULT 'pending',
            block_reasons JSONB DEFAULT '[]',
            explicit_confirmation BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS advisory.advisory_audit_events (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            user_id UUID NOT NULL,
            action VARCHAR(128) NOT NULL,
            resource VARCHAR(128) NOT NULL,
            details JSONB DEFAULT '{}',
            ip_address VARCHAR(64),
            device_id VARCHAR(128),
            request_id VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS advisory.kafka_inbox (
            id UUID PRIMARY KEY,
            event_id VARCHAR(64) UNIQUE NOT NULL,
            idempotency_key VARCHAR(256) UNIQUE NOT NULL,
            topic VARCHAR(128) NOT NULL,
            processed_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS advisory CASCADE")
