from uuid import UUID

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.product_variant import ProductVariant
from app.models.return_transaction import ReturnInventoryReservation


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

    def find_by_id_for_update(self, variant_id: UUID) -> ProductVariant | None:
        """Obtiene y bloquea una variante hasta finalizar la transaccion actual."""

        statement = (
            select(ProductVariant)
            .where(ProductVariant.id == variant_id)
            .with_for_update()
        )

        return self.db.scalar(statement)

    def active_reserved_quantity(self, variant_id: UUID) -> int:
        statement = select(
            func.coalesce(func.sum(ReturnInventoryReservation.quantity), 0)
        ).where(
            ReturnInventoryReservation.product_variant_id == variant_id,
            ReturnInventoryReservation.status == "ACTIVE",
            ReturnInventoryReservation.expires_at > datetime.now(timezone.utc),
        )
        return int(self.db.scalar(statement) or 0)

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
