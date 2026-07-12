from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPrimaryKeyMixin


class ReturnTransaction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "return_transactions"

    return_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    original_sale_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("sales.id"), index=True
    )
    processed_by_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("users.id")
    )
    transaction_type: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(String(40))
    item_condition: Mapped[str] = mapped_column(String(30))
    inventory_resolution: Mapped[str] = mapped_column(String(30))
    returned_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    replacement_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    difference_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    settlement_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items = relationship("ReturnItem", cascade="all, delete-orphan", lazy="selectin")
    replacements = relationship(
        "ReplacementItem", cascade="all, delete-orphan", lazy="selectin"
    )


class ReturnItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "return_items"

    return_transaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("return_transactions.id", ondelete="CASCADE")
    )
    sale_item_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("sale_items.id")
    )
    quantity: Mapped[int] = mapped_column(Integer)
    unit_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class ReplacementItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "replacement_items"

    return_transaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("return_transactions.id", ondelete="CASCADE")
    )
    product_variant_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("product_variants.id")
    )
    product_name: Mapped[str] = mapped_column(String(150))
    variant_sku: Mapped[str] = mapped_column(String(80))
    size: Mapped[str | None] = mapped_column(String(30), nullable=True)
    color: Mapped[str | None] = mapped_column(String(60), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
