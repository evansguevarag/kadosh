from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory_movement import InventoryMovement
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.payment_session import PaymentSession
from app.models.user import User
from app.repositories.customer_repository import CustomerRepository
from app.repositories.inventory_movement_repository import InventoryMovementRepository
from app.repositories.product_variant_repository import ProductVariantRepository
from app.repositories.sale_item_repository import SaleItemRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.sale import SaleCreate
from app.services.audit_log_service import AuditLogService


class SaleService:
    """Servicio de lógica de negocio para ventas."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.sale_repository = SaleRepository(db)
        self.sale_item_repository = SaleItemRepository(db)
        self.variant_repository = ProductVariantRepository(db)
        self.customer_repository = CustomerRepository(db)
        self.inventory_movement_repository = InventoryMovementRepository(db)
        self.audit_log_service = AuditLogService(db)

    def list_sales(
        self,
        current_user: User,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Sale]:
        """Lista todas las ventas."""

        self._cancel_expired_payment_sales()
        seller_id = current_user.id if current_user.role.name == "EMPLOYEE" else None
        return self.sale_repository.find_all(
            limit=limit,
            offset=offset,
            seller_id=seller_id,
        )

    def get_sale_by_id(self, sale_id: UUID, current_user: User) -> Sale:
        """Obtiene una venta por ID."""

        sale = self.sale_repository.find_by_id(sale_id)

        if sale is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada.",
            )

        if current_user.role.name == "EMPLOYEE" and sale.seller_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para consultar una venta de otro empleado.",
            )

        return sale

    def create_sale(self, payload: SaleCreate, current_user: User) -> Sale:
        """Crea una venta, descuenta stock y registra movimientos de inventario."""

        variant_ids = [item.product_variant_id for item in payload.items]
        if len(variant_ids) != len(set(variant_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cada variante debe aparecer una sola vez en la venta. Ajusta su cantidad en el mismo articulo.",
            )

        if payload.customer_id is not None:
            customer = self.customer_repository.find_by_id(payload.customer_id)

            if customer is None or not customer.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El cliente seleccionado no existe o no está activo.",
                )

        sale_number = self._generate_sale_number()

        sale_items: list[SaleItem] = []
        inventory_movements: list[InventoryMovement] = []
        subtotal = Decimal("0.00")

        try:
            locked_variants = {}
            for variant_id in sorted(variant_ids, key=str):
                variant = self.variant_repository.find_by_id_for_update(variant_id)
                if variant is None or not variant.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Una de las variantes seleccionadas no existe o esta inactiva.",
                    )
                locked_variants[variant_id] = variant

            sale = Sale(
                sale_number=sale_number,
                seller_id=current_user.id,
                customer_id=payload.customer_id,
                subtotal=Decimal("0.00"),
                discount_total=payload.discount_total,
                tax_total=payload.tax_total,
                total=Decimal("0.00"),
                status="PENDING_PAYMENT",
                notes=payload.notes.strip() if payload.notes else None,
                paid_at=None,
                cancelled_at=None,
            )

            created_sale = self.sale_repository.create(sale)

            for item_payload in payload.items:
                variant = locked_variants[item_payload.product_variant_id]

                available_stock = (
                    variant.stock_quantity
                    - self.variant_repository.active_reserved_quantity(variant.id)
                )
                if available_stock < item_payload.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stock insuficiente para el SKU {variant.sku}.",
                    )

                unit_price = variant.sale_price
                item_subtotal = (
                    unit_price * item_payload.quantity
                ) - item_payload.discount_amount

                if item_subtotal < 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El descuento del SKU {variant.sku} supera el subtotal.",
                    )

                product_name = variant.product.name if variant.product else "Producto"

                sale_item = SaleItem(
                    sale_id=created_sale.id,
                    product_variant_id=variant.id,
                    product_name=product_name,
                    variant_sku=variant.sku,
                    size=variant.size,
                    color=variant.color,
                    quantity=item_payload.quantity,
                    unit_price=unit_price,
                    cost_price=variant.cost_price,
                    discount_amount=item_payload.discount_amount,
                    subtotal=item_subtotal,
                )

                previous_stock = variant.stock_quantity
                new_stock = previous_stock - item_payload.quantity
                variant.stock_quantity = new_stock

                movement = InventoryMovement(
                    product_variant_id=variant.id,
                    user_id=current_user.id,
                    sale_id=created_sale.id,
                    movement_type="VENTA",
                    quantity=item_payload.quantity,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reason=f"Venta {sale_number}",
                )

                self.db.add(variant)
                sale_items.append(sale_item)
                inventory_movements.append(movement)
                subtotal += item_subtotal

            discount_total = payload.discount_total
            total = subtotal - discount_total

            if total < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El total de la venta no puede ser negativo.",
                )

            # Los precios al consumidor ya incluyen IGV. Se descompone el total
            # para el comprobante sin volver a sumar el impuesto al cliente.
            tax_total = (total * Decimal("18") / Decimal("118")).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

            created_sale.subtotal = subtotal
            created_sale.discount_total = discount_total
            created_sale.tax_total = tax_total
            created_sale.total = total

            self.sale_repository.update(created_sale)
            self.sale_item_repository.create_many(sale_items)

            for movement in inventory_movements:
                self.inventory_movement_repository.create(movement)

            self.audit_log_service.register_action(
                action="CREAR_VENTA",
                entity_name="SALE",
                entity_id=created_sale.id,
                current_user=current_user,
                new_values={
                    "sale_number": created_sale.sale_number,
                    "customer_id": str(created_sale.customer_id)
                    if created_sale.customer_id
                    else None,
                    "subtotal": str(created_sale.subtotal),
                    "discount_total": str(created_sale.discount_total),
                    "tax_total": str(created_sale.tax_total),
                    "total": str(created_sale.total),
                    "status": created_sale.status,
                    "items_count": len(sale_items),
                },
            )

            self.db.commit()

            refreshed_sale = self.sale_repository.find_by_id(created_sale.id)

            if refreshed_sale is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo recuperar la venta creada.",
                )

            return refreshed_sale
        except Exception:
            self.db.rollback()
            raise

    def cancel_sale(self, sale_id: UUID, current_user: User) -> Sale:
        """Cancela una venta pendiente y devuelve sus unidades al inventario."""

        sale = self.sale_repository.find_by_id_for_update(sale_id)

        if sale is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada.",
            )

        if current_user.role.name == "EMPLOYEE" and sale.seller_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para cancelar una venta de otro empleado.",
            )

        if sale.status == "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La venta ya se encuentra cancelada.",
            )

        if sale.status == "PAID":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede cancelar una venta pagada.",
            )

        if any(payment.status == "PAID" for payment in sale.payments):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La venta ya tiene un pago aprobado y no puede cancelarse.",
            )

        if any(session.status == "PROCESSING" for session in sale.payment_sessions):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "El cobro esta siendo verificado. Confirma su resultado antes de "
                    "cancelar la venta."
                ),
            )

        now = datetime.now(timezone.utc)
        previous_status = sale.status

        try:
            for item in sale.items:
                variant = self.variant_repository.find_by_id_for_update(
                    item.product_variant_id
                )

                if variant is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"No se encontró el SKU {item.variant_sku} para devolver el stock.",
                    )

                previous_stock = variant.stock_quantity
                variant.stock_quantity += item.quantity
                self.db.add(variant)
                self.inventory_movement_repository.create(
                    InventoryMovement(
                        product_variant_id=variant.id,
                        user_id=current_user.id,
                        sale_id=sale.id,
                        movement_type="DEVOLUCION",
                        quantity=item.quantity,
                        previous_stock=previous_stock,
                        new_stock=variant.stock_quantity,
                        reason=f"Cancelación de venta {sale.sale_number}",
                    )
                )

            for payment_session in sale.payment_sessions:
                if payment_session.status not in {
                    "PAID",
                    "FAILED",
                    "EXPIRED",
                    "CANCELLED",
                }:
                    payment_session.status = "CANCELLED"
                    payment_session.cancelled_at = now
                    self.db.add(payment_session)

            sale.status = "CANCELLED"
            sale.cancelled_at = now
            self.sale_repository.update(sale)

            self.audit_log_service.register_action(
                action="CANCELAR_VENTA",
                entity_name="SALE",
                entity_id=sale.id,
                current_user=current_user,
                old_values={"status": previous_status},
                new_values={
                    "status": sale.status,
                    "cancelled_at": sale.cancelled_at.isoformat(),
                    "restored_items": len(sale.items),
                },
            )

            self.db.commit()

            refreshed_sale = self.sale_repository.find_by_id(sale.id)

            if refreshed_sale is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo recuperar la venta cancelada.",
                )

            return refreshed_sale
        except Exception:
            self.db.rollback()
            raise

    def _generate_sale_number(self) -> str:
        """Genera un número de venta único basado en fecha y hora."""

        now = datetime.now(timezone.utc)

        return f"V-{now.strftime('%Y%m%d%H%M%S%f')}"

    def _cancel_expired_payment_sales(self) -> None:
        now = datetime.now(timezone.utc)
        sessions = list(self.db.scalars(
            select(PaymentSession).where(
                PaymentSession.status.in_([
                    "CREATED", "SENT_TO_CUSTOMER", "CUSTOMER_VIEWING"
                ]),
                PaymentSession.expires_at <= now,
            )
        ).all())
        processed_sales: set[UUID] = set()
        for payment_session in sessions:
            if payment_session.sale_id in processed_sales:
                continue
            processed_sales.add(payment_session.sale_id)
            seller = self.db.get(User, payment_session.seller_id)
            if seller is None:
                continue
            try:
                self.cancel_sale(payment_session.sale_id, seller)
            except HTTPException:
                self.db.rollback()
