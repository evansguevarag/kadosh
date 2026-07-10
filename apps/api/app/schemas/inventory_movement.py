from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InventoryMovementCreate(BaseModel):
    """Datos requeridos para registrar un movimiento manual de inventario."""

    product_variant_id: UUID
    movement_type: str = Field(
        examples=["ENTRADA"],
        description="Tipos permitidos: ENTRADA, SALIDA, AJUSTE, VENTA, DEVOLUCION.",
    )
    quantity: int = Field(
        gt=0,
        examples=[10],
    )
    reason: str | None = Field(
        default=None,
        max_length=255,
        examples=["Ingreso de mercadería nueva."],
    )



class InventoryMovementResponse(BaseModel):
    """Respuesta pública de un movimiento de inventario."""

    id: UUID
    product_variant_id: UUID
    user_id: UUID | None
    sale_id: UUID | None
    movement_type: str
    quantity: int
    previous_stock: int
    new_stock: int
    reason: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
