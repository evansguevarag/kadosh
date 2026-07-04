from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.role import Role


class RoleRepository:
    """Repositorio de acceso a datos para roles."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all_active(self) -> list[Role]:
        """Obtiene todos los roles activos ordenados por nombre."""

        statement = (
            select(Role)
            .where(Role.is_active.is_(True))
            .order_by(Role.name.asc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_name(self, name: str) -> Role | None:
        """Obtiene un rol por nombre exacto."""

        statement = select(Role).where(Role.name == name)

        return self.db.scalar(statement)
