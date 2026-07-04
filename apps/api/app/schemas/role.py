from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoleResponse(BaseModel):
    """Respuesta pública de un rol del sistema."""

    id: UUID
    name: str = Field(examples=["ADMIN"])
    description: str | None = Field(
        default=None,
        examples=["Administrador del sistema con acceso completo."],
    )
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
