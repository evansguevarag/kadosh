from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    paternal_last_name: str = Field(min_length=1, max_length=100)
    maternal_last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    document_number: str = Field(pattern=r"^\d{8}$")
    phone: str = Field(pattern=r"^9\d{8}$")
    role: str = Field(default="EMPLOYEE")

    @field_validator("first_name", "paternal_last_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"ADMIN", "EMPLOYEE"}:
            raise ValueError("El rol debe ser ADMIN o EMPLOYEE.")
        return normalized


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    paternal_last_name: str | None = Field(default=None, min_length=1, max_length=100)
    maternal_last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    document_number: str | None = Field(default=None, pattern=r"^\d{8}$")
    phone: str | None = Field(default=None, pattern=r"^9\d{8}$")
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if normalized not in {"ADMIN", "EMPLOYEE"}:
            raise ValueError("El rol debe ser ADMIN o EMPLOYEE.")
        return normalized


class UserResponse(BaseModel):
    id: UUID
    first_name: str
    paternal_last_name: str
    maternal_last_name: str
    email: EmailStr
    document_number: str
    phone: str
    role: str
    status: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
