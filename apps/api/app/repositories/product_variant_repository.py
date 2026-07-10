from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product_variant import ProductVariant


class ProductVariantRepository:
    """Repositorio de acceso a datos para variantes de productos."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all_active(self) -> list[ProductVariant]:
        """Obtiene todas las variantes activas."""

        statement = (
            select(ProductVariant)
            .where(ProductVariant.is_active.is_(True))
            .order_by(ProductVariant.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_all(self) -> list[ProductVariant]:
        """Obtiene todas las variantes."""

        statement = select(ProductVariant).order_by(ProductVariant.created_at.desc())

        return list(self.db.scalars(statement).all())

    def find_by_product_id(self, product_id: UUID) -> list[ProductVariant]:
        """Obtiene las variantes activas de un producto."""

        statement = (
            select(ProductVariant)
            .where(
                ProductVariant.product_id == product_id,
                ProductVariant.is_active.is_(True),
            )
            .order_by(ProductVariant.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, variant_id: UUID) -> ProductVariant | None:
        """Obtiene una variante por su identificador."""

        statement = select(ProductVariant).where(ProductVariant.id == variant_id)

        return self.db.scalar(statement)

    def find_by_sku(self, sku: str) -> ProductVariant | None:
        """Obtiene una variante por SKU exacto."""

        statement = select(ProductVariant).where(ProductVariant.sku == sku)

        return self.db.scalar(statement)

    def find_by_barcode(self, barcode: str) -> ProductVariant | None:
        """Obtiene una variante por código de barras."""

        statement = select(ProductVariant).where(ProductVariant.barcode == barcode)

        return self.db.scalar(statement)

    def find_by_code(self, code: str) -> ProductVariant | None:
        """Obtiene una variante por código de barras o SKU."""

        statement = select(ProductVariant).where(
            (ProductVariant.barcode == code) | (ProductVariant.sku == code)
        )

        return self.db.scalar(statement)

    def create(self, variant: ProductVariant) -> ProductVariant:
        """Crea una nueva variante."""

        self.db.add(variant)
        self.db.commit()
        self.db.refresh(variant)

        return variant

    def update(self, variant: ProductVariant) -> ProductVariant:
        """Actualiza una variante existente."""

        self.db.add(variant)
        self.db.commit()
        self.db.refresh(variant)

        return variant
