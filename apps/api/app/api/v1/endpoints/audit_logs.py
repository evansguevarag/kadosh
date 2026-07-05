from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.services.audit_log_service import AuditLogService

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> list[AuditLogResponse]:
    service = AuditLogService(db)

    return service.list_audit_logs()


@router.get("/by-user/{user_id}", response_model=list[AuditLogResponse])
def list_audit_logs_by_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> list[AuditLogResponse]:
    service = AuditLogService(db)

    return service.list_audit_logs_by_user(user_id)


@router.get(
    "/by-entity/{entity_name}/{entity_id}",
    response_model=list[AuditLogResponse],
)
def list_audit_logs_by_entity(
    entity_name: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> list[AuditLogResponse]:
    service = AuditLogService(db)

    return service.list_audit_logs_by_entity(
        entity_name=entity_name,
        entity_id=entity_id,
    )
