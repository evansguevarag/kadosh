from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPrimaryKeyMixin


class AuditLog(UUIDPrimaryKeyMixin, Base):
    """Modelo ORM para auditoría de acciones importantes del sistema."""

    __tablename__ = "audit_logs"

    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    entity_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    entity_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    old_values: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    new_values: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    user = relationship(
        "User",
        back_populates="audit_logs",
    )
