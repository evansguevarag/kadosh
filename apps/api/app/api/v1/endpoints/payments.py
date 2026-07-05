from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=list[PaymentResponse])
def list_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[PaymentResponse]:
    service = PaymentService(db)

    return service.list_payments()


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> PaymentResponse:
    service = PaymentService(db)

    return service.get_payment_by_id(payment_id)


@router.get("/by-sale/{sale_id}", response_model=list[PaymentResponse])
def list_payments_by_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[PaymentResponse]:
    service = PaymentService(db)

    return service.list_payments_by_sale(sale_id)


@router.post(
    "/manual",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_manual_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> PaymentResponse:
    service = PaymentService(db)

    return service.register_manual_payment(payload, current_user)
