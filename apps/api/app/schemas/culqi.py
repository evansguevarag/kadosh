from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class CulqiChargeCreate(BaseModel):
    """Datos enviados por el frontend/tablet después de tokenizar con Culqi Checkout."""

    payment_session_id: UUID = Field(
        description="Sesión de pago enviada a la pantalla del cliente.",
    )
    token_id: str = Field(
        min_length=1,
        max_length=120,
        examples=["tkn_test_xxxxxxxxxxxxx"],
        description="Token generado por Culqi Checkout Custom.",
    )
    email: EmailStr = Field(
        examples=["cliente@correo.com"],
        description="Correo del cliente requerido para crear el cargo.",
    )


class CulqiChargeResponse(BaseModel):
    """Respuesta normalizada del cargo Culqi."""

    payment_id: UUID
    payment_session_id: UUID
    sale_id: UUID
    status: str
    message: str
