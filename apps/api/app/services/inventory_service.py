from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory_movement import InventoryMovement
from app.models.user import User
from app.repositories.inventory_movement_repository import InventoryMovementRepository
from app.repositories.product_variant_repository import ProductVariantRepository
from app.schemas.inventory_movement import InventoryMovementCreate


ALLOWED_INVENTORY_MOVEMENT_TYPES = {
    "ENTRADA",
    "SALIDA",
    "AJUSTE",
    "VENTA",
    "DEVOLUCION",
}


class InventoryService:
    """Servicio de lógica de negocio para inventario."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.variant_repository = ProductVariantRepository(db)
        self.movement_repository = InventoryMovementRepository(db)

    def list_movements(self) -> list[InventoryMovement]:
        """Lista todos los movimientos de inventario."""

        return self.movement_repository.find_all()

    def list_movements_by_variant(
        self,
        product_variant_id: UUID,
    ) -> list[InventoryMovement]:
        """Lista movimientos por variante de producto."""

        variant = self.variant_repository.find_by_id(product_variant_id)

        if variant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Variante de producto no encontrada.",
            )

        return self.movement_repository.find_by_variant_id(product_variant_id)

    def register_manual_movement(
        self,
        payload: InventoryMovementCreate,
        current_user: User,
    ) -> InventoryMovement:
        """Registra un movimiento manual y actualiza el stock."""

        movement_type = payload.movement_type.strip().upper()

        if movement_type not in ALLOWED_INVENTORY_MOVEMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo de movimiento de inventario inválido.",
            )

        if movement_type == "VENTA":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los movimientos por venta se generan automáticamente desde el módulo de ventas.",
            )

        variant = self.variant_repository.find_by_id(payload.product_variant_id)

        if variant is None or not variant.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Variante de producto no encontrada o inactiva.",
            )

        previous_stock = variant.stock_quantity
        new_stock = self._calculate_new_stock(
            movement_type=movement_type,
            previous_stock=previous_stock,
            quantity=payload.quantity,
        )

        variant.stock_quantity = new_stock

        movement = InventoryMovement(
            product_variant_id=variant.id,
            user_id=current_user.id,
            sale_id=None,
            movement_type=movement_type,
            quantity=payload.quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            reason=payload.reason.strip() if payload.reason else None,
        )

        try:
            self.db.add(variant)
            created_movement = self.movement_repository.create(movement)
            self.db.commit()
            self.db.refresh(variant)
            self.db.refresh(created_movement)

            return created_movement
        except Exception:
            self.db.rollback()
            raise

    def _calculate_new_stock(
        self,
        movement_type: str,
        previous_stock: int,
        quantity: int,
    ) -> int:
        """Calcula el nuevo stock según el tipo de movimiento."""

        if movement_type in {"ENTRADA", "DEVOLUCION"}:
            return previous_stock + quantity

        if movement_type == "SALIDA":
            new_stock = previous_stock - quantity

            if new_stock < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Stock insuficiente para realizar la salida.",
                )

            return new_stock

        if movement_type == "AJUSTE":
            return quantity

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de movimiento de inventario inválido.",
        )
