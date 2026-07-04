from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthUserResponse,
    BootstrapAdminRequest,
    BootstrapAdminResponse,
    LoginRequest,
    TokenResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/bootstrap-admin",
    response_model=BootstrapAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
def bootstrap_admin(
    payload: BootstrapAdminRequest,
    db: Session = Depends(get_db),
) -> BootstrapAdminResponse:
    service = AuthService(db)

    return service.bootstrap_admin(payload)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    service = AuthService(db)

    return service.login(payload)


@router.get("/me", response_model=AuthUserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
) -> AuthUserResponse:
    role_name = current_user.role.name if current_user.role else "UNKNOWN"

    return AuthUserResponse(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        role=role_name,
        status=current_user.status,
    )
