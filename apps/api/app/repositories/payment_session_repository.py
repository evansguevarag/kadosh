from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.payment_session import PaymentSession


class PaymentSessionRepository:
    """Repositorio de acceso a datos para sesiones de pago."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all(self) -> list[PaymentSession]:
        """Obtiene todas las sesiones de pago."""

        statement = select(PaymentSession).order_by(
            PaymentSession.created_at.desc()
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, payment_session_id: UUID) -> PaymentSession | None:
        """Obtiene una sesión de pago por su identificador."""

        statement = select(PaymentSession).where(
            PaymentSession.id == payment_session_id
        )

        return self.db.scalar(statement)

    def find_by_id_for_update(
        self, payment_session_id: UUID
    ) -> PaymentSession | None:
        """Bloquea una sesion mientras se confirma un resultado de pago."""

        statement = (
            select(PaymentSession)
            .where(PaymentSession.id == payment_session_id)
            .with_for_update()
        )

        return self.db.scalar(statement)

    def find_by_sale_id(self, sale_id: UUID) -> list[PaymentSession]:
        """Obtiene las sesiones de pago asociadas a una venta."""

        statement = (
            select(PaymentSession)
            .where(PaymentSession.sale_id == sale_id)
            .order_by(PaymentSession.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_active_by_device_id(self, device_id: str) -> list[PaymentSession]:
        """Obtiene sesiones activas enviadas a una tablet o pantalla de cliente."""

        active_statuses = {
            "CREATED",
            "SENT_TO_CUSTOMER",
            "CUSTOMER_VIEWING",
            "PROCESSING",
        }

        statement = (
            select(PaymentSession)
            .where(
                PaymentSession.device_id == device_id,
                PaymentSession.status.in_(active_statuses),
            )
            .order_by(PaymentSession.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def create(self, payment_session: PaymentSession) -> PaymentSession:
        """Crea una nueva sesión de pago."""

        self.db.add(payment_session)
        self.db.flush()
        self.db.refresh(payment_session)

        return payment_session

    def update(self, payment_session: PaymentSession) -> PaymentSession:
        """Actualiza una sesión de pago existente."""

        self.db.add(payment_session)
        self.db.flush()
        self.db.refresh(payment_session)

        return payment_session
