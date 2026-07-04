from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.schemas.culqi import CulqiChargeCreate, CulqiChargeResponse
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
