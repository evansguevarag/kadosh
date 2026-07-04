from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPrimaryKeyMixin


class InventoryMovement(UUIDPrimaryKeyMixin, Base):
    """Modelo de movimientos de inventario."""

    __tablename__ = "inventory_movements"

    product_variant_id: Mapped[UUID] = mapped_column(
        ForeignKey("product_variants.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    sale_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sales.id"),
        nullable=True,
        index=True,
    )
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    new_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    product_variant = relationship("ProductVariant", back_populates="inventory_movements")
    user = relationship("User", back_populates="inventory_movements")
    sale = relationship("Sale", back_populates="inventory_movements")
