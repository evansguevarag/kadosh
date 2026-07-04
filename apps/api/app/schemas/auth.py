from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Datos requeridos para iniciar sesión."""

    email: EmailStr = Field(
        examples=["admin@kadosh.com"],
    )
    password: str = Field(
        min_length=8,
        examples=["Kadosh123"],
    )


class AuthUserResponse(BaseModel):
    """Datos públicos del usuario autenticado."""

    id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    role: str
    status: str


class TokenResponse(BaseModel):
    """Respuesta de autenticación con tokens JWT."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class BootstrapAdminRequest(BaseModel):
    """Datos para crear el primer administrador del sistema."""

    first_name: str = Field(
        min_length=1,
        max_length=100,
        examples=["Jaime"],
    )
    last_name: str = Field(
        min_length=1,
        max_length=100,
        examples=["Guevara"],
    )
    email: EmailStr = Field(
        examples=["admin@kadosh.com"],
    )
    password: str = Field(
        min_length=8,
        max_length=72,
        examples=["Kadosh123"],
    )
    document_number: str | None = Field(
        default=None,
        max_length=20,
        examples=["70900994"],
    )
    phone: str | None = Field(
        default=None,
        max_length=30,
        examples=["924454127"],
    )


class BootstrapAdminResponse(BaseModel):
    """Respuesta luego de crear el primer administrador."""

    message: str
    user: AuthUserResponse
