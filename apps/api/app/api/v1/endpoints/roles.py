from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.schemas.role import RoleResponse
from app.services.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=list[RoleResponse])
def list_roles(db: Session = Depends(get_db)) -> list[RoleResponse]:
    service = RoleService(db)

    return service.list_active_roles()
