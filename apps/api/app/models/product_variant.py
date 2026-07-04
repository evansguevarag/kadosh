from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import ActiveStatusMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ProductVariant(UUIDPrimaryKeyMixin, TimestampMixin, ActiveStatusMixin, Base):
    """Modelo ORM para variantes vendibles de un producto.

    Aquí se controla talla, color, SKU, precio y stock.
    """

    __tablename__ = "product_variants"

    product_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    sku: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    size: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    color: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
    )

    barcode: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    cost_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=0,
        server_default="0",
    )

    sale_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        index=True,
    )

    min_stock_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    product = relationship(
        "Product",
        back_populates="variants",
    )

    sale_items = relationship(
        "SaleItem",
        back_populates="product_variant",
    )

    inventory_movements = relationship(
        "InventoryMovement",
        back_populates="product_variant",
    )
