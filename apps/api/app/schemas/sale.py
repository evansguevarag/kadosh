from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SaleItemCreate(BaseModel):
    """Producto/variante incluido en una venta."""

    product_variant_id: UUID
    quantity: int = Field(
        gt=0,
        examples=[2],
    )
    unit_price: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=2,
        examples=[Decimal("79.90")],
        description="Si no se envía, se usará el precio actual de la variante.",
    )
    discount_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        decimal_places=2,
        examples=[Decimal("0.00")],
    )


class SaleCreate(BaseModel):
    """Datos requeridos para crear una venta."""

    customer_id: UUID | None = Field(
        default=None,
        description="Cliente asociado a la venta. Puede ser null para venta sin cliente.",
    )
    items: list[SaleItemCreate] = Field(
        min_length=1,
        description="Lista de productos vendidos.",
    )
    discount_total: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        decimal_places=2,
        examples=[Decimal("0.00")],
    )
    tax_total: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        decimal_places=2,
        examples=[Decimal("0.00")],
        description="Campo compatible con clientes anteriores. El backend calcula el IGV incluido en el precio final.",
    )
    notes: str | None = Field(
        default=None,
        max_length=255,
        examples=["Venta realizada en tienda."],
    )


class SaleItemResponse(BaseModel):
    """Detalle público de un item vendido."""

    id: UUID
    sale_id: UUID
    product_variant_id: UUID
    product_name: str
    variant_sku: str
    size: str | None
    color: str | None
    quantity: int
    unit_price: Decimal
    cost_price: Decimal
    discount_amount: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class SaleCustomerResponse(BaseModel):
    """Datos del cliente asociado a la venta."""

    id: UUID
    document_type: str | None
    document_number: str | None
    first_name: str
    last_name: str | None
    phone: str | None
    email: str | None

    model_config = ConfigDict(from_attributes=True)


class SaleResponse(BaseModel):
    """Respuesta pública de una venta."""

    id: UUID
    sale_number: str
    receipt_token: str
    seller_id: UUID
    customer_id: UUID | None
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    status: str
    notes: str | None
    paid_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[SaleItemResponse] = []
    customer: SaleCustomerResponse | None = None

    model_config = ConfigDict(from_attributes=True)
