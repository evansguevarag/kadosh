from sqlalchemy.orm import Session

from app.models.role import Role
from app.repositories.role_repository import RoleRepository


class RoleService:
    """Servicio de negocio para roles del sistema."""

    def __init__(self, db: Session) -> None:
        self.repository = RoleRepository(db)

    def list_active_roles(self) -> list[Role]:
        """Lista todos los roles activos del sistema."""

        return self.repository.find_all_active()
