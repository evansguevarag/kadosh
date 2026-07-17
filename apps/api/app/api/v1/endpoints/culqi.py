from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.schemas.culqi import (
    CulqiChargeCreate,
    CulqiChargeResponse,
    CulqiOrderConfirm,
    CulqiOrderConfirmResponse,
    CulqiOrderCreate,
    CulqiOrderCreateResponse,
)
from app.repositories.payment_session_repository import PaymentSessionRepository
from app.services.culqi_service import CulqiService
from app.services.customer_display_device_service import CustomerDisplayDeviceService

router = APIRouter(prefix="/culqi", tags=["Culqi"])


def authorize_device(
    db: Session,
    payment_session_id: UUID,
    device_id: str,
    device_token: str,
) -> None:
    payment_session = PaymentSessionRepository(db).find_by_id(payment_session_id)
    if payment_session is None:
        raise HTTPException(status_code=404, detail="Sesion de pago no encontrada.")
    if payment_session.device_id != device_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La sesion de pago no pertenece a esta tablet.",
        )
    try:
        parsed_device_id = UUID(device_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La identidad de la tablet no es valida.",
        ) from exc
    CustomerDisplayDeviceService().validate_device_token(
        db,
        device_id=parsed_device_id,
        device_token=device_token,
    )


@router.post(
    "/charges",
    response_model=CulqiChargeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_culqi_charge(
    payload: CulqiChargeCreate,
    db: Session = Depends(get_db),
    device_id: str = Header(alias="X-Device-Id"),
    device_token: str = Header(alias="X-Device-Token"),
) -> CulqiChargeResponse:
    authorize_device(db, payload.payment_session_id, device_id, device_token)
    service = CulqiService(db)

    return service.create_charge(payload)


@router.post(
    "/orders",
    response_model=CulqiOrderCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_culqi_order(
    payload: CulqiOrderCreate,
    db: Session = Depends(get_db),
    device_id: str = Header(alias="X-Device-Id"),
    device_token: str = Header(alias="X-Device-Token"),
) -> CulqiOrderCreateResponse:
    authorize_device(db, payload.payment_session_id, device_id, device_token)
    service = CulqiService(db)

    return service.create_order(payload)


@router.post(
    "/orders/confirm",
    response_model=CulqiOrderConfirmResponse,
    status_code=status.HTTP_200_OK,
)
def confirm_culqi_order(
    payload: CulqiOrderConfirm,
    db: Session = Depends(get_db),
    device_id: str = Header(alias="X-Device-Id"),
    device_token: str = Header(alias="X-Device-Token"),
) -> CulqiOrderConfirmResponse:
    authorize_device(db, payload.payment_session_id, device_id, device_token)
    service = CulqiService(db)

    return service.confirm_order(payload)
