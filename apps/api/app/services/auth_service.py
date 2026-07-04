from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthUserResponse,
    BootstrapAdminRequest,
    BootstrapAdminResponse,
    LoginRequest,
    TokenResponse,
)


class AuthService:
    """Servicio de autenticación y creación del administrador inicial."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repository = UserRepository(db)
        self.role_repository = RoleRepository(db)

    def bootstrap_admin(
        self,
        payload: BootstrapAdminRequest,
    ) -> BootstrapAdminResponse:
        """Crea el primer administrador del sistema.

        Este método solo funciona cuando todavía no existe ningún usuario.
        """

        total_users = self.user_repository.count_users()

        if total_users > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El administrador inicial ya fue creado.",
            )

        admin_role = self.role_repository.find_by_name("ADMIN")

        if admin_role is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="El rol ADMIN no existe en la base de datos.",
            )

        normalized_email = payload.email.lower().strip()

        user = User(
            role_id=admin_role.id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            email=normalized_email,
            password_hash=hash_password(payload.password),
            document_number=payload.document_number.strip()
            if payload.document_number
            else None,
            phone=payload.phone.strip() if payload.phone else None,
            status="ACTIVE",
            is_active=True,
        )

        created_user = self.user_repository.create(user)
        created_user.role = admin_role

        return BootstrapAdminResponse(
            message="Administrador inicial creado correctamente.",
            user=self._build_auth_user_response(created_user),
        )

    def login(self, payload: LoginRequest) -> TokenResponse:
        """Valida credenciales y devuelve tokens JWT."""

        normalized_email = payload.email.lower().strip()

        user = self.user_repository.find_by_email(normalized_email)

        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Correo o contraseña incorrectos.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active or user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario no está activo.",
            )

        role_name = user.role.name if user.role else "UNKNOWN"

        token_claims = {
            "role": role_name,
            "email": user.email,
        }

        access_token = create_access_token(
            subject=str(user.id),
            extra_claims=token_claims,
        )

        refresh_token = create_refresh_token(
            subject=str(user.id),
            extra_claims=token_claims,
        )

        user.last_login_at = datetime.now(UTC)
        self.user_repository.update(user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=self._build_auth_user_response(user),
        )

    def _build_auth_user_response(self, user: User) -> AuthUserResponse:
        role_name = user.role.name if user.role else "UNKNOWN"

        return AuthUserResponse(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            role=role_name,
            status=user.status,
        )
