from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Kadosh POS API"
    app_env: str = "development"
    app_version: str = "0.1.0"

    api_v1_prefix: str = "/api/v1"

    frontend_url: str = "http://localhost:3000"

    supabase_database_url: str = (
        "postgresql+psycopg://postgres:password@localhost:5432/kadosh_pos_db"
    )

    jwt_secret_key: str = "change_this_secret_key"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    culqi_public_key: str = "pk_test_change_this"
    culqi_secret_key: str = "sk_test_change_this"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
