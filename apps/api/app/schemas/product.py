from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    """Datos base de un producto."""

    category_id: UUID
    name: str = Field(
        min_length=1,
        max_length=150,
        examples=["Polera Oversize Kadosh"],
    )
    description: str | None = Field(
        default=None,
        examples=["Polera urbana de algodón premium."],
    )
    brand: str | None = Field(
        default=None,
        max_length=100,
        examples=["Kadosh"],
    )


class ProductCreate(ProductBase):
    """Datos requeridos para crear un producto."""


class ProductUpdate(BaseModel):
    """Datos permitidos para actualizar un producto."""

    category_id: UUID | None = None
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
        examples=["Polera Boxy Fit Kadosh"],
    )
    description: str | None = Field(
        default=None,
        examples=["Polera urbana actualizada."],
    )
    brand: str | None = Field(
        default=None,
        max_length=100,
        examples=["Kadosh"],
    )
    status: str | None = Field(
        default=None,
        examples=["ACTIVE"],
    )
    is_active: bool | None = None


class ProductResponse(ProductBase):
    """Respuesta pública de un producto."""

    id: UUID
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
