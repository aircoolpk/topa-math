from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "4-craft Adaptive Learning API"
    environment: str = "local"
    database_url: str = "sqlite:///./adaptive_learning.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    minimax_api_key: str | None = None
    redis_url: str = "redis://redis:6379/0"
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_plus_monthly: str | None = None
    stripe_price_ep_founder_monthly: str | None = None
    stripe_price_th_founder_monthly: str | None = None
    stripe_price_ep_plus_monthly: str | None = None
    stripe_price_th_plus_monthly: str | None = None
    stripe_price_ep_plus_yearly_promo: str | None = None
    stripe_price_th_plus_yearly_promo: str | None = None
    founder_price_limit: int = 100
    frontend_base_url: str = "http://127.0.0.1:3000"
    backend_base_url: str = "http://127.0.0.1:8001"
    stripe_customer_portal_return_url: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
