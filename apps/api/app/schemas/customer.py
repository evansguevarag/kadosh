from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerBase(BaseModel):
    """Datos base de un cliente."""

    document_type: str = Field(
        default="DNI",
        max_length=20,
        examples=["DNI"],
    )
    document_number: str = Field(
        min_length=8,
        max_length=20,
        examples=["12345678"],
    )
    first_name: str = Field(
        min_length=1,
        max_length=100,
        examples=["JUAN CARLOS"],
    )
    last_name: str = Field(
        min_length=1,
        max_length=150,
        examples=["PEREZ LOPEZ"],
    )
    phone: str | None = Field(
        default=None,
        max_length=30,
        examples=["987654321"],
    )
    email: EmailStr | None = Field(
        default=None,
        examples=["cliente@correo.com"],
    )


class CustomerCreate(CustomerBase):
    """Datos requeridos para crear un cliente."""


class CustomerUpdate(BaseModel):
    """Datos permitidos para actualizar un cliente."""

    document_type: str | None = Field(
        default=None,
        max_length=20,
        examples=["DNI"],
    )
    document_number: str | None = Field(
        default=None,
        min_length=8,
        max_length=20,
        examples=["12345678"],
    )
    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        examples=["JUAN CARLOS"],
    )
    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
        examples=["PEREZ LOPEZ"],
    )
    phone: str | None = Field(
        default=None,
        max_length=30,
        examples=["987654321"],
    )
    email: EmailStr | None = Field(
        default=None,
        examples=["cliente@correo.com"],
    )
    is_active: bool | None = None


class CustomerResponse(CustomerBase):
    """Respuesta pública de un cliente."""

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerResolveDniResponse(BaseModel):
    """Cliente resuelto desde la base local o consultando DNI externamente."""

    customer: CustomerResponse
    source: str
