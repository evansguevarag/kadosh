from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.customer_display_device import (
    CustomerDisplayDeviceResponse,
    CustomerDisplayDeviceStatusResponse,
    CustomerDisplayDeviceTokenRequest,
    PairCustomerDisplayDeviceRequest,
    PairCustomerDisplayDeviceResponse,
    PairingCodeCreateRequest,
    PairingCodeCreateResponse,
)
from app.services.customer_display_device_service import (
    CustomerDisplayDeviceService,
)

router = APIRouter(
    prefix="/customer-display-devices",
    tags=["Customer Display Devices"],
)

service = CustomerDisplayDeviceService()


@router.get("", response_model=list[CustomerDisplayDeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> list[CustomerDisplayDeviceResponse]:
    return service.list_devices(db)


@router.post(
    "/pairing-codes",
    response_model=PairingCodeCreateResponse,
)
def create_pairing_code(
    payload: PairingCodeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> PairingCodeCreateResponse:
    return service.create_pairing_code(
        db,
        device_name=payload.device_name,
        created_by_user_id=None,
    )


@router.post(
    "/pair",
    response_model=PairCustomerDisplayDeviceResponse,
)
def pair_device(
    payload: PairCustomerDisplayDeviceRequest,
    db: Session = Depends(get_db),
) -> PairCustomerDisplayDeviceResponse:
    return service.pair_device(
        db,
        code=payload.code,
    )


@router.post(
    "/validate",
    response_model=CustomerDisplayDeviceStatusResponse,
)
def validate_device(
    payload: CustomerDisplayDeviceTokenRequest,
    db: Session = Depends(get_db),
) -> CustomerDisplayDeviceStatusResponse:
    return service.validate_device_token(
        db,
        device_id=payload.device_id,
        device_token=payload.device_token,
    )


@router.patch(
    "/{device_id}/deactivate",
    response_model=CustomerDisplayDeviceResponse,
)
def deactivate_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> CustomerDisplayDeviceResponse:
    return service.deactivate_device(
        db,
        device_id=device_id,
    )
