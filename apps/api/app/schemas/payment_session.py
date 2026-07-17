from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    receipt_email: EmailStr | None = Field(
        default=None,
        examples=["cliente@correo.com"],
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
    receipt_email: str | None
    expires_at: datetime
    viewed_at: datetime | None
    processing_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerDisplaySaleItemResponse(BaseModel):
    """Detalle mínimo de un producto mostrado en la pantalla del cliente."""

    id: UUID
    product_name: str
    variant_sku: str
    size: str | None
    color: str | None
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class CustomerDisplaySaleResponse(BaseModel):
    """Resumen de compra visible antes de que el cliente pague."""

    sale_number: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    items: list[CustomerDisplaySaleItemResponse]

    model_config = ConfigDict(from_attributes=True)


class CustomerDisplayPaymentSessionResponse(PaymentSessionResponse):
    """Sesión de pago enriquecida con la compra enviada a la tablet."""

    context_type: str = "SALE"
    sale: CustomerDisplaySaleResponse | None = None
    return_difference: "CustomerDisplayReturnDifferenceResponse | None" = None


class CustomerDisplayReturnItemResponse(BaseModel):
    product_name: str
    variant_sku: str
    quantity: int


class CustomerDisplayReturnDifferenceResponse(BaseModel):
    return_number: str
    original_sale_number: str
    returned_value: Decimal
    replacement_value: Decimal
    difference_amount: Decimal
    replacements: list[CustomerDisplayReturnItemResponse]


class CustomerDisplayReturnSessionResponse(BaseModel):
    id: UUID
    sale_id: UUID | None = None
    payment_id: UUID | None = None
    seller_id: UUID
    device_id: str
    status: str
    amount: Decimal
    currency: str = "PEN"
    customer_message: str | None = None
    receipt_email: str | None = None
    expires_at: datetime
    viewed_at: datetime | None
    processing_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    context_type: str = "RETURN_DIFFERENCE"
    sale: CustomerDisplaySaleResponse | None = None
    return_difference: CustomerDisplayReturnDifferenceResponse
