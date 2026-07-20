from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.user import User


class UserRepository:
    """Repositorio de acceso a datos para usuarios."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def count_users(self) -> int:
        """Cuenta todos los usuarios registrados."""

        statement = select(func.count(User.id))
        result = self.db.scalar(statement)

        return int(result or 0)

    def count_active_by_role(self, role_name: str) -> int:
        statement = (
            select(func.count(User.id))
            .join(User.role)
            .where(User.is_active.is_(True), User.status == "ACTIVE")
            .where(User.role.has(name=role_name))
        )
        return int(self.db.scalar(statement) or 0)

    def find_all(self) -> list[User]:
        statement = (
            select(User)
            .options(joinedload(User.role))
            .order_by(
                User.is_active.desc(),
                User.first_name.asc(),
                User.paternal_last_name.asc(),
            )
        )
        return list(self.db.scalars(statement).unique().all())

    def find_by_id(self, user_id: UUID) -> User | None:
        """Obtiene un usuario por ID incluyendo su rol."""

        statement = (
            select(User)
            .options(joinedload(User.role))
            .where(User.id == user_id)
        )

        return self.db.scalar(statement)

    def find_by_email(self, email: str) -> User | None:
        """Obtiene un usuario por correo incluyendo su rol."""

        statement = (
            select(User)
            .options(joinedload(User.role))
            .where(User.email == email)
        )

        return self.db.scalar(statement)

    def find_by_document_number(self, document_number: str) -> User | None:
        statement = (
            select(User)
            .options(joinedload(User.role))
            .where(User.document_number == document_number)
        )
        return self.db.scalar(statement)

    def create(self, user: User) -> User:
        """Crea un nuevo usuario."""

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user

    def update(self, user: User) -> User:
        """Actualiza un usuario existente."""

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user
