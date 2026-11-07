from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    payment_gateway_default: str = 'stripe'
    mpp_checkout_enabled: bool = False
    mpp_checkout_test_user_ids: str = ''
    mpp_api_base_url: str = "https://staging-api.mmerchant.cc/api/v1"
    mpp_payment_base_url: str = "https://staging-pay.mmerchant.cc"
    mpp_project_api_key: str | None = None
    mpp_webhook_signing_secret: str | None = None
    mpp_expected_merchant_name: str | None = None
    mpp_expected_project_name: str | None = None
    mpp_amount_unit: str | None = None
    app_name: str = "4-craft Adaptive Learning API"
    environment: str = "local"
    database_url: str = "sqlite:///./adaptive_learning.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    auth_cookie_name: str = "topa_session"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"
    auth_cookie_domain: str | None = None
    auth_cookie_path: str = "/"
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
    affiliate_commission_rate_bps: int = 300
    affiliate_commission_hold_days: int = 7
    affiliate_min_withdrawal_minor: int = 50000
    affiliate_admin_notification_email: str | None = None
    email_from: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True

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
        if not self.auth_cookie_secure:
            errors.append("AUTH_COOKIE_SECURE must be true in staging or production")
        if self.auth_cookie_samesite.lower() not in {"lax", "strict", "none"}:
            errors.append("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
        if self.auth_cookie_samesite.lower() == "none" and not self.auth_cookie_secure:
            errors.append("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE=none")
        if not self.auth_cookie_path.startswith("/"):
            errors.append("AUTH_COOKIE_PATH must start with /")

        if errors:
            raise ValueError("; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    return Settings()
