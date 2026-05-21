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
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_plus_monthly: str | None = None
    stripe_price_ep_founder_monthly: str | None = None
    stripe_price_th_founder_monthly: str | None = None
    stripe_price_ep_plus_monthly: str | None = None
    stripe_price_th_plus_monthly: str | None = None
    stripe_price_ep_plus_yearly: str | None = None
    stripe_price_th_plus_yearly: str | None = None
    stripe_price_ep_plus_yearly_promo: str | None = None
    stripe_price_th_plus_yearly_promo: str | None = None
    founder_pricing_enabled: bool = True
    founder_user_limit: int | None = None
    founder_price_limit: int = 100
    frontend_base_url: str = "http://127.0.0.1:3000"
    backend_base_url: str = "http://127.0.0.1:8001"
    stripe_customer_portal_return_url: str | None = None
    referral_enabled: bool = True
    referral_cookie_days: int = 30
    referral_register_coins: int = 10
    referral_paid_coins: int = 100
    referral_reward_hold_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def is_deployed_environment(self) -> bool:
        return self.environment.lower() in {"staging", "production"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def model_post_init(self, __context: object) -> None:
        if not self.is_deployed_environment:
            return

        errors: list[str] = []
        if self.database_url.lower().startswith("sqlite"):
            errors.append("DATABASE_URL must not use SQLite in staging or production")
        if self.jwt_secret in {"change-me-in-production", "change-me"} or len(self.jwt_secret.strip()) < 32:
            errors.append("JWT_SECRET must be a strong non-default value in staging or production")
        origins = self.cors_origin_list
        if not origins:
            errors.append("CORS_ORIGINS must be explicit in staging or production")
        if "*" in origins:
            errors.append("CORS_ORIGINS must not use wildcard in staging or production")
        if any(origin.startswith("http://127.0.0.1") or origin.startswith("http://localhost") for origin in origins):
            errors.append("CORS_ORIGINS must not use localhost origins in staging or production")

        if errors:
            raise ValueError("; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    return Settings()
