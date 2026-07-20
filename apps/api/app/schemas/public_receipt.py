from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.sale import SaleItemResponse


class PublicReceiptResponse(BaseModel):
    sale_number: str
    customer_name: str
    customer_document_type: str | None
    customer_document_number: str | None
    seller_name: str
    payment_method: str | None
    operation_code: str | None
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    status: str
    paid_at: datetime | None
    created_at: datetime
    items: list[SaleItemResponse]
