from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AdControl API"
    secret_key: str
    refresh_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14

    database_url: str
    uploads_dir: str = "uploads"

    cors_allow_origins: str = ""
    max_upload_size_mb: int = 10
    allowed_upload_mime_types: str = "image/jpeg,image/png,image/webp"
    max_csv_upload_size_mb: int = 5
    allowed_csv_upload_mime_types: str = "text/csv,application/vnd.ms-excel"

    refresh_cookie_name: str = "adcontrol_refresh_token"
    refresh_cookie_secure: bool = True

    allow_telegram_mock: bool = False
    telegram_bot_token: str | None = None

    @property
    def cors_allow_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_allow_origins.split(",") if item.strip()]

    @property
    def allowed_upload_mime_types_list(self) -> list[str]:
        return [item.strip().lower() for item in self.allowed_upload_mime_types.split(",") if item.strip()]

    @property
    def allowed_csv_upload_mime_types_list(self) -> list[str]:
        return [item.strip().lower() for item in self.allowed_csv_upload_mime_types.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
