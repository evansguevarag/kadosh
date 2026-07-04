from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory_movement import InventoryMovement


class InventoryMovementRepository:
    """Repositorio de acceso a datos para movimientos de inventario."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all(self) -> list[InventoryMovement]:
        """Obtiene todos los movimientos de inventario."""

        statement = select(InventoryMovement).order_by(
            InventoryMovement.created_at.desc()
        )

        return list(self.db.scalars(statement).all())

    def find_by_variant_id(self, product_variant_id: UUID) -> list[InventoryMovement]:
        """Obtiene movimientos de inventario por variante."""

        statement = (
            select(InventoryMovement)
            .where(InventoryMovement.product_variant_id == product_variant_id)
            .order_by(InventoryMovement.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def create(self, movement: InventoryMovement) -> InventoryMovement:
        """Registra un nuevo movimiento de inventario."""

        self.db.add(movement)
        self.db.flush()
        self.db.refresh(movement)

        return movement
