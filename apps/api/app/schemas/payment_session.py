from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentSessionCreate(BaseModel):
    """Datos requeridos para enviar una venta a la pantalla del cliente."""

    sale_id: UUID
    device_id: str = Field(
        min_length=1,
        max_length=120,
        examples=["tablet-caja-01"],
        description="Identificador de la tablet o pantalla del cliente.",
    )
    customer_message: str | None = Field(
        default=None,
        max_length=255,
        examples=["Por favor, revise el monto antes de pagar."],
    )
    expires_in_minutes: int = Field(
        default=10,
        ge=1,
        le=60,
        examples=[10],
    )


class PaymentSessionStatusUpdate(BaseModel):
    """Datos permitidos para actualizar el estado de una sesión de pago."""

    status: str = Field(
        examples=["CUSTOMER_VIEWING"],
        description="Estados permitidos: CUSTOMER_VIEWING, PROCESSING, PAID, FAILED, EXPIRED, CANCELLED.",
    )


class PaymentSessionResponse(BaseModel):
    """Respuesta pública de una sesión de pago."""

    id: UUID
    sale_id: UUID
    payment_id: UUID | None
    seller_id: UUID
    device_id: str
    status: str
    amount: Decimal
    currency: str
    customer_message: str | None
    expires_at: datetime
    viewed_at: datetime | None
    processing_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
