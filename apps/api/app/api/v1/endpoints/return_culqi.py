from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.models.return_transaction import ReturnSettlementSession
from app.schemas.return_culqi import (
    ReturnCulqiChargeCreate,
    ReturnCulqiChargeResponse,
    ReturnCulqiOrderConfirm,
    ReturnCulqiOrderCreate,
    ReturnCulqiOrderResponse,
)
from app.services.customer_display_device_service import CustomerDisplayDeviceService
from app.services.return_culqi_service import ReturnCulqiService

router = APIRouter(prefix="/return-culqi", tags=["Return Culqi"])


def authorize_return_device(
    db: Session, session_id: UUID, device_id: str, device_token: str
) -> None:
    session = db.get(ReturnSettlementSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesion de diferencia no encontrada.")
    try:
        parsed_device_id = UUID(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Tablet invalida.") from exc
    if session.device_id != parsed_device_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La diferencia no pertenece a esta tablet.",
        )
    CustomerDisplayDeviceService().validate_device_token(
        db, device_id=parsed_device_id, device_token=device_token
    )


@router.post("/charges", response_model=ReturnCulqiChargeResponse)
def create_charge(
    payload: ReturnCulqiChargeCreate,
    db: Session = Depends(get_db),
    device_id: str = Header(alias="X-Device-Id"),
    device_token: str = Header(alias="X-Device-Token"),
) -> ReturnCulqiChargeResponse:
    authorize_return_device(
        db, payload.settlement_session_id, device_id, device_token
    )
    return ReturnCulqiService(db).create_charge(payload)


@router.post("/orders", response_model=ReturnCulqiOrderResponse)
def create_order(
    payload: ReturnCulqiOrderCreate,
    db: Session = Depends(get_db),
    device_id: str = Header(alias="X-Device-Id"),
    device_token: str = Header(alias="X-Device-Token"),
) -> ReturnCulqiOrderResponse:
    authorize_return_device(
        db, payload.settlement_session_id, device_id, device_token
    )
    return ReturnCulqiService(db).create_order(payload)


@router.post("/orders/confirm", response_model=ReturnCulqiOrderResponse)
def confirm_order(
    payload: ReturnCulqiOrderConfirm,
    db: Session = Depends(get_db),
    device_id: str = Header(alias="X-Device-Id"),
    device_token: str = Header(alias="X-Device-Token"),
) -> ReturnCulqiOrderResponse:
    authorize_return_device(
        db, payload.settlement_session_id, device_id, device_token
    )
    return ReturnCulqiService(db).confirm_order(payload)
