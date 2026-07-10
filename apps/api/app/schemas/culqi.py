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


class CulqiOrderCreate(BaseModel):
    """Datos para crear una orden Culqi asociada a una sesión de pago."""

    payment_session_id: UUID = Field(
        description="Sesión de pago enviada a la pantalla del cliente.",
    )
    email: EmailStr = Field(
        examples=["cliente@correo.com"],
        description="Correo del cliente requerido por Culqi Checkout.",
    )
    first_name: str | None = Field(
        default=None,
        max_length=49,
        description="Nombre del cliente para client_details.",
    )
    last_name: str | None = Field(
        default=None,
        max_length=49,
        description="Apellido del cliente para client_details.",
    )
    phone_number: str | None = Field(
        default=None,
        max_length=14,
        description="Teléfono del cliente para client_details.",
    )


class CulqiOrderCreateResponse(BaseModel):
    """Orden Culqi creada para abrir Checkout multipago."""

    payment_session_id: UUID
    sale_id: UUID
    culqi_order_id: str
    amount: int
    currency: str
    state: str
    payment_code: str | None
    message: str


class CulqiOrderConfirm(BaseModel):
    """Datos para verificar una orden Culqi y registrar el pago si fue aprobada."""

    payment_session_id: UUID = Field(
        description="Sesión de pago asociada a la orden Culqi.",
    )
    culqi_order_id: str = Field(
        min_length=1,
        max_length=150,
        examples=["ord_test_xxxxxxxxxxxxx"],
        description="ID de la orden devuelta por Culqi.",
    )


class CulqiOrderConfirmResponse(BaseModel):
    """Resultado normalizado de la confirmación de una orden Culqi."""

    payment_id: UUID | None
    payment_session_id: UUID
    sale_id: UUID
    culqi_order_id: str
    status: str
    order_state: str
    message: str
