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
