from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración general de la aplicación."""

    app_name: str = "Kadosh POS API"
    app_env: str = "development"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:3000"

    supabase_database_url: str = Field(alias="SUPABASE_DATABASE_URL")

    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    culqi_public_key: str = Field(alias="CULQI_PUBLIC_KEY")
    culqi_secret_key: str = Field(alias="CULQI_SECRET_KEY")
    culqi_default_phone_number: str = Field(
        default="924454127",
        alias="CULQI_DEFAULT_PHONE_NUMBER",
    )

    apiperu_base_url: str = "https://apiperu.dev/api"
    apiperu_token: str = Field(default="", alias="APIPERU_TOKEN")

    customer_display_device_id: str = Field(
        default="tablet-caja-01",
        alias="CUSTOMER_DISPLAY_DEVICE_ID",
    )
    customer_display_device_secret: str = Field(
        default="",
        alias="CUSTOMER_DISPLAY_DEVICE_SECRET",
    )

    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="", alias="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
