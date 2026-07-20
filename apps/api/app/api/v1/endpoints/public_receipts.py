from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.repositories.sale_repository import SaleRepository
from app.schemas.public_receipt import PublicReceiptResponse

router = APIRouter(prefix="/public/receipts", tags=["Public Receipts"])


@router.get("/{receipt_token}", response_model=PublicReceiptResponse)
def get_public_receipt(receipt_token: str, db: Session = Depends(get_db)):
    sale = SaleRepository(db).find_by_receipt_token(receipt_token.strip())
    if sale is None:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado.")

    if sale.status != "PAID":
        raise HTTPException(
            status_code=404,
            detail="El comprobante no esta disponible.",
        )

    customer_name = "Público general"
    customer_document_type = None
    customer_document_number = None
    if sale.customer:
        customer_name = f"{sale.customer.first_name} {sale.customer.last_name or ''}".strip()
        customer_document_type = sale.customer.document_type
        customer_document_number = sale.customer.document_number

    paid_payments = [payment for payment in sale.payments if payment.status == "PAID"]
    payment = max(
        paid_payments,
        key=lambda item: item.paid_at or item.created_at,
        default=None,
    )

    return PublicReceiptResponse(
        sale_number=sale.sale_number,
        customer_name=customer_name,
        customer_document_type=customer_document_type,
        customer_document_number=customer_document_number,
        seller_name=(
            f"{sale.seller.first_name.split()[0]} "
            f"{sale.seller.paternal_last_name}"
        ).strip(),
        payment_method=payment.payment_method if payment else None,
        operation_code=payment.operation_code if payment else None,
        subtotal=sale.subtotal,
        discount_total=sale.discount_total,
        tax_total=sale.tax_total,
        total=sale.total,
        status=sale.status,
        paid_at=sale.paid_at,
        created_at=sale.created_at,
        items=sale.items,
    )
