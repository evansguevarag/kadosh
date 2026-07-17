from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.report import ReportsDashboardResponse, ReportsDetailResponse
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/dashboard", response_model=ReportsDashboardResponse)
def get_dashboard_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
) -> ReportsDashboardResponse:
    service = ReportService(db)

    return service.get_dashboard_report()


@router.get("/detail", response_model=ReportsDetailResponse)
def get_detail_report(
    start_date: date = Query(),
    end_date: date = Query(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ReportsDetailResponse:
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha inicial no puede ser posterior a la fecha final.",
        )

    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rango máximo permitido es de 366 días.",
        )

    return ReportService(db).get_detail_report(start_date, end_date)
