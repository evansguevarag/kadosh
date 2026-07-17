from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.payment import Payment


class PaymentRepository:
    """Repositorio de acceso a datos para pagos."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all(self, *, limit: int = 100, offset: int = 0) -> list[Payment]:
        """Obtiene todos los pagos."""

        statement = (
            select(Payment)
            .order_by(Payment.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, payment_id: UUID) -> Payment | None:
        """Obtiene un pago por su identificador."""

        statement = select(Payment).where(Payment.id == payment_id)

        return self.db.scalar(statement)

    def find_by_sale_id(self, sale_id: UUID) -> list[Payment]:
        """Obtiene todos los pagos de una venta."""

        statement = (
            select(Payment)
            .where(Payment.sale_id == sale_id)
            .order_by(Payment.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def create(self, payment: Payment) -> Payment:
        """Crea un nuevo pago."""

        self.db.add(payment)
        self.db.flush()
        self.db.refresh(payment)

        return payment

    def update(self, payment: Payment) -> Payment:
        """Actualiza un pago existente."""

        self.db.add(payment)
        self.db.flush()
        self.db.refresh(payment)

        return payment
