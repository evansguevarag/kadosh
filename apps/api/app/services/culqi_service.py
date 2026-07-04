from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.payment import Payment
from app.repositories.payment_repository import PaymentRepository
from app.repositories.payment_session_repository import PaymentSessionRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.culqi import CulqiChargeCreate, CulqiChargeResponse


CULQI_CHARGES_URL = "https://api.culqi.com/v2/charges"


class CulqiService:
    """Servicio para procesar pagos con Culqi."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.payment_repository = PaymentRepository(db)
        self.payment_session_repository = PaymentSessionRepository(db)
        self.sale_repository = SaleRepository(db)

    def create_charge(self, payload: CulqiChargeCreate) -> CulqiChargeResponse:
        """Crea un cargo único en Culqi usando el token generado en el frontend."""

        if not settings.culqi_secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="La llave secreta de Culqi no está configurada.",
            )

        payment_session = self.payment_session_repository.find_by_id(
            payload.payment_session_id
        )

        if payment_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de pago no encontrada.",
            )

        if payment_session.status in {"PAID", "FAILED", "EXPIRED", "CANCELLED"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La sesión de pago ya se encuentra en un estado final.",
            )

        now = datetime.now(timezone.utc)

        if payment_session.expires_at < now:
            payment_session.status = "EXPIRED"
            payment_session.completed_at = now
            self.payment_session_repository.update(payment_session)
            self.db.commit()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sesión de pago ya expiró.",
            )

        sale = self.sale_repository.find_by_id(payment_session.sale_id)

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
                detail="No se puede pagar una venta cancelada.",
            )

        amount_in_cents = self._to_cents(payment_session.amount)

        culqi_payload = {
            "amount": amount_in_cents,
            "currency_code": payment_session.currency,
            "email": str(payload.email),
            "source_id": payload.token_id,
            "capture": True,
            "description": f"Venta {sale.sale_number}",
            "metadata": {
                "sale_id": str(sale.id),
                "payment_session_id": str(payment_session.id),
                "sale_number": sale.sale_number,
            },
        }

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.culqi_secret_key}",
        }

        payment_session.status = "PROCESSING"
        payment_session.processing_at = now

        try:
            self.payment_session_repository.update(payment_session)
            self.db.flush()

            with httpx.Client(timeout=20) as client:
                response = client.post(
                    CULQI_CHARGES_URL,
                    headers=headers,
                    json=culqi_payload,
                )

            response_data = response.json()

            if response.status_code >= 400:
                return self._mark_charge_as_failed(
                    payment_session_id=payment_session.id,
                    sale_id=sale.id,
                    amount=payment_session.amount,
                    currency=payment_session.currency,
                    response_data=response_data,
                )

            charge_id = str(response_data.get("id") or "")
            outcome = response_data.get("outcome") or {}
            operation_code = str(
                response_data.get("reference_code")
                or response_data.get("authorization_code")
                or charge_id
            )

            payment = Payment(
                sale_id=sale.id,
                payment_method="CULQI",
                provider="CULQI",
                amount=payment_session.amount,
                currency=payment_session.currency,
                status="PAID",
                operation_code=operation_code,
                provider_order_id=None,
                provider_transaction_id=charge_id,
                culqi_charge_id=charge_id,
                raw_response=response_data,
                paid_at=datetime.now(timezone.utc),
                failed_at=None,
            )

            created_payment = self.payment_repository.create(payment)

            sale.status = "PAID"
            sale.paid_at = datetime.now(timezone.utc)
            self.sale_repository.update(sale)

            payment_session.payment_id = created_payment.id
            payment_session.status = "PAID"
            payment_session.completed_at = datetime.now(timezone.utc)
            self.payment_session_repository.update(payment_session)

            self.db.commit()
            self.db.refresh(created_payment)
            self.db.refresh(payment_session)

            message = str(
                outcome.get("user_message")
                or "Pago aprobado correctamente por Culqi."
            )

            return CulqiChargeResponse(
                payment_id=created_payment.id,
                payment_session_id=payment_session.id,
                sale_id=sale.id,
                status="PAID",
                message=message,
            )
        except HTTPException:
            self.db.rollback()
            raise
        except httpx.TimeoutException as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="La conexión con Culqi demoró demasiado.",
            ) from exc
        except httpx.HTTPError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo conectar con Culqi.",
            ) from exc
        except Exception:
            self.db.rollback()
            raise

    def _mark_charge_as_failed(
        self,
        payment_session_id: UUID,
        sale_id: UUID,
        amount: Decimal,
        currency: str,
        response_data: dict,
    ) -> CulqiChargeResponse:
        """Registra un intento fallido de pago Culqi."""

        payment_session = self.payment_session_repository.find_by_id(payment_session_id)

        if payment_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de pago no encontrada.",
            )

        error_data = response_data.get("merchant_message") or response_data.get(
            "user_message"
        )
        message = str(error_data or "Culqi rechazó el pago.")

        payment = Payment(
            sale_id=sale_id,
            payment_method="CULQI",
            provider="CULQI",
            amount=amount,
            currency=currency,
            status="FAILED",
            operation_code=None,
            provider_order_id=None,
            provider_transaction_id=None,
            culqi_charge_id=None,
            raw_response=response_data,
            paid_at=None,
            failed_at=datetime.now(timezone.utc),
        )

        created_payment = self.payment_repository.create(payment)

        payment_session.payment_id = created_payment.id
        payment_session.status = "FAILED"
        payment_session.completed_at = datetime.now(timezone.utc)
        self.payment_session_repository.update(payment_session)

        self.db.commit()
        self.db.refresh(created_payment)
        self.db.refresh(payment_session)

        return CulqiChargeResponse(
            payment_id=created_payment.id,
            payment_session_id=payment_session.id,
            sale_id=sale_id,
            status="FAILED",
            message=message,
        )

    def _to_cents(self, amount: Decimal) -> int:
        """Convierte monto decimal en soles a céntimos para Culqi."""

        return int((amount * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
