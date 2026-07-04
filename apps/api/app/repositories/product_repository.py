from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product


class ProductRepository:
    """Repositorio de acceso a datos para productos."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all_active(self) -> list[Product]:
        """Obtiene todos los productos activos ordenados por fecha de creación."""

        statement = (
            select(Product)
            .where(Product.is_active.is_(True))
            .order_by(Product.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, product_id: UUID) -> Product | None:
        """Obtiene un producto por su identificador."""

        statement = select(Product).where(Product.id == product_id)

        return self.db.scalar(statement)

    def find_by_name(self, name: str) -> Product | None:
        """Obtiene un producto por nombre exacto."""

        statement = select(Product).where(Product.name == name)

        return self.db.scalar(statement)

    def create(self, product: Product) -> Product:
        """Crea un nuevo producto."""

        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)

        return product

    def update(self, product: Product) -> Product:
        """Actualiza un producto existente."""

        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)

        return product
