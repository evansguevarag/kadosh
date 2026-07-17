from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.inventory_movement import InventoryMovement
from app.models.return_transaction import (
    ReplacementItem,
    ReturnItem,
    ReturnInventoryReservation,
    ReturnSettlement,
    ReturnSettlementSession,
    ReturnTransaction,
)
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.user import User
from app.repositories.product_variant_repository import ProductVariantRepository
from app.schemas.return_transaction import ReturnTransactionCreate
from app.services.audit_log_service import AuditLogService


class ReturnTransactionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.variant_repository = ProductVariantRepository(db)
        self.audit_log_service = AuditLogService(db)

    def list_transactions(
        self, *, limit: int = 100, offset: int = 0
    ) -> list[ReturnTransaction]:
        statement = (
            select(ReturnTransaction)
            .options(
                selectinload(ReturnTransaction.items),
                selectinload(ReturnTransaction.replacements),
                selectinload(ReturnTransaction.settlement),
            )
            .order_by(ReturnTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(statement).all())

    def create_transaction(
        self, payload: ReturnTransactionCreate, current_user: User
    ) -> ReturnTransaction:
        requested_method = (payload.settlement_method or "").strip().upper()
        is_deferred_culqi = requested_method == "CULQI"
        sale = self.db.scalar(
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.id == payload.original_sale_id)
            .with_for_update()
        )
        if sale is None:
            raise HTTPException(status_code=404, detail="Venta original no encontrada.")
        if sale.status != "PAID":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Solo se permiten cambios o devoluciones de ventas pagadas.",
            )

        sale_items = {item.id: item for item in sale.items}
        returned_value = Decimal("0.00")
        return_items: list[ReturnItem] = []

        try:
            transaction = ReturnTransaction(
                return_number=f"D-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
                original_sale_id=sale.id,
                processed_by_id=current_user.id,
                transaction_type=payload.transaction_type,
                reason=payload.reason.strip().upper(),
                item_condition=payload.item_condition.strip().upper(),
                inventory_resolution=payload.inventory_resolution,
                settlement_method=(payload.settlement_method or "").strip().upper() or None,
                notes=payload.notes.strip() if payload.notes else None,
                status="PENDING_PAYMENT" if is_deferred_culqi else "COMPLETED",
            )
            self.db.add(transaction)
            self.db.flush()

            for requested_item in payload.items:
                sale_item = sale_items.get(requested_item.sale_item_id)
                if sale_item is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Uno de los productos no pertenece a la venta original.",
                    )

                already_returned = self.db.scalar(
                    select(func.coalesce(func.sum(ReturnItem.quantity), 0))
                    .join(ReturnTransaction)
                    .where(
                        ReturnItem.sale_item_id == sale_item.id,
                        ReturnTransaction.status.in_(["COMPLETED", "PENDING_PAYMENT"]),
                    )
                )
                if int(already_returned or 0) + requested_item.quantity > sale_item.quantity:
                    raise HTTPException(
                        status_code=409,
                        detail=f"La cantidad devuelta supera lo vendido para {sale_item.variant_sku}.",
                    )

                unit_value = sale_item.subtotal / sale_item.quantity
                item_total = unit_value * requested_item.quantity
                returned_value += item_total
                return_items.append(
                    ReturnItem(
                        return_transaction_id=transaction.id,
                        sale_item_id=sale_item.id,
                        quantity=requested_item.quantity,
                        unit_value=unit_value,
                        subtotal=item_total,
                    )
                )

                if payload.inventory_resolution == "RESTOCK" and not is_deferred_culqi:
                    variant = self.variant_repository.find_by_id_for_update(
                        sale_item.product_variant_id
                    )
                    if variant is None:
                        raise HTTPException(status_code=409, detail="Producto original no encontrado.")
                    previous_stock = variant.stock_quantity
                    variant.stock_quantity += requested_item.quantity
                    self.db.add(variant)
                    self.db.add(
                        InventoryMovement(
                            product_variant_id=variant.id,
                            user_id=current_user.id,
                            sale_id=sale.id,
                            movement_type="DEVOLUCION",
                            quantity=requested_item.quantity,
                            previous_stock=previous_stock,
                            new_stock=variant.stock_quantity,
                            reason=f"{transaction.return_number}: producto apto para reventa",
                        )
                    )

            self.db.add_all(return_items)

            replacement_value = Decimal("0.00")
            replacements: list[ReplacementItem] = []
            for requested_replacement in payload.replacements:
                variant = self.variant_repository.find_by_id_for_update(
                    requested_replacement.product_variant_id
                )
                if variant is None or not variant.is_active:
                    raise HTTPException(status_code=400, detail="Reemplazo no disponible.")
                available_stock = (
                    variant.stock_quantity
                    - self.variant_repository.active_reserved_quantity(variant.id)
                )
                if available_stock < requested_replacement.quantity:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Stock insuficiente para {variant.sku}.",
                    )
                item_total = variant.sale_price * requested_replacement.quantity
                replacement_value += item_total
                if not is_deferred_culqi:
                    previous_stock = variant.stock_quantity
                    variant.stock_quantity -= requested_replacement.quantity
                    self.db.add(variant)
                    self.db.add(
                        InventoryMovement(
                            product_variant_id=variant.id,
                            user_id=current_user.id,
                            sale_id=sale.id,
                            movement_type="CAMBIO_SALIDA",
                            quantity=requested_replacement.quantity,
                            previous_stock=previous_stock,
                            new_stock=variant.stock_quantity,
                            reason=f"Reemplazo de {transaction.return_number}",
                        )
                    )
                replacements.append(
                    ReplacementItem(
                        return_transaction_id=transaction.id,
                        product_variant_id=variant.id,
                        product_name=variant.product.name if variant.product else "Producto",
                        variant_sku=variant.sku,
                        size=variant.size,
                        color=variant.color,
                        quantity=requested_replacement.quantity,
                        unit_price=variant.sale_price,
                        subtotal=item_total,
                    )
                )

            self.db.add_all(replacements)
            difference = replacement_value - returned_value
            if difference != 0 and not transaction.settlement_method:
                raise HTTPException(
                    status_code=400,
                    detail="Selecciona cómo se cobrará o devolverá la diferencia.",
                )
            charge_methods = {"CASH", "YAPE", "PLIN", "TRANSFER", "POS", "CULQI"}
            refund_methods = {"REFUND_CASH", "REFUND_TRANSFER"}
            if difference > 0 and transaction.settlement_method not in charge_methods:
                raise HTTPException(
                    status_code=400,
                    detail="El metodo seleccionado no permite cobrar la diferencia.",
                )
            if difference < 0 and transaction.settlement_method not in refund_methods:
                raise HTTPException(
                    status_code=400,
                    detail="El metodo seleccionado no permite devolver la diferencia.",
                )
            if is_deferred_culqi and difference <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Culqi solo se usa cuando el cliente debe pagar una diferencia.",
                )
            if is_deferred_culqi and payload.settlement_device_id is None:
                raise HTTPException(
                    status_code=400,
                    detail="Selecciona la tablet que recibira el cobro Culqi.",
                )
            if difference == 0:
                transaction.settlement_method = None
            reference = (
                payload.settlement_reference.strip()
                if payload.settlement_reference
                else None
            )
            methods_requiring_reference = {
                "YAPE",
                "PLIN",
                "TRANSFER",
                "POS",
                "REFUND_TRANSFER",
            }
            if transaction.settlement_method in methods_requiring_reference and not reference:
                raise HTTPException(
                    status_code=400,
                    detail="Ingresa el codigo o referencia de la operacion.",
                )
            transaction.returned_value = returned_value
            transaction.replacement_value = replacement_value
            transaction.difference_amount = difference

            settlement = ReturnSettlement(
                return_transaction_id=transaction.id,
                direction=(
                    "CHARGE" if difference > 0 else "REFUND" if difference < 0 else "NONE"
                ),
                method=transaction.settlement_method,
                amount=abs(difference),
                currency="PEN",
                status="PENDING" if is_deferred_culqi else "SETTLED",
                operation_reference=reference,
                settled_at=None if is_deferred_culqi else datetime.now(timezone.utc),
            )
            self.db.add(settlement)
            self.db.flush()

            if is_deferred_culqi:
                from app.models.customer_display_device import CustomerDisplayDevice

                device = self.db.get(CustomerDisplayDevice, payload.settlement_device_id)
                if device is None or not device.is_active:
                    raise HTTPException(
                        status_code=400,
                        detail="La tablet seleccionada no existe o esta inactiva.",
                    )
                self.db.add(
                    ReturnSettlementSession(
                        return_settlement_id=settlement.id,
                        device_id=device.id,
                        created_by_id=current_user.id,
                        status="SENT_TO_CUSTOMER",
                        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
                    )
                )
                reservation_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
                for requested_replacement in payload.replacements:
                    self.db.add(
                        ReturnInventoryReservation(
                            return_transaction_id=transaction.id,
                            product_variant_id=requested_replacement.product_variant_id,
                            quantity=requested_replacement.quantity,
                            status="ACTIVE",
                            expires_at=reservation_expiry,
                        )
                    )

            self.audit_log_service.register_action(
                action="REGISTRAR_CAMBIO_DEVOLUCION",
                entity_name="RETURN_TRANSACTION",
                entity_id=transaction.id,
                current_user=current_user,
                new_values={
                    "return_number": transaction.return_number,
                    "sale_id": str(sale.id),
                    "type": transaction.transaction_type,
                    "difference": str(difference),
                    "settlement_direction": settlement.direction,
                    "settlement_method": settlement.method,
                    "settlement_amount": str(settlement.amount),
                    "settlement_status": settlement.status,
                    "settlement_reference": settlement.operation_reference,
                },
            )
            self.db.commit()

            return self.db.scalar(
                select(ReturnTransaction)
                .options(
                    selectinload(ReturnTransaction.items),
                    selectinload(ReturnTransaction.replacements),
                    selectinload(ReturnTransaction.settlement),
                )
                .where(ReturnTransaction.id == transaction.id)
            )
        except Exception:
            self.db.rollback()
            raise

    def cancel_pending_transaction(
        self, transaction_id: UUID, current_user: User
    ) -> ReturnTransaction:
        transaction = self.db.scalar(
            select(ReturnTransaction)
            .options(
                selectinload(ReturnTransaction.items),
                selectinload(ReturnTransaction.replacements),
                selectinload(ReturnTransaction.settlement),
            )
            .where(ReturnTransaction.id == transaction_id)
            .with_for_update()
        )
        if transaction is None:
            raise HTTPException(status_code=404, detail="Cambio no encontrado.")
        if transaction.status != "PENDING_PAYMENT":
            raise HTTPException(
                status_code=409,
                detail="Solo se pueden cancelar cambios pendientes de pago.",
            )
        settlement = transaction.settlement
        payment_session = settlement.payment_session if settlement else None
        if payment_session and (
            payment_session.status == "PROCESSING" or payment_session.provider_order_id
        ):
            from app.services.return_culqi_service import ReturnCulqiService

            ReturnCulqiService(self.db).cancel_provider_order_if_unpaid(
                payment_session,
                settlement,
                transaction,
            )
        now = datetime.now(timezone.utc)
        reservations = list(self.db.scalars(
            select(ReturnInventoryReservation).where(
                ReturnInventoryReservation.return_transaction_id == transaction.id,
                ReturnInventoryReservation.status == "ACTIVE",
            ).with_for_update()
        ).all())
        for reservation in reservations:
            reservation.status = "RELEASED"
            reservation.released_at = now

        if settlement:
            settlement.status = "CANCELLED"
            if payment_session and payment_session.status not in {"PAID", "CANCELLED"}:
                payment_session.status = "CANCELLED"
                payment_session.cancelled_at = now
        transaction.status = "CANCELLED"
        self.audit_log_service.register_action(
            action="CANCELAR_CAMBIO_PENDIENTE",
            entity_name="RETURN_TRANSACTION",
            entity_id=transaction.id,
            current_user=current_user,
            new_values={
                "status": transaction.status,
                "released_reservations": len(reservations),
            },
        )
        self.db.commit()
        return transaction
