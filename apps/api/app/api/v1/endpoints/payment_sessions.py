from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.payment_session import (
    PaymentSessionCreate,
    PaymentSessionResponse,
    PaymentSessionStatusUpdate,
)
from app.services.payment_session_service import PaymentSessionService

router = APIRouter(prefix="/payment-sessions", tags=["Payment Sessions"])


@router.get("", response_model=list[PaymentSessionResponse])
def list_payment_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[PaymentSessionResponse]:
    service = PaymentSessionService(db)

    return service.list_payment_sessions()


@router.get("/{payment_session_id}", response_model=PaymentSessionResponse)
def get_payment_session(
    payment_session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> PaymentSessionResponse:
    service = PaymentSessionService(db)

    return service.get_payment_session_by_id(payment_session_id)


@router.get(
    "/by-sale/{sale_id}",
    response_model=list[PaymentSessionResponse],
)
def list_payment_sessions_by_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[PaymentSessionResponse]:
    service = PaymentSessionService(db)

    return service.list_payment_sessions_by_sale(sale_id)


@router.get(
    "/by-device/{device_id}",
    response_model=list[PaymentSessionResponse],
)
def list_active_sessions_by_device(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> list[PaymentSessionResponse]:
    service = PaymentSessionService(db)

    return service.list_active_sessions_by_device(device_id)


@router.post(
    "",
    response_model=PaymentSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment_session(
    payload: PaymentSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> PaymentSessionResponse:
    service = PaymentSessionService(db)

    return service.create_payment_session(payload, current_user)


@router.patch(
    "/{payment_session_id}/status",
    response_model=PaymentSessionResponse,
)
def update_payment_session_status(
    payment_session_id: UUID,
    payload: PaymentSessionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> PaymentSessionResponse:
    service = PaymentSessionService(db)

    return service.update_payment_session_status(payment_session_id, payload)
