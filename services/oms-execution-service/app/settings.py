from pydantic_settings import BaseSettings, SettingsConfigDict


class OMSSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    live_trading_enabled: bool = False
    kill_switch: bool = False
    mcp_connector_url: str = "http://localhost:8094"
    service_hmac_secret: str = "dev-service-hmac-secret-change-me"
    oms_port: int = 8106
