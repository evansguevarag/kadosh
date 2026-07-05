from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditLogRepository:
    """Repositorio de acceso a datos para auditoría."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all(self) -> list[AuditLog]:
        """Obtiene todos los registros de auditoría."""

        statement = select(AuditLog).order_by(AuditLog.created_at.desc())

        return list(self.db.scalars(statement).all())

    def find_by_user_id(self, user_id: UUID) -> list[AuditLog]:
        """Obtiene registros de auditoría por usuario."""

        statement = (
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_entity(
        self,
        entity_name: str,
        entity_id: UUID,
    ) -> list[AuditLog]:
        """Obtiene registros de auditoría por entidad."""

        statement = (
            select(AuditLog)
            .where(
                AuditLog.entity_name == entity_name,
                AuditLog.entity_id == entity_id,
            )
            .order_by(AuditLog.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def create(self, audit_log: AuditLog) -> AuditLog:
        """Registra una acción de auditoría."""

        self.db.add(audit_log)
        self.db.flush()
        self.db.refresh(audit_log)

        return audit_log
