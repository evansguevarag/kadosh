from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.repositories.audit_log_repository import AuditLogRepository


class AuditLogService:
    """Servicio de lógica para registrar y consultar auditoría."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit_log_repository = AuditLogRepository(db)

    def list_audit_logs(self) -> list[AuditLog]:
        """Lista todos los registros de auditoría."""

        return self.audit_log_repository.find_all()

    def list_audit_logs_by_user(self, user_id: UUID) -> list[AuditLog]:
        """Lista auditoría por usuario."""

        return self.audit_log_repository.find_by_user_id(user_id)

    def list_audit_logs_by_entity(
        self,
        entity_name: str,
        entity_id: UUID,
    ) -> list[AuditLog]:
        """Lista auditoría por entidad."""

        return self.audit_log_repository.find_by_entity(
            entity_name=entity_name.strip().upper(),
            entity_id=entity_id,
        )

    def register_action(
        self,
        action: str,
        entity_name: str,
        entity_id: UUID | None = None,
        current_user: User | None = None,
        old_values: dict | None = None,
        new_values: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        commit: bool = False,
    ) -> AuditLog:
        """Registra una acción importante del sistema."""

        audit_log = AuditLog(
            user_id=current_user.id if current_user else None,
            action=action.strip().upper(),
            entity_name=entity_name.strip().upper(),
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        created_audit_log = self.audit_log_repository.create(audit_log)

        if commit:
            self.db.commit()
            self.db.refresh(created_audit_log)

        return created_audit_log
