from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.inventory_movement import (
    InventoryMovementCreate,
    InventoryMovementResponse,
)
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get(
    "/movements",
    response_model=list[InventoryMovementResponse],
)
def list_inventory_movements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[InventoryMovementResponse]:
    service = InventoryService(db)

    return service.list_movements()


@router.get(
    "/movements/by-variant/{product_variant_id}",
    response_model=list[InventoryMovementResponse],
)
def list_inventory_movements_by_variant(
    product_variant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[InventoryMovementResponse]:
    service = InventoryService(db)

    return service.list_movements_by_variant(product_variant_id)


@router.post(
    "/movements",
    response_model=InventoryMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_inventory_movement(
    payload: InventoryMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER")),
) -> InventoryMovementResponse:
    service = InventoryService(db)

    return service.register_manual_movement(payload, current_user)
