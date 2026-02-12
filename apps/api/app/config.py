from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AdControl API"
    secret_key: str = "dev-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "postgresql+psycopg2://adcontrol:adcontrol@db:5432/adcontrol"
    uploads_dir: str = "uploads"

    class Config:
        env_file = ".env"


settings = Settings()
