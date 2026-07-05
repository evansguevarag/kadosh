from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.models.user import User
from app.repositories.payment_repository import PaymentRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.payment import PaymentCreate
from app.services.audit_log_service import AuditLogService


ALLOWED_PAYMENT_METHODS = {
    "CASH",
    "YAPE",
    "PLIN",
    "TRANSFER",
    "POS",
    "CULQI",
}


MANUAL_PAYMENT_METHODS = {
    "CASH",
    "YAPE",
    "PLIN",
    "TRANSFER",
    "POS",
}


class PaymentService:
    """Servicio de lógica de negocio para pagos."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.payment_repository = PaymentRepository(db)
        self.sale_repository = SaleRepository(db)
        self.audit_log_service = AuditLogService(db)

    def list_payments(self) -> list[Payment]:
        """Lista todos los pagos registrados."""

        return self.payment_repository.find_all()

    def list_payments_by_sale(self, sale_id: UUID) -> list[Payment]:
        """Lista los pagos de una venta."""

        sale = self.sale_repository.find_by_id(sale_id)

        if sale is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada.",
            )

        return self.payment_repository.find_by_sale_id(sale_id)

    def get_payment_by_id(self, payment_id: UUID) -> Payment:
        """Obtiene un pago por ID."""

        payment = self.payment_repository.find_by_id(payment_id)

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pago no encontrado.",
            )

        return payment

    def register_manual_payment(
        self,
        payload: PaymentCreate,
        current_user: User | None = None,
    ) -> Payment:
        """Registra un pago manual y actualiza el estado de la venta si corresponde."""

        payment_method = payload.payment_method.strip().upper()
        currency = payload.currency.strip().upper()

        if payment_method not in ALLOWED_PAYMENT_METHODS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Método de pago inválido.",
            )

        if payment_method not in MANUAL_PAYMENT_METHODS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este endpoint solo registra pagos manuales.",
            )

        if currency != "PEN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Por ahora solo se aceptan pagos en PEN.",
            )

        sale = self.sale_repository.find_by_id(payload.sale_id)

        if sale is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada.",
            )

        if sale.status == "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede registrar un pago para una venta cancelada.",
            )

        if sale.status == "PAID":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La venta ya se encuentra pagada.",
            )

        current_paid_amount = self._get_successful_paid_amount(sale.id)
        next_paid_amount = current_paid_amount + payload.amount

        if next_paid_amount > sale.total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El monto pagado supera el total pendiente de la venta.",
            )

        payment = Payment(
            sale_id=sale.id,
            payment_method=payment_method,
            provider="MANUAL",
            amount=payload.amount,
            currency=currency,
            status="PAID",
            operation_code=payload.operation_code.strip()
            if payload.operation_code
            else None,
            provider_order_id=None,
            provider_transaction_id=None,
            culqi_charge_id=None,
            raw_response=None,
            paid_at=datetime.now(timezone.utc),
            failed_at=None,
        )

        try:
            created_payment = self.payment_repository.create(payment)

            sale_previous_status = sale.status

            if next_paid_amount == sale.total:
                sale.status = "PAID"
                sale.paid_at = datetime.now(timezone.utc)
                self.sale_repository.update(sale)

            self.audit_log_service.register_action(
                action="REGISTRAR_PAGO_MANUAL",
                entity_name="PAYMENT",
                entity_id=created_payment.id,
                current_user=current_user,
                new_values={
                    "sale_id": str(sale.id),
                    "sale_number": sale.sale_number,
                    "payment_method": created_payment.payment_method,
                    "provider": created_payment.provider,
                    "amount": str(created_payment.amount),
                    "currency": created_payment.currency,
                    "status": created_payment.status,
                    "operation_code": created_payment.operation_code,
                    "sale_previous_status": sale_previous_status,
                    "sale_current_status": sale.status,
                },
            )

            self.db.commit()
            self.db.refresh(created_payment)

            return created_payment
        except Exception:
            self.db.rollback()
            raise

    def _get_successful_paid_amount(self, sale_id: UUID) -> Decimal:
        """Calcula el total ya pagado correctamente para una venta."""

        payments = self.payment_repository.find_by_sale_id(sale_id)

        return sum(
            (payment.amount for payment in payments if payment.status == "PAID"),
            Decimal("0.00"),
        )
