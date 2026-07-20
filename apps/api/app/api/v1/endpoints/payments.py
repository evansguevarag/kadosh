from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=list[PaymentResponse])
def list_payments(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[PaymentResponse]:
    service = PaymentService(db)

    return service.list_payments(limit=limit, offset=offset)


@router.get("/by-sale/{sale_id}", response_model=list[PaymentResponse])
def list_payments_by_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[PaymentResponse]:
    service = PaymentService(db)

    return service.list_payments_by_sale(sale_id)


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> PaymentResponse:
    service = PaymentService(db)

    return service.get_payment_by_id(payment_id)


@router.post(
    "/manual",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_manual_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> PaymentResponse:
    service = PaymentService(db)

    return service.register_manual_payment(payload, current_user)
