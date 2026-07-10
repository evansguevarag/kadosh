from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.models.payment_session import PaymentSession
from app.schemas.payment_session import PaymentSessionResponse
from app.schemas.sale import SaleResponse
from app.services.customer_display_device_service import (
    CustomerDisplayDeviceService,
)
from app.repositories.sale_repository import SaleRepository

router = APIRouter(prefix="/customer-display", tags=["Customer Display"])

device_service = CustomerDisplayDeviceService()


@router.get(
    "/sessions/{device_id}",
    response_model=list[PaymentSessionResponse],
)
def list_active_sessions_for_customer_display(
    device_id: UUID,
    db: Session = Depends(get_db),
    x_device_token: str = Header(alias="X-Device-Token"),
) -> list[PaymentSessionResponse]:
    device_service.validate_device_token(
        db,
        device_id=device_id,
        device_token=x_device_token,
    )

    now = datetime.now(timezone.utc)

    statement = (
        select(PaymentSession)
        .where(
            PaymentSession.device_id == str(device_id),
            PaymentSession.status.in_(
                [
                    "CREATED",
                    "SENT_TO_CUSTOMER",
                    "CUSTOMER_VIEWING",
                    "PROCESSING",
                ],
            ),
            PaymentSession.expires_at > now,
        )
        .order_by(PaymentSession.created_at.desc())
    )

    sessions = list(db.scalars(statement).all())

    return [
        PaymentSessionResponse.model_validate(session)
        for session in sessions
    ]


@router.get(
    "/sessions/{device_id}/{payment_session_id}/receipt",
    response_model=SaleResponse,
)
def get_customer_display_receipt(
    device_id: UUID,
    payment_session_id: UUID,
    db: Session = Depends(get_db),
    x_device_token: str = Header(alias="X-Device-Token"),
) -> SaleResponse:
    device_service.validate_device_token(
        db,
        device_id=device_id,
        device_token=x_device_token,
    )

    payment_session = db.scalar(
        select(PaymentSession).where(
            PaymentSession.id == payment_session_id,
            PaymentSession.device_id == str(device_id),
        )
    )

    if payment_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión de pago no encontrada para esta tablet.",
        )

    sale = SaleRepository(db).find_by_id(payment_session.sale_id)

    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada.",
        )

    return SaleResponse.model_validate(sale)

