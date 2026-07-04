from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import ActiveStatusMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Product(UUIDPrimaryKeyMixin, TimestampMixin, ActiveStatusMixin, Base):
    """Modelo ORM para productos base de la tienda.

    Un producto base no guarda talla, color ni stock.
    Esos datos pertenecen a product_variants.
    """

    __tablename__ = "products"

    category_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("categories.id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    brand: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    category = relationship(
        "Category",
        back_populates="products",
    )

    variants = relationship(
        "ProductVariant",
        back_populates="product",
    )
