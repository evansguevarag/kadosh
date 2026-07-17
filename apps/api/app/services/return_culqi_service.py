from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.inventory_movement import InventoryMovement
from app.models.return_transaction import (
    ReturnInventoryReservation,
    ReturnSettlement,
    ReturnSettlementSession,
    ReturnTransaction,
)
from app.models.sale_item import SaleItem
from app.repositories.product_variant_repository import ProductVariantRepository
from app.schemas.return_culqi import (
    ReturnCulqiChargeCreate,
    ReturnCulqiChargeResponse,
    ReturnCulqiOrderConfirm,
    ReturnCulqiOrderCreate,
    ReturnCulqiOrderResponse,
)

CULQI_ORDERS_URL = "https://api.culqi.com/v2/orders"
CULQI_CHARGES_URL = "https://api.culqi.com/v2/charges"


class ReturnCulqiService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.variants = ProductVariantRepository(db)

    def create_order(self, payload: ReturnCulqiOrderCreate) -> ReturnCulqiOrderResponse:
        session, settlement, transaction = self._context(
            payload.settlement_session_id, lock=True
        )
        if session.provider_order_id:
            return self._response(
                session, transaction, session.provider_order_id, "PENDING", "pending",
                "La orden Culqi ya estaba creada.",
            )

        body = {
            "amount": self._to_cents(settlement.amount),
            "currency_code": settlement.currency,
            "description": f"Diferencia {transaction.return_number}",
            "order_number": f"RET{str(transaction.id).replace('-', '')[:24]}",
            "client_details": {
                "email": str(payload.email),
                "first_name": "Cliente",
                "last_name": "Kadosh",
                "phone_number": settings.culqi_default_phone_number[:14],
            },
            "expiration_date": int(session.expires_at.timestamp()),
            "confirm": True,
            "metadata": {
                "return_transaction_id": str(transaction.id),
                "settlement_session_id": str(session.id),
            },
        }
        try:
            response = httpx.post(
                CULQI_ORDERS_URL, headers=self._headers(), json=body, timeout=20
            )
            data = response.json()
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=str(data.get("user_message") or data.get("merchant_message") or "Culqi rechazo la orden."),
                )
            order_id = str(data.get("id") or "")
            if not order_id:
                raise HTTPException(status_code=502, detail="Culqi no devolvio la orden.")
            self._validate_provider_order(data, session, settlement, transaction)
            session.provider_order_id = order_id
            session.status = "PROCESSING"
            session.processing_at = datetime.now(timezone.utc)
            self.db.commit()
            return self._response(
                session, transaction, order_id, "PENDING",
                str(data.get("state") or "pending"), "Orden Culqi creada.",
            )
        except HTTPException:
            self.db.rollback()
            raise
        except httpx.HTTPError as exc:
            self.db.rollback()
            raise HTTPException(status_code=502, detail="No se pudo conectar con Culqi.") from exc

    def create_charge(
        self, payload: ReturnCulqiChargeCreate
    ) -> ReturnCulqiChargeResponse:
        session, settlement, transaction = self._context(
            payload.settlement_session_id, lock=True, expire_if_stale=False
        )
        if session.status == "PAID" and session.provider_transaction_id:
            return ReturnCulqiChargeResponse(
                settlement_session_id=session.id,
                return_transaction_id=transaction.id,
                culqi_charge_id=session.provider_transaction_id,
                status="PAID",
                message="La diferencia ya estaba pagada.",
            )
        if session.expires_at <= datetime.now(timezone.utc):
            self._expire(session, settlement, transaction)
            raise HTTPException(status_code=409, detail="La sesion Culqi expiro.")

        try:
            if session.provider_order_id:
                order_result = self.confirm_order(
                    ReturnCulqiOrderConfirm(
                        settlement_session_id=session.id,
                        culqi_order_id=session.provider_order_id,
                    )
                )
                if order_result.status == "PAID":
                    return ReturnCulqiChargeResponse(
                        settlement_session_id=session.id,
                        return_transaction_id=transaction.id,
                        culqi_charge_id=None,
                        status="PAID",
                        message=order_result.message,
                    )
            self.cancel_provider_order_if_unpaid(session, settlement, transaction)
            response = httpx.post(
                CULQI_CHARGES_URL,
                headers=self._headers(),
                json={
                    "amount": self._to_cents(settlement.amount),
                    "currency_code": settlement.currency,
                    "email": str(payload.email),
                    "source_id": payload.token_id,
                    "capture": True,
                    "description": f"Diferencia {transaction.return_number}",
                    "metadata": {
                        "return_transaction_id": str(transaction.id),
                        "settlement_session_id": str(session.id),
                    },
                },
                timeout=20,
            )
            data = response.json()
            if response.status_code >= 400:
                return self._mark_charge_failed(session, settlement, transaction, data)

            charge_id = str(data.get("id") or "")
            if not charge_id:
                raise HTTPException(status_code=502, detail="Culqi no devolvio el cargo.")
            amount = data.get("amount")
            if amount is not None and int(amount) != self._to_cents(settlement.amount):
                raise HTTPException(status_code=409, detail="El monto cobrado por Culqi no coincide.")
            currency = str(data.get("currency_code") or settlement.currency).upper()
            if currency != settlement.currency:
                raise HTTPException(status_code=409, detail="La moneda cobrada por Culqi no coincide.")

            try:
                self._complete_inventory(session, settlement, transaction)
            except HTTPException as exc:
                self._mark_payment_for_review(session, settlement, transaction, charge_id, data)
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Culqi confirmo el cargo, pero el inventario requiere revision. "
                        "No vuelvas a cobrar esta diferencia."
                    ),
                ) from exc

            now = datetime.now(timezone.utc)
            reference = str(
                data.get("reference_code")
                or data.get("authorization_code")
                or charge_id
            )
            settlement.status = "SETTLED"
            settlement.operation_reference = reference
            settlement.settled_at = now
            session.status = "PAID"
            session.provider_transaction_id = charge_id
            session.operation_reference = reference
            session.raw_response = data
            session.completed_at = now
            transaction.status = "COMPLETED"
            self.db.commit()
            return ReturnCulqiChargeResponse(
                settlement_session_id=session.id,
                return_transaction_id=transaction.id,
                culqi_charge_id=charge_id,
                status="PAID",
                message="Diferencia pagada y cambio completado.",
            )
        except HTTPException:
            self.db.rollback()
            raise
        except httpx.HTTPError as exc:
            self.db.rollback()
            raise HTTPException(status_code=502, detail="No se pudo conectar con Culqi.") from exc

    def _mark_charge_failed(self, session, settlement, transaction, data):
        now = datetime.now(timezone.utc)
        for reservation in self.db.scalars(select(ReturnInventoryReservation).where(
            ReturnInventoryReservation.return_transaction_id == transaction.id,
            ReturnInventoryReservation.status == "ACTIVE",
        )).all():
            reservation.status = "RELEASED"
            reservation.released_at = now
        session.status = "FAILED"
        session.raw_response = data
        session.completed_at = now
        settlement.status = "FAILED"
        transaction.status = "PAYMENT_FAILED"
        self.db.commit()
        message = str(
            data.get("user_message")
            or data.get("merchant_message")
            or "Culqi rechazo el pago."
        )
        return ReturnCulqiChargeResponse(
            settlement_session_id=session.id,
            return_transaction_id=transaction.id,
            culqi_charge_id=None,
            status="FAILED",
            message=message,
        )

    def confirm_order(self, payload: ReturnCulqiOrderConfirm) -> ReturnCulqiOrderResponse:
        session, settlement, transaction = self._context(
            payload.settlement_session_id, lock=True, expire_if_stale=False
        )
        if session.provider_order_id and session.provider_order_id != payload.culqi_order_id:
            raise HTTPException(status_code=409, detail="La orden no pertenece a esta diferencia.")
        if session.status == "PAID":
            return self._response(
                session, transaction, payload.culqi_order_id, "PAID", "paid",
                "La diferencia ya estaba pagada.",
            )
        try:
            response = httpx.get(
                f"{CULQI_ORDERS_URL}/{payload.culqi_order_id}",
                headers=self._headers(), timeout=20,
            )
            data = response.json()
            if response.status_code >= 400:
                raise HTTPException(status_code=502, detail="No se pudo verificar la orden Culqi.")
            order_state = str(data.get("state") or "pending")
            self._validate_provider_order(data, session, settlement, transaction)
            if order_state.lower() != "paid" and data.get("paid_at") is None:
                if session.expires_at <= datetime.now(timezone.utc):
                    self._expire(session, settlement, transaction)
                    raise HTTPException(status_code=409, detail="La sesion Culqi expiro sin pago confirmado.")
                return self._response(
                    session, transaction, payload.culqi_order_id, "PENDING",
                    order_state, "El pago aun esta pendiente.",
                )
            try:
                self._complete_inventory(session, settlement, transaction)
            except HTTPException as exc:
                self._mark_payment_for_review(
                    session, settlement, transaction, payload.culqi_order_id, data
                )
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Culqi confirmo el pago, pero no fue seguro completar el inventario. "
                        "La operacion quedo en revision y no debe cobrarse nuevamente."
                    ),
                ) from exc
            now = datetime.now(timezone.utc)
            reference = str(data.get("payment_code") or data.get("reference_code") or payload.culqi_order_id)
            settlement.status = "SETTLED"
            settlement.operation_reference = reference
            settlement.settled_at = now
            session.status = "PAID"
            session.provider_order_id = payload.culqi_order_id
            session.provider_transaction_id = payload.culqi_order_id
            session.operation_reference = reference
            session.raw_response = data
            session.completed_at = now
            transaction.status = "COMPLETED"
            self.db.commit()
            return self._response(
                session, transaction, payload.culqi_order_id, "PAID",
                order_state, "Diferencia pagada y cambio completado.",
            )
        except HTTPException:
            self.db.rollback()
            raise
        except httpx.HTTPError as exc:
            self.db.rollback()
            raise HTTPException(status_code=502, detail="No se pudo conectar con Culqi.") from exc

    def cancel_provider_order_if_unpaid(
        self, session, settlement, transaction
    ) -> None:
        if not session.provider_order_id:
            return
        try:
            response = httpx.get(
                f"{CULQI_ORDERS_URL}/{session.provider_order_id}",
                headers=self._headers(),
                timeout=20,
            )
            if response.status_code == 404:
                session.raw_response = {"deleted": True, "provider_status": 404}
                return
            data = response.json()
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail="No se pudo verificar la orden Culqi antes de cancelar.",
                )
            self._validate_provider_order(data, session, settlement, transaction)
            order_state = str(data.get("state") or "").lower()
            if order_state == "paid" or data.get("paid_at") is not None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Culqi confirma que la orden fue pagada. Verifica el pago y "
                        "completa el cambio; no se puede cancelar."
                    ),
                )
            if order_state in {"created", "pending"}:
                delete_response = httpx.delete(
                    f"{CULQI_ORDERS_URL}/{session.provider_order_id}",
                    headers=self._headers(),
                    timeout=20,
                )
                delete_data = (
                    delete_response.json()
                    if delete_response.content
                    else {"deleted": delete_response.status_code < 400}
                )
                if delete_response.status_code >= 400:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            delete_data.get("user_message")
                            or delete_data.get("merchant_message")
                            or "Culqi no permitio anular la orden pendiente."
                        ),
                    )
                session.raw_response = delete_data
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="No se pudo conectar con Culqi para cancelar la orden.",
            ) from exc

    def _complete_inventory(self, session, settlement, transaction) -> None:
        reservations = list(self.db.scalars(
            select(ReturnInventoryReservation)
            .where(ReturnInventoryReservation.return_transaction_id == transaction.id)
            .with_for_update()
        ).all())
        now = datetime.now(timezone.utc)
        if not reservations or any(
            item.status != "ACTIVE" or item.expires_at <= now for item in reservations
        ):
            raise HTTPException(status_code=409, detail="La reserva de inventario ya expiro.")

        reservation_by_variant = {item.product_variant_id: item for item in reservations}
        for replacement in transaction.replacements:
            variant = self.variants.find_by_id_for_update(replacement.product_variant_id)
            reservation = reservation_by_variant.get(replacement.product_variant_id)
            if variant is None or reservation is None or variant.stock_quantity < replacement.quantity:
                raise HTTPException(status_code=409, detail="El reemplazo reservado ya no esta disponible.")
            previous = variant.stock_quantity
            variant.stock_quantity -= replacement.quantity
            self.db.add(InventoryMovement(
                product_variant_id=variant.id, user_id=session.created_by_id,
                sale_id=transaction.original_sale_id, movement_type="CAMBIO_SALIDA",
                quantity=replacement.quantity, previous_stock=previous,
                new_stock=variant.stock_quantity, reason=f"Reemplazo de {transaction.return_number}",
            ))
            reservation.status = "CONSUMED"
            reservation.consumed_at = now

        if transaction.inventory_resolution == "RESTOCK":
            for returned in transaction.items:
                sale_item = self.db.get(SaleItem, returned.sale_item_id)
                if sale_item is None:
                    raise HTTPException(status_code=409, detail="Producto original no encontrado.")
                variant = self.variants.find_by_id_for_update(sale_item.product_variant_id)
                if variant is None:
                    raise HTTPException(status_code=409, detail="Variante original no encontrada.")
                previous = variant.stock_quantity
                variant.stock_quantity += returned.quantity
                self.db.add(InventoryMovement(
                    product_variant_id=variant.id, user_id=session.created_by_id,
                    sale_id=transaction.original_sale_id, movement_type="DEVOLUCION",
                    quantity=returned.quantity, previous_stock=previous,
                    new_stock=variant.stock_quantity, reason=f"{transaction.return_number}: apto para reventa",
                ))

    def _context(self, session_id, *, lock: bool, expire_if_stale: bool = True):
        statement = select(ReturnSettlementSession).where(ReturnSettlementSession.id == session_id)
        if lock:
            statement = statement.with_for_update()
        session = self.db.scalar(statement)
        if session is None:
            raise HTTPException(status_code=404, detail="Sesion de diferencia no encontrada.")
        settlement = self.db.get(ReturnSettlement, session.return_settlement_id)
        if settlement is None:
            raise HTTPException(status_code=409, detail="La liquidacion ya no existe.")
        transaction = self.db.scalar(
            select(ReturnTransaction)
            .options(selectinload(ReturnTransaction.items), selectinload(ReturnTransaction.replacements))
            .where(ReturnTransaction.id == settlement.return_transaction_id)
        )
        if transaction is None:
            raise HTTPException(status_code=409, detail="El cambio ya no existe.")
        if session.status in {"FAILED", "EXPIRED", "CANCELLED"}:
            raise HTTPException(status_code=409, detail="La sesion ya no esta activa.")
        if (
            expire_if_stale
            and session.expires_at <= datetime.now(timezone.utc)
            and session.status != "PAID"
        ):
            self._expire(session, settlement, transaction)
            raise HTTPException(status_code=409, detail="La sesion Culqi expiro.")
        return session, settlement, transaction

    def expire_stale_for_device(self, device_id) -> None:
        now = datetime.now(timezone.utc)
        sessions = list(self.db.scalars(
            select(ReturnSettlementSession).where(
                ReturnSettlementSession.device_id == device_id,
                ReturnSettlementSession.status.in_([
                    "SENT_TO_CUSTOMER", "CUSTOMER_VIEWING"
                ]),
                ReturnSettlementSession.expires_at <= now,
            ).with_for_update()
        ).all())
        for session in sessions:
            settlement = self.db.get(ReturnSettlement, session.return_settlement_id)
            transaction = self.db.get(ReturnTransaction, settlement.return_transaction_id)
            self._expire(session, settlement, transaction, commit=False)
        if sessions:
            self.db.commit()

    def _expire(self, session, settlement, transaction, *, commit: bool = True) -> None:
        now = datetime.now(timezone.utc)
        for reservation in self.db.scalars(select(ReturnInventoryReservation).where(
            ReturnInventoryReservation.return_transaction_id == transaction.id,
            ReturnInventoryReservation.status == "ACTIVE",
        )).all():
            reservation.status = "RELEASED"
            reservation.released_at = now
        session.status = "EXPIRED"
        session.completed_at = now
        settlement.status = "CANCELLED"
        transaction.status = "CANCELLED"
        if commit:
            self.db.commit()

    def _mark_payment_for_review(
        self, session, settlement, transaction, provider_order_id: str, data: dict
    ) -> None:
        now = datetime.now(timezone.utc)
        for reservation in self.db.scalars(select(ReturnInventoryReservation).where(
            ReturnInventoryReservation.return_transaction_id == transaction.id,
            ReturnInventoryReservation.status == "ACTIVE",
        )).all():
            reservation.status = "RELEASED"
            reservation.released_at = now
        session.status = "FAILED"
        session.provider_order_id = provider_order_id
        session.provider_transaction_id = provider_order_id
        session.raw_response = data
        session.completed_at = now
        settlement.status = "FAILED"
        transaction.status = "PAYMENT_REVIEW"
        self.db.commit()

    def _validate_provider_order(self, data, session, settlement, transaction) -> None:
        provider_id = str(data.get("id") or "")
        if session.provider_order_id and provider_id != session.provider_order_id:
            raise HTTPException(status_code=409, detail="Culqi devolvio una orden diferente.")
        amount = data.get("amount")
        if amount is not None and int(amount) != self._to_cents(settlement.amount):
            raise HTTPException(status_code=409, detail="El monto confirmado por Culqi no coincide.")
        currency = str(data.get("currency_code") or settlement.currency).upper()
        if currency != settlement.currency:
            raise HTTPException(status_code=409, detail="La moneda confirmada por Culqi no coincide.")
        metadata = data.get("metadata") or {}
        expected_transaction = metadata.get("return_transaction_id")
        expected_session = metadata.get("settlement_session_id")
        if expected_transaction and str(expected_transaction) != str(transaction.id):
            raise HTTPException(status_code=409, detail="La orden Culqi pertenece a otro cambio.")
        if expected_session and str(expected_session) != str(session.id):
            raise HTTPException(status_code=409, detail="La orden Culqi pertenece a otra sesion.")

    def _headers(self):
        if not settings.culqi_secret_key:
            raise HTTPException(status_code=500, detail="Culqi no esta configurado.")
        return {"Authorization": f"Bearer {settings.culqi_secret_key}", "Content-Type": "application/json"}

    @staticmethod
    def _to_cents(amount: Decimal) -> int:
        return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def _response(self, session, transaction, order_id, status_value, order_state, message):
        return ReturnCulqiOrderResponse(
            settlement_session_id=session.id,
            return_transaction_id=transaction.id,
            culqi_order_id=order_id,
            amount=self._to_cents(session.settlement.amount),
            currency=session.settlement.currency,
            status=status_value,
            order_state=order_state,
            message=message,
        )
