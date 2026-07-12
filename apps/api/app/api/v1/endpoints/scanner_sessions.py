from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.scanner_session import (
    ScannerScanCreate,
    ScannerScanResponse,
    ScannerSessionCreateResponse,
    ScannerSessionPollResponse,
    ScannerSessionCreate,
)
from app.services.scanner_session_service import ScannerSessionService

router = APIRouter(prefix="/scanner-sessions", tags=["Scanner Sessions"])


@router.post(
    "",
    response_model=ScannerSessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_scanner_session(
    payload: ScannerSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> ScannerSessionCreateResponse:
    service = ScannerSessionService(db)

    return service.create_session(current_user, payload.purpose)


@router.get("/{session_id}/scans", response_model=ScannerSessionPollResponse)
def poll_scanner_session(
    session_id: UUID,
    after_scan_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> ScannerSessionPollResponse:
    service = ScannerSessionService(db)

    return service.poll_session(
        session_id=session_id,
        after_scan_id=after_scan_id,
    )


@router.post(
    "/{session_id}/scans",
    response_model=ScannerScanResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_scanner_scan(
    session_id: UUID,
    payload: ScannerScanCreate,
    db: Session = Depends(get_db),
) -> ScannerScanResponse:
    service = ScannerSessionService(db)

    return service.register_scan(
        session_id=session_id,
        pairing_token=payload.pairing_token,
        code=payload.code,
    )
