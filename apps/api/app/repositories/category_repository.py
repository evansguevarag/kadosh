from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product


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

    def find_all_with_product_count(self) -> list[tuple[Category, int]]:
        """Obtiene categorías activas e inactivas con su cantidad de productos."""

        statement = (
            select(Category, func.count(Product.id))
            .outerjoin(Product, Product.category_id == Category.id)
            .group_by(Category.id)
            .order_by(Category.name.asc())
        )

        return [
            (category, int(product_count))
            for category, product_count in self.db.execute(statement).all()
        ]

    def find_by_id(self, category_id: UUID) -> Category | None:
        """Obtiene una categoría por su identificador."""

        statement = select(Category).where(Category.id == category_id)

        return self.db.scalar(statement)

    def find_by_name(self, name: str) -> Category | None:
        """Obtiene una categoría por nombre sin distinguir mayúsculas."""

        statement = select(Category).where(
            func.lower(Category.name) == name.strip().lower(),
        )

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
