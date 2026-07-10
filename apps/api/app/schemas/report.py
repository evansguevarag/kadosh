from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.payment import PaymentResponse
from app.schemas.sale import SaleResponse


class SalesSummaryReportResponse(BaseModel):
    """Resumen general de ventas."""

    total_sales: int = Field(examples=[25])
    paid_sales: int = Field(examples=[20])
    pending_sales: int = Field(examples=[5])
    cancelled_sales: int = Field(examples=[0])
    total_revenue: Decimal = Field(examples=[Decimal("1598.00")])
    average_ticket: Decimal = Field(examples=[Decimal("79.90")])


class LowStockProductResponse(BaseModel):
    """Producto/variante con bajo stock."""

    product_variant_id: str
    product_name: str
    sku: str
    size: str | None
    color: str | None
    stock_quantity: int
    min_stock_quantity: int


class ReportsDashboardResponse(BaseModel):
    """Respuesta general para dashboard de reportes."""

    sales_summary: SalesSummaryReportResponse
    low_stock_products: list[LowStockProductResponse]


class ReportsDetailResponse(BaseModel):
    """Datos de reportes limitados al periodo solicitado."""

    dashboard: ReportsDashboardResponse
    sales: list[SaleResponse]
    payments: list[PaymentResponse]
