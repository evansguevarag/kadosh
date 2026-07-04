from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Modelo ORM para pagos de ventas.

    Soporta pagos manuales como efectivo, Yape, Plin, POS y pagos
    procesados por Culqi.
    """

    __tablename__ = "payments"

    sale_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("sales.id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    payment_method: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    provider: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="MANUAL",
        server_default="MANUAL",
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="PEN",
        server_default="PEN",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
        index=True,
    )

    operation_code: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    provider_order_id: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        index=True,
    )

    culqi_charge_id: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    raw_response: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    sale = relationship(
        "Sale",
        back_populates="payments",
    )

    payment_sessions = relationship(
        "PaymentSession",
        back_populates="payment",
    )
