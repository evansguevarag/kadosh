from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.sale import SaleCreate, SaleResponse
from app.services.sale_service import SaleService

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("", response_model=list[SaleResponse])
def list_sales(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[SaleResponse]:
    service = SaleService(db)

    return service.list_sales(current_user, limit=limit, offset=offset)


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> SaleResponse:
    service = SaleService(db)

    return service.get_sale_by_id(sale_id, current_user)


@router.post(
    "",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> SaleResponse:
    service = SaleService(db)

    return service.create_sale(payload, current_user)


@router.patch("/{sale_id}/cancel", response_model=SaleResponse)
def cancel_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> SaleResponse:
    return SaleService(db).cancel_sale(sale_id, current_user)
