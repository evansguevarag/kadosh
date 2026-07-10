from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.payment import Payment
from app.repositories.payment_repository import PaymentRepository
from app.repositories.payment_session_repository import PaymentSessionRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.culqi import (
    CulqiChargeCreate,
    CulqiChargeResponse,
    CulqiOrderConfirm,
    CulqiOrderConfirmResponse,
    CulqiOrderCreate,
    CulqiOrderCreateResponse,
)
from app.services.audit_log_service import AuditLogService


CULQI_CHARGES_URL = "https://api.culqi.com/v2/charges"
CULQI_ORDERS_URL = "https://api.culqi.com/v2/orders"
FINAL_PAYMENT_SESSION_STATUSES = {"PAID", "FAILED", "EXPIRED", "CANCELLED"}
CULQI_PAID_ORDER_STATES = {"paid"}


class CulqiService:
    """Servicio para procesar pagos con Culqi."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.payment_repository = PaymentRepository(db)
        self.payment_session_repository = PaymentSessionRepository(db)
        self.sale_repository = SaleRepository(db)
        self.audit_log_service = AuditLogService(db)

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

            self.audit_log_service.register_action(
                action="EXPIRAR_SESION_PAGO_CULQI",
                entity_name="PAYMENT_SESSION",
                entity_id=payment_session.id,
                new_values={
                    "status": payment_session.status,
                    "completed_at": payment_session.completed_at.isoformat(),
                },
            )

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

        previous_session_status = payment_session.status
        payment_session.status = "PROCESSING"
        payment_session.processing_at = now

        try:
            self.payment_session_repository.update(payment_session)

            self.audit_log_service.register_action(
                action="PROCESAR_PAGO_CULQI",
                entity_name="PAYMENT_SESSION",
                entity_id=payment_session.id,
                old_values={
                    "status": previous_session_status,
                },
                new_values={
                    "status": payment_session.status,
                    "processing_at": payment_session.processing_at.isoformat()
                    if payment_session.processing_at
                    else None,
                    "amount": str(payment_session.amount),
                    "currency": payment_session.currency,
                    "sale_id": str(sale.id),
                    "sale_number": sale.sale_number,
                },
            )

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

            previous_sale_status = sale.status
            sale.status = "PAID"
            sale.paid_at = datetime.now(timezone.utc)
            self.sale_repository.update(sale)

            payment_session.payment_id = created_payment.id
            payment_session.status = "PAID"
            payment_session.completed_at = datetime.now(timezone.utc)
            self.payment_session_repository.update(payment_session)

            self.audit_log_service.register_action(
                action="PAGO_CULQI_APROBADO",
                entity_name="PAYMENT",
                entity_id=created_payment.id,
                new_values={
                    "sale_id": str(sale.id),
                    "sale_number": sale.sale_number,
                    "payment_session_id": str(payment_session.id),
                    "payment_method": created_payment.payment_method,
                    "provider": created_payment.provider,
                    "amount": str(created_payment.amount),
                    "currency": created_payment.currency,
                    "status": created_payment.status,
                    "culqi_charge_id": created_payment.culqi_charge_id,
                    "sale_previous_status": previous_sale_status,
                    "sale_current_status": sale.status,
                    "payment_session_status": payment_session.status,
                },
            )

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

    def create_order(self, payload: CulqiOrderCreate) -> CulqiOrderCreateResponse:
        """Crea una orden Culqi para Checkout multipago."""

        self._ensure_secret_key()

        payment_session, sale = self._get_payable_context(payload.payment_session_id)
        amount_in_cents = self._to_cents(payment_session.amount)
        now = datetime.now(timezone.utc)

        client_details: dict[str, str] = {
            "email": str(payload.email),
            "first_name": self._culqi_client_text(payload.first_name, "Cliente"),
            "last_name": self._culqi_client_text(payload.last_name, "Kadosh"),
            "phone_number": self._culqi_phone_number(payload.phone_number),
        }

        culqi_payload = {
            "amount": amount_in_cents,
            "currency_code": payment_session.currency,
            "description": f"Venta {sale.sale_number}",
            "order_number": self._culqi_order_number(
                sale.sale_number,
                payment_session.id,
                now,
            ),
            "client_details": client_details,
            "expiration_date": int(payment_session.expires_at.timestamp()),
            "confirm": True,
            "metadata": {
                "sale_id": str(sale.id),
                "payment_session_id": str(payment_session.id),
                "sale_number": sale.sale_number,
            },
        }

        previous_session_status = payment_session.status
        payment_session.status = "PROCESSING"
        payment_session.processing_at = now

        try:
            self.payment_session_repository.update(payment_session)

            self.audit_log_service.register_action(
                action="CREAR_ORDEN_CULQI",
                entity_name="PAYMENT_SESSION",
                entity_id=payment_session.id,
                old_values={
                    "status": previous_session_status,
                },
                new_values={
                    "status": payment_session.status,
                    "processing_at": payment_session.processing_at.isoformat()
                    if payment_session.processing_at
                    else None,
                    "amount": str(payment_session.amount),
                    "currency": payment_session.currency,
                    "sale_id": str(sale.id),
                    "sale_number": sale.sale_number,
                },
            )

            self.db.flush()

            with httpx.Client(timeout=20) as client:
                response = client.post(
                    CULQI_ORDERS_URL,
                    headers=self._culqi_headers(),
                    json=culqi_payload,
                )

            response_data = self._read_culqi_response(response)

            if response.status_code >= 400:
                message = self._culqi_error_message(
                    response_data,
                    "No se pudo crear la orden Culqi.",
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=message,
                )

            culqi_order_id = str(response_data.get("id") or "")

            if not culqi_order_id:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Culqi no devolvió el identificador de la orden.",
                )

            self.audit_log_service.register_action(
                action="ORDEN_CULQI_CREADA",
                entity_name="PAYMENT_SESSION",
                entity_id=payment_session.id,
                new_values={
                    "sale_id": str(sale.id),
                    "sale_number": sale.sale_number,
                    "culqi_order_id": culqi_order_id,
                    "order_state": response_data.get("state"),
                    "payment_code": response_data.get("payment_code"),
                },
            )

            self.db.commit()
            self.db.refresh(payment_session)

            return CulqiOrderCreateResponse(
                payment_session_id=payment_session.id,
                sale_id=sale.id,
                culqi_order_id=culqi_order_id,
                amount=amount_in_cents,
                currency=payment_session.currency,
                state=str(response_data.get("state") or "pending"),
                payment_code=response_data.get("payment_code"),
                message="Orden Culqi creada correctamente.",
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

    def confirm_order(
        self,
        payload: CulqiOrderConfirm,
    ) -> CulqiOrderConfirmResponse:
        """Consulta una orden Culqi y registra el pago solo si ya fue pagada."""

        self._ensure_secret_key()

        payment_session, sale = self._get_payable_context(payload.payment_session_id)

        try:
            with httpx.Client(timeout=20) as client:
                response = client.get(
                    f"{CULQI_ORDERS_URL}/{payload.culqi_order_id}",
                    headers=self._culqi_headers(),
                )

            response_data = self._read_culqi_response(response)

            if response.status_code >= 400:
                message = self._culqi_error_message(
                    response_data,
                    "No se pudo consultar la orden Culqi.",
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=message,
                )

            order_state = str(response_data.get("state") or "pending")
            normalized_state = order_state.lower()
            paid_at = response_data.get("paid_at")

            if normalized_state not in CULQI_PAID_ORDER_STATES and paid_at is None:
                return CulqiOrderConfirmResponse(
                    payment_id=None,
                    payment_session_id=payment_session.id,
                    sale_id=sale.id,
                    culqi_order_id=payload.culqi_order_id,
                    status="PENDING",
                    order_state=order_state,
                    message="El pago todavía está pendiente de confirmación.",
                )

            payment = Payment(
                sale_id=sale.id,
                payment_method="CULQI",
                provider="CULQI",
                amount=payment_session.amount,
                currency=payment_session.currency,
                status="PAID",
                operation_code=str(
                    response_data.get("payment_code")
                    or response_data.get("reference_code")
                    or payload.culqi_order_id
                ),
                provider_order_id=payload.culqi_order_id,
                provider_transaction_id=payload.culqi_order_id,
                culqi_charge_id=None,
                raw_response=response_data,
                paid_at=datetime.now(timezone.utc),
                failed_at=None,
            )

            created_payment = self.payment_repository.create(payment)

            previous_sale_status = sale.status
            sale.status = "PAID"
            sale.paid_at = datetime.now(timezone.utc)
            self.sale_repository.update(sale)

            previous_session_status = payment_session.status
            payment_session.payment_id = created_payment.id
            payment_session.status = "PAID"
            payment_session.completed_at = datetime.now(timezone.utc)
            self.payment_session_repository.update(payment_session)

            self.audit_log_service.register_action(
                action="ORDEN_CULQI_PAGADA",
                entity_name="PAYMENT",
                entity_id=created_payment.id,
                old_values={
                    "sale_status": previous_sale_status,
                    "payment_session_status": previous_session_status,
                },
                new_values={
                    "sale_id": str(sale.id),
                    "sale_number": sale.sale_number,
                    "payment_session_id": str(payment_session.id),
                    "payment_method": created_payment.payment_method,
                    "provider": created_payment.provider,
                    "amount": str(created_payment.amount),
                    "currency": created_payment.currency,
                    "status": created_payment.status,
                    "provider_order_id": created_payment.provider_order_id,
                    "order_state": order_state,
                    "sale_current_status": sale.status,
                    "payment_session_status": payment_session.status,
                },
            )

            self.db.commit()
            self.db.refresh(created_payment)
            self.db.refresh(payment_session)

            return CulqiOrderConfirmResponse(
                payment_id=created_payment.id,
                payment_session_id=payment_session.id,
                sale_id=sale.id,
                culqi_order_id=payload.culqi_order_id,
                status="PAID",
                order_state=order_state,
                message="Pago aprobado correctamente por Culqi.",
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

        previous_session_status = payment_session.status
        payment_session.payment_id = created_payment.id
        payment_session.status = "FAILED"
        payment_session.completed_at = datetime.now(timezone.utc)
        self.payment_session_repository.update(payment_session)

        self.audit_log_service.register_action(
            action="PAGO_CULQI_RECHAZADO",
            entity_name="PAYMENT",
            entity_id=created_payment.id,
            old_values={
                "payment_session_status": previous_session_status,
            },
            new_values={
                "sale_id": str(sale_id),
                "payment_session_id": str(payment_session.id),
                "payment_method": created_payment.payment_method,
                "provider": created_payment.provider,
                "amount": str(created_payment.amount),
                "currency": created_payment.currency,
                "status": created_payment.status,
                "payment_session_status": payment_session.status,
                "message": message,
            },
        )

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

        return int(
            (amount * Decimal("100")).quantize(
                Decimal("1"),
                rounding=ROUND_HALF_UP,
            )
        )

    def _ensure_secret_key(self) -> None:
        if not settings.culqi_secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="La llave secreta de Culqi no está configurada.",
            )

    def _culqi_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.culqi_secret_key}",
        }

    def _read_culqi_response(self, response: httpx.Response) -> dict[str, Any]:
        try:
            response_data = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Culqi devolvió una respuesta inválida.",
            ) from exc

        if not isinstance(response_data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Culqi devolvió una respuesta inesperada.",
            )

        return response_data

    def _culqi_error_message(
        self,
        response_data: dict[str, Any],
        default_message: str,
    ) -> str:
        return str(
            response_data.get("merchant_message")
            or response_data.get("user_message")
            or response_data.get("message")
            or default_message
        )

    def _culqi_client_text(self, value: str | None, default: str) -> str:
        text = (value or default).strip()

        if not text:
            text = default

        return text[:49]

    def _culqi_phone_number(self, value: str | None) -> str:
        text = (value or settings.culqi_default_phone_number).strip()

        if 5 < len(text) < 15:
            if text.startswith("+"):
                return text

            digits = "".join(character for character in text if character.isdigit())

            if len(digits) == 9:
                return f"+51{digits}"

            if 5 < len(digits) < 15:
                return digits

        default_digits = "".join(
            character
            for character in settings.culqi_default_phone_number
            if character.isdigit()
        )

        if len(default_digits) == 9:
            return f"+51{default_digits}"

        return settings.culqi_default_phone_number[:14]

    def _culqi_order_number(
        self,
        sale_number: str,
        payment_session_id: UUID,
        created_at: datetime,
    ) -> str:
        session_suffix = str(payment_session_id).replace("-", "")[:8]
        timestamp_suffix = int(created_at.timestamp())
        raw_order_number = f"{sale_number}{session_suffix}{timestamp_suffix}"
        order_number = "".join(
            character
            for character in raw_order_number
            if character.isalnum()
        )

        return order_number[:36] or f"ORD{timestamp_suffix}"

    def _get_payable_context(self, payment_session_id: UUID):
        payment_session = self.payment_session_repository.find_by_id(
            payment_session_id
        )

        if payment_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de pago no encontrada.",
            )

        if payment_session.status in FINAL_PAYMENT_SESSION_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La sesión de pago ya se encuentra en un estado final.",
            )

        now = datetime.now(timezone.utc)

        if payment_session.expires_at < now:
            payment_session.status = "EXPIRED"
            payment_session.completed_at = now
            self.payment_session_repository.update(payment_session)

            self.audit_log_service.register_action(
                action="EXPIRAR_SESION_PAGO_CULQI",
                entity_name="PAYMENT_SESSION",
                entity_id=payment_session.id,
                new_values={
                    "status": payment_session.status,
                    "completed_at": payment_session.completed_at.isoformat(),
                },
            )

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

        return payment_session, sale
