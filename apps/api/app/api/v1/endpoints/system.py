from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.security import require_roles
from app.db.session import check_database_connection
from app.models.user import User
from app.services.system_service import get_database_status

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/ping")
def ping_database() -> dict[str, str]:
    try:
        if not check_database_connection():
            raise RuntimeError("Database connection is not available.")

        return {
            "status": "ok",
            "service": "kadosh-pos-api",
            "database": "connected",
            "message": "Supabase PostgreSQL connection is working correctly.",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        ) from exc


@router.get("/database-status")
def database_status(
    current_user: User = Depends(require_roles("ADMIN")),
) -> dict[str, object]:
    try:
        return get_database_status()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema status could not be verified.",
        ) from exc
