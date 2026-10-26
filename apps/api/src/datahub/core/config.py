from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DATAHUB_", env_file=".env", extra="ignore")

    env: Literal["development", "test", "staging", "production"] = "development"
    version: str = "0.1.0-dev"
    api_host: str = "0.0.0.0"
    api_port: int = Field(default=8000, ge=1, le=65535)
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://datahub:datahub_dev_password@localhost:5440/datahub"
    redis_url: str = "redis://localhost:6390/0"
    celery_broker_url: str = "redis://localhost:6390/1"
    celery_result_backend: str = "redis://localhost:6390/2"

    s3_endpoint_url: str = "http://localhost:9410"
    s3_public_endpoint_url: str = "http://localhost:9410"
    s3_region: str = "us-east-1"
    s3_bucket: str = "datahub-private"
    s3_access_key: str = "datahub-dev-access"
    s3_secret_key: SecretStr = SecretStr("development-only-secret")

    clamav_host: str = "localhost"
    clamav_port: int = Field(default=3310, ge=1, le=65535)
    smtp_host: str = "localhost"
    smtp_port: int = Field(default=1035, ge=1, le=65535)
    frontend_origin: str = "http://localhost:3410"

    session_secret: SecretStr = SecretStr("development-session-secret-change-me")
    csrf_secret: SecretStr = SecretStr("development-csrf-secret-change-me")
    field_encryption_keys: SecretStr = SecretStr("development-fernet-key-change-me")
    admin_mfa_required: bool = True

    smtp_from: str = "DataHub <no-reply@datahub.local>"
    rate_limit_backend: Literal["redis", "memory"] = "redis"
    trusted_proxies: list[str] = Field(default_factory=list)

    # Cookies and sessions (AUTH_AUTHORIZATION.md section 7, 8 and 18).
    session_cookie_name: str = "dh_session"
    csrf_cookie_name: str = "dh_csrf"
    anon_cookie_name: str = "dh_anon"
    session_idle_seconds_user: int = 604_800
    session_idle_seconds_admin: int = 1_800
    session_absolute_seconds: int = 2_592_000
    session_absolute_seconds_admin: int = 43_200
    session_max_active: int = 20
    session_touch_interval_seconds: int = 60
    step_up_seconds: int = 900
    csrf_max_age_seconds: int = 86_400

    # Credentials.
    argon2_time_cost: int = Field(default=3, ge=1)
    argon2_memory_kib: int = Field(default=65_536, ge=8)
    argon2_parallelism: int = Field(default=4, ge=1)
    password_breach_check: bool = False
    login_lock_threshold: int = Field(default=5, ge=1)
    login_lock_window_seconds: int = Field(default=900, ge=1)
    login_lock_seconds: int = Field(default=900, ge=1)
    email_token_ttl_seconds: int = 86_400
    reset_token_ttl_seconds: int = 3_600
    mfa_setup_ttl_seconds: int = 900
    mfa_issuer: str = "DataHub"
    auth_min_response_ms: int = Field(default=400, ge=0)
    terms_version: str = "2026-10-26"
    privacy_version: str = "2026-10-26"

    @property
    def cookie_secure(self) -> bool:
        """Secure is dropped only for ENV=development (plain-HTTP localhost)."""
        return self.env != "development"

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("unsupported log level")
        return normalized

    def assert_safe_for_runtime(self) -> None:
        if self.env == "production" and not self.admin_mfa_required:
            raise RuntimeError("ADMIN_MFA_REQUIRED must be true in production")
        if self.env not in {"staging", "production"}:
            return
        insecure_markers = ("development", "change-me", "CHANGE_ME")
        values = (
            self.s3_secret_key.get_secret_value(),
            self.session_secret.get_secret_value(),
            self.csrf_secret.get_secret_value(),
            self.field_encryption_keys.get_secret_value(),
        )
        if any(marker in value for value in values for marker in insecure_markers):
            raise RuntimeError("development secrets are forbidden outside development/test")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.assert_safe_for_runtime()
    return settings
