from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.core.config import settings
from app.schemas.payment_session import PaymentSessionResponse
from app.services.payment_session_service import PaymentSessionService

router = APIRouter(prefix="/customer-display", tags=["Customer Display"])


def validate_customer_display_device(
    device_id: str,
    x_device_secret: str | None = Header(default=None, alias="X-Device-Secret"),
) -> None:
    """Valida que la tablet del cliente tenga permiso para consultar sesiones."""

    if not settings.customer_display_device_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La seguridad de la pantalla cliente no está configurada.",
        )

    if device_id != settings.customer_display_device_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dispositivo no autorizado.",
        )

    if x_device_secret != settings.customer_display_device_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clave del dispositivo inválida.",
        )


@router.get(
    "/sessions/{device_id}",
    response_model=list[PaymentSessionResponse],
)
def list_customer_display_sessions(
    device_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(validate_customer_display_device),
) -> list[PaymentSessionResponse]:
    service = PaymentSessionService(db)

    return service.list_active_sessions_by_device(device_id)
