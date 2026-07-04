from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    """Datos requeridos para registrar un pago."""

    sale_id: UUID
    payment_method: str = Field(
        examples=["CASH"],
        description="Métodos permitidos: CASH, YAPE, PLIN, TRANSFER, POS, CULQI.",
    )
    amount: Decimal = Field(
        gt=0,
        decimal_places=2,
        examples=[Decimal("79.90")],
    )
    currency: str = Field(
        default="PEN",
        max_length=3,
        examples=["PEN"],
    )
    operation_code: str | None = Field(
        default=None,
        max_length=120,
        examples=["YAPE-123456"],
        description="Código de operación para Yape, Plin, transferencia o POS.",
    )


class PaymentResponse(BaseModel):
    """Respuesta pública de un pago."""

    id: UUID
    sale_id: UUID
    payment_method: str
    provider: str | None
    amount: Decimal
    currency: str
    status: str
    operation_code: str | None
    provider_order_id: str | None
    provider_transaction_id: str | None
    culqi_charge_id: str | None
    paid_at: datetime | None
    failed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
