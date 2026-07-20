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
    paternal_last_name: str
    maternal_last_name: str
    email: EmailStr
    role: str
    status: str


class TokenResponse(BaseModel):
    """Respuesta de autenticación con tokens JWT."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class RefreshTokenRequest(BaseModel):
    """Refresh token utilizado para renovar una sesion activa."""

    refresh_token: str = Field(min_length=1)


class PasswordResetRequest(BaseModel):
    """Solicitud para enviar un OTP de restablecimiento."""

    email: EmailStr = Field(
        examples=["admin@kadosh.com"],
    )


class PasswordResetResponse(BaseModel):
    """Respuesta generica para no revelar si el correo existe."""

    message: str
    email_delivery_configured: bool = True


class PasswordResetVerifyRequest(BaseModel):
    """Datos para validar un OTP antes de cambiar contrasena."""

    email: EmailStr = Field(
        examples=["admin@kadosh.com"],
    )
    otp_code: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        examples=["123456"],
    )


class PasswordResetConfirmRequest(PasswordResetVerifyRequest):
    """Datos para confirmar el cambio de contrasena."""

    new_password: str = Field(
        min_length=8,
        max_length=72,
        examples=["NuevaClave123"],
    )


class BootstrapAdminRequest(BaseModel):
    """Datos para crear el primer administrador del sistema."""

    first_name: str = Field(
        min_length=1,
        max_length=100,
        examples=["Jaime"],
    )
    paternal_last_name: str = Field(
        min_length=1,
        max_length=100,
        examples=["Guevara"],
    )
    maternal_last_name: str = Field(
        min_length=1,
        max_length=100,
        examples=["Gil"],
    )
    email: EmailStr = Field(
        examples=["admin@kadosh.com"],
    )
    password: str = Field(
        min_length=8,
        max_length=72,
        examples=["Kadosh123"],
    )
    document_number: str = Field(
        min_length=8,
        max_length=8,
        pattern=r"^\d{8}$",
        examples=["70900994"],
    )
    phone: str = Field(
        min_length=9,
        max_length=9,
        pattern=r"^9\d{8}$",
        examples=["924454127"],
    )


class BootstrapAdminResponse(BaseModel):
    """Respuesta luego de crear el primer administrador."""

    message: str
    user: AuthUserResponse
