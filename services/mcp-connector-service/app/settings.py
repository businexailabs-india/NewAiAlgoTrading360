"""MCP connector service settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPConnectorSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_hmac_secret: str = "dev-service-hmac-secret-change-me"
    kafka_bootstrap_servers: str = "memory://"
    live_trading_enabled: bool = False
    paper_trading_enabled: bool = True
    kill_switch: bool = False

    mcp_default_provider: str = "paper_trading"
    mcp_enable_dhan: bool = True
    mcp_enable_zerodha: bool = False
    mcp_enable_angelone: bool = False
    mcp_enable_upstox: bool = False
    mcp_enable_fyers: bool = False
    mcp_enable_icici_breeze: bool = False
    mcp_enable_kotak_neo: bool = False
    mcp_enable_alice_blue: bool = False
    mcp_enable_finvasia_shoonya: bool = False
    mcp_enable_mock: bool = True
    mcp_enable_mock_market_data: bool = True

    secret_manager_provider: str = "local_encrypted"
    local_secret_key: str = "change-this-in-production"
    mcp_providers_config_dir: str = ""

    health_check_interval_seconds: int = 60
    prometheus_enabled: bool = True
    rate_limit_per_minute: int = 120
