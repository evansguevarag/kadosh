from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPrimaryKeyMixin


class InventoryMovement(UUIDPrimaryKeyMixin, Base):
    """Modelo ORM para movimientos de inventario.

    Registra entradas, salidas, ajustes, devoluciones y salidas por venta.
    Esto permite auditar por qué cambió el stock de cada variante.
    """

    __tablename__ = "inventory_movements"

    product_variant_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("product_variants.id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    sale_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("sales.id", onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    movement_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    previous_stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    new_stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    product_variant = relationship(
        "ProductVariant",
        back_populates="inventory_movements",
    )

    user = relationship(
        "User",
        back_populates="inventory_movements",
    )

    sale = relationship(
        "Sale",
        back_populates="inventory_movements",
    )
