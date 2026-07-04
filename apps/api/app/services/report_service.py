from decimal import Decimal

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.models.product_variant import ProductVariant
from app.models.sale import Sale
from app.schemas.report import (
    LowStockProductResponse,
    ReportsDashboardResponse,
    SalesSummaryReportResponse,
)


class ReportService:
    """Servicio de reportes usando pandas y numpy."""

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

    def _build_sales_summary(self, sales: list[Sale]) -> SalesSummaryReportResponse:
        """Calcula métricas generales de ventas con pandas y numpy."""

        if not sales:
            return SalesSummaryReportResponse(
                total_sales=0,
                paid_sales=0,
                pending_sales=0,
                cancelled_sales=0,
                total_revenue=Decimal("0.00"),
                average_ticket=Decimal("0.00"),
            )

        sales_data = [
            {
                "status": sale.status,
                "total": float(sale.total),
            }
            for sale in sales
        ]

        sales_dataframe = pd.DataFrame(sales_data)

        total_sales = int(len(sales_dataframe))
        paid_sales = int((sales_dataframe["status"] == "PAID").sum())
        pending_sales = int((sales_dataframe["status"] == "PENDING_PAYMENT").sum())
        cancelled_sales = int((sales_dataframe["status"] == "CANCELLED").sum())

        paid_sales_dataframe = sales_dataframe[sales_dataframe["status"] == "PAID"]

        total_revenue_value = (
            np.round(paid_sales_dataframe["total"].sum(), 2)
            if not paid_sales_dataframe.empty
            else 0.00
        )

        average_ticket_value = (
            np.round(paid_sales_dataframe["total"].mean(), 2)
            if not paid_sales_dataframe.empty
            else 0.00
        )

        return SalesSummaryReportResponse(
            total_sales=total_sales,
            paid_sales=paid_sales,
            pending_sales=pending_sales,
            cancelled_sales=cancelled_sales,
            total_revenue=Decimal(str(total_revenue_value)),
            average_ticket=Decimal(str(average_ticket_value)),
        )

    def _build_low_stock_products(
        self,
        variants: list[ProductVariant],
    ) -> list[LowStockProductResponse]:
        """Obtiene variantes con stock bajo usando pandas."""

        if not variants:
            return []

        variants_data = [
            {
                "product_variant_id": str(variant.id),
                "product_name": variant.product.name if variant.product else "Producto",
                "sku": variant.sku,
                "size": variant.size,
                "color": variant.color,
                "stock_quantity": variant.stock_quantity,
                "min_stock_quantity": variant.min_stock_quantity,
                "is_active": variant.is_active,
            }
            for variant in variants
        ]

        variants_dataframe = pd.DataFrame(variants_data)

        low_stock_dataframe = variants_dataframe[
            (variants_dataframe["is_active"] == True)
            & (
                variants_dataframe["stock_quantity"]
                <= variants_dataframe["min_stock_quantity"]
            )
        ].sort_values(by="stock_quantity", ascending=True)

        return [
            LowStockProductResponse(
                product_variant_id=row["product_variant_id"],
                product_name=row["product_name"],
                sku=row["sku"],
                size=row["size"],
                color=row["color"],
                stock_quantity=int(row["stock_quantity"]),
                min_stock_quantity=int(row["min_stock_quantity"]),
            )
            for _, row in low_stock_dataframe.iterrows()
        ]
