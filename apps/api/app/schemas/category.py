from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    """Datos base de una categoría."""

    name: str = Field(
        min_length=1,
        max_length=100,
        examples=["Poleras"],
    )
    description: str | None = Field(
        default=None,
        examples=["Prendas superiores urbanas."],
    )


class CategoryCreate(CategoryBase):
    """Datos requeridos para crear una categoría."""


class CategoryUpdate(BaseModel):
    """Datos permitidos para actualizar una categoría."""

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        examples=["Casacas"],
    )
    description: str | None = Field(
        default=None,
        examples=["Casacas y chaquetas urbanas."],
    )
    is_active: bool | None = None


class CategoryResponse(CategoryBase):
    """Respuesta pública de una categoría."""

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
