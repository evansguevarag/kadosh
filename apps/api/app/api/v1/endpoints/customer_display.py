from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.dependencies import get_db
from app.models.payment_session import PaymentSession
from app.models.sale import Sale
from app.models.user import User
from app.models.return_transaction import (
    ReturnSettlement,
    ReturnSettlementSession,
    ReturnTransaction,
)
from app.schemas.payment_session import (
    CustomerDisplayPaymentSessionResponse,
    CustomerDisplayReturnDifferenceResponse,
    CustomerDisplayReturnItemResponse,
    CustomerDisplayReturnSessionResponse,
)
from app.schemas.sale import SaleResponse
from app.services.customer_display_device_service import (
    CustomerDisplayDeviceService,
)
from app.services.return_culqi_service import ReturnCulqiService
from app.services.sale_service import SaleService
from app.repositories.sale_repository import SaleRepository

router = APIRouter(prefix="/customer-display", tags=["Customer Display"])

device_service = CustomerDisplayDeviceService()


@router.get(
    "/sessions/{device_id}",
    response_model=list[
        CustomerDisplayPaymentSessionResponse | CustomerDisplayReturnSessionResponse
    ],
)
def list_active_sessions_for_customer_display(
    device_id: UUID,
    db: Session = Depends(get_db),
    x_device_token: str = Header(alias="X-Device-Token"),
) -> list[CustomerDisplayPaymentSessionResponse | CustomerDisplayReturnSessionResponse]:
    device_service.validate_device_token(
        db,
        device_id=device_id,
        device_token=x_device_token,
    )

    now = datetime.now(timezone.utc)
    ReturnCulqiService(db).expire_stale_for_device(device_id)
    expired_sale_sessions = list(db.scalars(
        select(PaymentSession).where(
            PaymentSession.device_id == str(device_id),
            PaymentSession.status.in_([
                "CREATED", "SENT_TO_CUSTOMER", "CUSTOMER_VIEWING"
            ]),
            PaymentSession.expires_at <= now,
        )
    ).all())
    for expired_session in expired_sale_sessions:
        seller = db.get(User, expired_session.seller_id)
        if seller is None:
            continue
        try:
            SaleService(db).cancel_sale(expired_session.sale_id, seller)
        except HTTPException:
            db.rollback()

    statement = (
        select(PaymentSession)
        .options(selectinload(PaymentSession.sale).selectinload(Sale.items))
        .where(
            PaymentSession.device_id == str(device_id),
            PaymentSession.status.in_(
                [
                    "CREATED",
                    "SENT_TO_CUSTOMER",
                    "CUSTOMER_VIEWING",
                    "PROCESSING",
                ],
            ),
            PaymentSession.expires_at > now,
        )
        .order_by(PaymentSession.created_at.desc())
    )

    sale_sessions = list(db.scalars(statement).all())
    result: list[
        CustomerDisplayPaymentSessionResponse | CustomerDisplayReturnSessionResponse
    ] = [
        CustomerDisplayPaymentSessionResponse.model_validate(session)
        for session in sale_sessions
    ]

    return_statement = (
        select(ReturnSettlementSession)
        .join(ReturnSettlement)
        .join(ReturnTransaction)
        .options(
            selectinload(ReturnSettlementSession.settlement)
            .selectinload(ReturnSettlement.return_transaction)
            .selectinload(ReturnTransaction.replacements),
            selectinload(ReturnSettlementSession.settlement)
            .selectinload(ReturnSettlement.return_transaction)
            .selectinload(ReturnTransaction.items),
        )
        .where(
            ReturnSettlementSession.device_id == device_id,
            ReturnSettlementSession.status.in_([
                "SENT_TO_CUSTOMER", "CUSTOMER_VIEWING", "PROCESSING"
            ]),
            ReturnSettlementSession.expires_at > now,
        )
        .order_by(ReturnSettlementSession.created_at.desc())
    )
    for return_session in db.scalars(return_statement).all():
        settlement = return_session.settlement
        transaction = settlement.return_transaction
        original_sale = SaleRepository(db).find_by_id(transaction.original_sale_id)
        result.append(
            CustomerDisplayReturnSessionResponse(
                id=return_session.id,
                seller_id=return_session.created_by_id,
                device_id=str(return_session.device_id),
                status=return_session.status,
                amount=settlement.amount,
                expires_at=return_session.expires_at,
                viewed_at=return_session.viewed_at,
                processing_at=return_session.processing_at,
                completed_at=return_session.completed_at,
                cancelled_at=return_session.cancelled_at,
                created_at=return_session.created_at,
                updated_at=return_session.updated_at,
                return_difference=CustomerDisplayReturnDifferenceResponse(
                    return_number=transaction.return_number,
                    original_sale_number=original_sale.sale_number if original_sale else "-",
                    returned_value=transaction.returned_value,
                    replacement_value=transaction.replacement_value,
                    difference_amount=transaction.difference_amount,
                    replacements=[
                        CustomerDisplayReturnItemResponse(
                            product_name=item.product_name,
                            variant_sku=item.variant_sku,
                            quantity=item.quantity,
                        )
                        for item in transaction.replacements
                    ],
                ),
            )
        )

    return sorted(result, key=lambda item: item.created_at, reverse=True)


@router.get(
    "/sessions/{device_id}/{payment_session_id}/receipt",
    response_model=SaleResponse,
)
def get_customer_display_receipt(
    device_id: UUID,
    payment_session_id: UUID,
    db: Session = Depends(get_db),
    x_device_token: str = Header(alias="X-Device-Token"),
) -> SaleResponse:
    device_service.validate_device_token(
        db,
        device_id=device_id,
        device_token=x_device_token,
    )

    payment_session = db.scalar(
        select(PaymentSession).where(
            PaymentSession.id == payment_session_id,
            PaymentSession.device_id == str(device_id),
        )
    )

    if payment_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión de pago no encontrada para esta tablet.",
        )

    sale = SaleRepository(db).find_by_id(payment_session.sale_id)

    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada.",
        )

    return SaleResponse.model_validate(sale)
