from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import ActiveStatusMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, ActiveStatusMixin, Base):
    """Modelo ORM para clientes de la tienda."""

    __tablename__ = "customers"

    document_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    document_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        index=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        index=True,
    )

    sales = relationship(
        "Sale",
        back_populates="customer",
    )
