from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPrimaryKeyMixin


class SaleItem(UUIDPrimaryKeyMixin, Base):
    """Modelo ORM para el detalle de productos vendidos."""

    __tablename__ = "sale_items"

    sale_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("sales.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_variant_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("product_variants.id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    product_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    variant_sku: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    size: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    color: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=0,
        server_default="0",
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    sale = relationship(
        "Sale",
        back_populates="items",
    )

    product_variant = relationship(
        "ProductVariant",
        back_populates="sale_items",
    )
