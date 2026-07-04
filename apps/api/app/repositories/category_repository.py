from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category


class CategoryRepository:
    """Repositorio de acceso a datos para categorías."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all_active(self) -> list[Category]:
        """Obtiene todas las categorías activas ordenadas por nombre."""

        statement = (
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.name.asc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, category_id: UUID) -> Category | None:
        """Obtiene una categoría por su identificador."""

        statement = select(Category).where(Category.id == category_id)

        return self.db.scalar(statement)

    def find_by_name(self, name: str) -> Category | None:
        """Obtiene una categoría por nombre exacto."""

        statement = select(Category).where(Category.name == name)

        return self.db.scalar(statement)

    def create(self, category: Category) -> Category:
        """Crea una nueva categoría."""

        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)

        return category

    def update(self, category: Category) -> Category:
        """Actualiza una categoría existente."""

        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)

        return category
