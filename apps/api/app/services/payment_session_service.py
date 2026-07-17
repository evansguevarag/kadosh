from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.payment_session import PaymentSession
from app.models.user import User
from app.repositories.payment_session_repository import PaymentSessionRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.payment_session import (
    PaymentSessionCreate,
    PaymentSessionStatusUpdate,
)
from app.services.audit_log_service import AuditLogService


ALLOWED_PAYMENT_SESSION_STATUSES = {
    "CUSTOMER_VIEWING",
    "PROCESSING",
    "EXPIRED",
    "CANCELLED",
}

PAYMENT_SESSION_TRANSITIONS = {
    "SENT_TO_CUSTOMER": {"CUSTOMER_VIEWING", "EXPIRED", "CANCELLED"},
    "CUSTOMER_VIEWING": {"PROCESSING", "EXPIRED", "CANCELLED"},
    "PROCESSING": set(),
}


FINAL_PAYMENT_SESSION_STATUSES = {
    "PAID",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
}


class PaymentSessionService:
    """Servicio de lógica de negocio para sesiones de pago."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.payment_session_repository = PaymentSessionRepository(db)
        self.sale_repository = SaleRepository(db)
        self.audit_log_service = AuditLogService(db)

    def list_payment_sessions(self) -> list[PaymentSession]:
        """Lista todas las sesiones de pago."""

        return self.payment_session_repository.find_all()

    def get_payment_session_by_id(
        self,
        payment_session_id: UUID,
    ) -> PaymentSession:
        """Obtiene una sesión de pago por ID."""

        payment_session = self.payment_session_repository.find_by_id(
            payment_session_id
        )

        if payment_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de pago no encontrada.",
            )

        return payment_session

    def list_payment_sessions_by_sale(self, sale_id: UUID) -> list[PaymentSession]:
        """Lista sesiones de pago asociadas a una venta."""

        sale = self.sale_repository.find_by_id(sale_id)

        if sale is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada.",
            )

        return self.payment_session_repository.find_by_sale_id(sale_id)

    def list_active_sessions_by_device(self, device_id: str) -> list[PaymentSession]:
        """Lista sesiones activas enviadas a una tablet o pantalla de cliente."""

        normalized_device_id = device_id.strip()

        if not normalized_device_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El identificador del dispositivo es obligatorio.",
            )

        return self.payment_session_repository.find_active_by_device_id(
            normalized_device_id
        )

    def create_payment_session(
        self,
        payload: PaymentSessionCreate,
        current_user: User,
    ) -> PaymentSession:
        """Crea una sesión de pago para enviar una venta a la pantalla del cliente."""

        sale = self.sale_repository.find_by_id(payload.sale_id)

        if sale is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada.",
            )

        if sale.status == "PAID":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La venta ya se encuentra pagada.",
            )

        if sale.status == "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede crear una sesión para una venta cancelada.",
            )

        payment_session = PaymentSession(
            sale_id=sale.id,
            payment_id=None,
            seller_id=current_user.id,
            device_id=payload.device_id.strip(),
            status="SENT_TO_CUSTOMER",
            amount=sale.total,
            currency="PEN",
            customer_message=payload.customer_message.strip()
            if payload.customer_message
            else None,
            receipt_email=str(payload.receipt_email).strip().lower()
            if payload.receipt_email
            else None,
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=payload.expires_in_minutes),
            viewed_at=None,
            processing_at=None,
            completed_at=None,
            cancelled_at=None,
        )

        try:
            created_session = self.payment_session_repository.create(payment_session)

            self.audit_log_service.register_action(
                action="CREAR_SESION_PAGO",
                entity_name="PAYMENT_SESSION",
                entity_id=created_session.id,
                current_user=current_user,
                new_values={
                    "sale_id": str(created_session.sale_id),
                    "device_id": created_session.device_id,
                    "status": created_session.status,
                    "amount": str(created_session.amount),
                    "currency": created_session.currency,
                    "receipt_email": created_session.receipt_email,
                    "expires_at": created_session.expires_at.isoformat(),
                },
            )

            self.db.commit()
            self.db.refresh(created_session)

            return created_session
        except Exception:
            self.db.rollback()
            raise

    def update_payment_session_status(
        self,
        payment_session_id: UUID,
        payload: PaymentSessionStatusUpdate,
        current_user: User | None = None,
    ) -> PaymentSession:
        """Actualiza el estado de una sesión de pago."""

        payment_session = self.payment_session_repository.find_by_id_for_update(
            payment_session_id
        )
        if payment_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesion de pago no encontrada.",
            )
        previous_status = payment_session.status
        next_status = payload.status.strip().upper()

        if next_status not in ALLOWED_PAYMENT_SESSION_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estado de sesión de pago inválido.",
            )

        if payment_session.status in FINAL_PAYMENT_SESSION_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La sesión de pago ya se encuentra en un estado final.",
            )

        allowed_transitions = PAYMENT_SESSION_TRANSITIONS.get(
            payment_session.status,
            set(),
        )
        if next_status not in allowed_transitions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"No se puede cambiar la sesion de {payment_session.status} "
                    f"a {next_status}."
                ),
            )

        now = datetime.now(timezone.utc)

        if payment_session.expires_at < now and next_status not in {
            "EXPIRED",
            "CANCELLED",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sesión de pago ya expiró.",
            )

        payment_session.status = next_status

        if next_status == "CUSTOMER_VIEWING":
            payment_session.viewed_at = now

        if next_status == "PROCESSING":
            payment_session.processing_at = now

        if next_status == "CANCELLED":
            payment_session.cancelled_at = now

        if next_status == "EXPIRED":
            payment_session.completed_at = now

        try:
            updated_session = self.payment_session_repository.update(payment_session)

            self.audit_log_service.register_action(
                action="ACTUALIZAR_ESTADO_SESION_PAGO",
                entity_name="PAYMENT_SESSION",
                entity_id=updated_session.id,
                current_user=current_user,
                old_values={
                    "status": previous_status,
                },
                new_values={
                    "status": updated_session.status,
                    "viewed_at": updated_session.viewed_at.isoformat()
                    if updated_session.viewed_at
                    else None,
                    "processing_at": updated_session.processing_at.isoformat()
                    if updated_session.processing_at
                    else None,
                    "completed_at": updated_session.completed_at.isoformat()
                    if updated_session.completed_at
                    else None,
                    "cancelled_at": updated_session.cancelled_at.isoformat()
                    if updated_session.cancelled_at
                    else None,
                },
            )

            self.db.commit()
            self.db.refresh(updated_session)

            return updated_session
        except Exception:
            self.db.rollback()
            raise
