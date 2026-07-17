from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class AdvisorySettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://smarttrade:smarttrade_password@localhost:5432/smarttrade"
    redis_url: str = "redis://localhost:6379/0"
    kafka_bootstrap_servers: str = "localhost:9092"
    service_hmac_secret: str = "dev-service-hmac-secret-change-me"
    gateway_internal_url: str = "http://localhost:3001"
    llm_gateway_path: str = "/api/internal/llm/advisory"
    context_gateway_path: str = "/api/internal/advisory/context"
    advisory_ttl_hours: int = 24
    market_data_max_age_seconds: int = 300
    paper_qualify_min_trades: int = 5
    paper_qualify_max_drawdown_pct: float = 15.0
    live_trading_enabled: bool = False
    otel_service_name: str = "ai-advisory-service"
    prometheus_enabled: bool = True
