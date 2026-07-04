from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.schemas.payment_session import PaymentSessionResponse
from app.services.payment_session_service import PaymentSessionService

router = APIRouter(prefix="/customer-display", tags=["Customer Display"])


@router.get(
    "/sessions/{device_id}",
    response_model=list[PaymentSessionResponse],
)
def list_customer_display_sessions(
    device_id: str,
    db: Session = Depends(get_db),
) -> list[PaymentSessionResponse]:
    service = PaymentSessionService(db)

    return service.list_active_sessions_by_device(device_id)
