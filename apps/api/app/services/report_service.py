from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.models.product_variant import ProductVariant
from app.models.sale import Sale
from app.schemas.report import (
    LowStockProductResponse,
    ReportsDashboardResponse,
    ReportsDetailResponse,
    SalesSummaryReportResponse,
)


class ReportService:
    """Servicio de reportes operativos."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_dashboard_report(self) -> ReportsDashboardResponse:
        """Genera un resumen general para el dashboard del POS."""

        sales = self.db.query(Sale).all()
        variants = self.db.query(ProductVariant).all()

        sales_summary = self._build_sales_summary(sales)
        low_stock_products = self._build_low_stock_products(variants)

        return ReportsDashboardResponse(
            sales_summary=sales_summary,
            low_stock_products=low_stock_products,
        )

    def get_detail_report(
        self,
        start_date: date,
        end_date: date,
    ) -> ReportsDetailResponse:
        """Obtiene ventas y pagos del periodo usando límites de Lima."""

        lima_timezone = ZoneInfo("America/Lima")
        start_at = datetime.combine(
            start_date,
            time.min,
            tzinfo=lima_timezone,
        )
        end_at = datetime.combine(
            end_date + timedelta(days=1),
            time.min,
            tzinfo=lima_timezone,
        )

        sales_statement = (
            select(Sale)
            .options(
                selectinload(Sale.items),
                selectinload(Sale.customer),
            )
            .where(
                Sale.created_at >= start_at,
                Sale.created_at < end_at,
            )
            .order_by(Sale.created_at.desc())
        )
        payments_statement = (
            select(Payment)
            .where(
                func.coalesce(Payment.paid_at, Payment.created_at) >= start_at,
                func.coalesce(Payment.paid_at, Payment.created_at) < end_at,
            )
            .order_by(Payment.created_at.desc())
        )

        sales = list(self.db.scalars(sales_statement).all())
        payments = list(self.db.scalars(payments_statement).all())
        variants = list(self.db.scalars(select(ProductVariant)).all())

        return ReportsDetailResponse(
            dashboard=ReportsDashboardResponse(
                sales_summary=self._build_sales_summary(sales),
                low_stock_products=self._build_low_stock_products(variants),
            ),
            sales=sales,
            payments=payments,
        )

    def _build_sales_summary(self, sales: list[Sale]) -> SalesSummaryReportResponse:
        """Calcula métricas generales de ventas."""

        if not sales:
            return SalesSummaryReportResponse(
                total_sales=0,
                paid_sales=0,
                pending_sales=0,
                cancelled_sales=0,
                total_revenue=Decimal("0.00"),
                average_ticket=Decimal("0.00"),
                total_cost=Decimal("0.00"),
                gross_profit=Decimal("0.00"),
                gross_margin_percentage=Decimal("0.00"),
            )

        paid_totals = [sale.total for sale in sales if sale.status == "PAID"]
        total_revenue = sum(paid_totals, start=Decimal("0.00"))
        average_ticket = (
            total_revenue / len(paid_totals)
            if paid_totals
            else Decimal("0.00")
        )
        paid_sales = [sale for sale in sales if sale.status == "PAID"]
        total_cost = sum(
            (
                item.cost_price * item.quantity
                for sale in paid_sales
                for item in sale.items
            ),
            start=Decimal("0.00"),
        )
        gross_profit = total_revenue - total_cost
        gross_margin = (
            gross_profit * Decimal("100") / total_revenue
            if total_revenue > 0
            else Decimal("0.00")
        )

        return SalesSummaryReportResponse(
            total_sales=len(sales),
            paid_sales=len(paid_totals),
            pending_sales=sum(
                sale.status == "PENDING_PAYMENT" for sale in sales
            ),
            cancelled_sales=sum(sale.status == "CANCELLED" for sale in sales),
            total_revenue=total_revenue.quantize(Decimal("0.01")),
            average_ticket=average_ticket.quantize(Decimal("0.01")),
            total_cost=total_cost.quantize(Decimal("0.01")),
            gross_profit=gross_profit.quantize(Decimal("0.01")),
            gross_margin_percentage=gross_margin.quantize(Decimal("0.01")),
        )

    def _build_low_stock_products(
        self,
        variants: list[ProductVariant],
    ) -> list[LowStockProductResponse]:
        """Obtiene variantes activas con stock bajo."""

        if not variants:
            return []

        low_stock_variants = sorted(
            (
                variant
                for variant in variants
                if variant.is_active
                and variant.stock_quantity <= variant.min_stock_quantity
            ),
            key=lambda variant: variant.stock_quantity,
        )

        return [
            LowStockProductResponse(
                product_variant_id=str(variant.id),
                product_name=(
                    variant.product.name if variant.product else "Producto"
                ),
                sku=variant.sku,
                size=variant.size,
                color=variant.color,
                stock_quantity=variant.stock_quantity,
                min_stock_quantity=variant.min_stock_quantity,
            )
            for variant in low_stock_variants
        ]
