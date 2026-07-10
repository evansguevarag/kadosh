from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductVariantBase(BaseModel):
    """Datos base de una variante de producto."""

    product_id: UUID
    sku: str = Field(
        min_length=1,
        max_length=80,
        examples=["POL-OVER-BLK-M"],
    )
    size: str | None = Field(
        default=None,
        max_length=30,
        examples=["M"],
    )
    color: str | None = Field(
        default=None,
        max_length=50,
        examples=["Negro"],
    )
    barcode: str | None = Field(
        default=None,
        max_length=100,
        examples=["7751234567890"],
    )
    cost_price: Decimal = Field(
        ge=0,
        decimal_places=2,
        examples=[Decimal("35.00")],
    )
    sale_price: Decimal = Field(
        ge=0,
        decimal_places=2,
        examples=[Decimal("79.90")],
    )
    stock_quantity: int = Field(
        default=0,
        ge=0,
        examples=[15],
    )
    min_stock_quantity: int = Field(
        default=0,
        ge=0,
        examples=[3],
    )


class ProductVariantCreate(ProductVariantBase):
    """Datos requeridos para crear una variante."""


class ProductVariantUpdate(BaseModel):
    """Datos permitidos para actualizar una variante."""

    sku: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
        examples=["POL-OVER-BLK-L"],
    )
    size: str | None = Field(
        default=None,
        max_length=30,
        examples=["L"],
    )
    color: str | None = Field(
        default=None,
        max_length=50,
        examples=["Negro"],
    )
    barcode: str | None = Field(
        default=None,
        max_length=100,
        examples=["7751234567891"],
    )
    cost_price: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=2,
        examples=[Decimal("38.00")],
    )
    sale_price: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=2,
        examples=[Decimal("84.90")],
    )
    stock_quantity: int | None = Field(
        default=None,
        ge=0,
        examples=[20],
    )
    min_stock_quantity: int | None = Field(
        default=None,
        ge=0,
        examples=[5],
    )
    status: str | None = Field(
        default=None,
        examples=["ACTIVE"],
    )
    is_active: bool | None = None


class ProductVariantResponse(ProductVariantBase):
    """Respuesta pública de una variante."""

    id: UUID
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductVariantBarcodeBackfillResponse(BaseModel):
    """Resultado de la generación masiva de códigos internos."""

    updated_count: int
    variants: list[ProductVariantResponse]
