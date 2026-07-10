from fastapi import APIRouter, Depends, status
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
from app.services.culqi_service import CulqiService

router = APIRouter(prefix="/culqi", tags=["Culqi"])


@router.post(
    "/charges",
    response_model=CulqiChargeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_culqi_charge(
    payload: CulqiChargeCreate,
    db: Session = Depends(get_db),
) -> CulqiChargeResponse:
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
) -> CulqiOrderCreateResponse:
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
) -> CulqiOrderConfirmResponse:
    service = CulqiService(db)

    return service.confirm_order(payload)
