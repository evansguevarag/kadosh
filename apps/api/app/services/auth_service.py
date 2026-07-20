import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.password_reset_otp import PasswordResetOtp
from app.models.user import User
from app.repositories.password_reset_otp_repository import (
    PasswordResetOtpRepository,
)
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthUserResponse,
    BootstrapAdminRequest,
    BootstrapAdminResponse,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    PasswordResetVerifyRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.services.email_service import EmailService


PASSWORD_RESET_MESSAGE = (
    "Si el correo existe y está activo, enviaremos un código para restablecer la contraseña."
)


class AuthService:
    """Servicio de autenticación y creación del administrador inicial."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repository = UserRepository(db)
        self.role_repository = RoleRepository(db)
        self.password_reset_otp_repository = PasswordResetOtpRepository(db)
        self.email_service = EmailService()

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
            paternal_last_name=payload.paternal_last_name.strip(),
            maternal_last_name=payload.maternal_last_name.strip(),
            email=normalized_email,
            password_hash=hash_password(payload.password),
            document_number=payload.document_number.strip(),
            phone=payload.phone.strip(),
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

    def refresh_session(self, payload: RefreshTokenRequest) -> TokenResponse:
        """Renueva ambos JWT despues de validar usuario y tipo de token."""

        token_payload = decode_token(payload.refresh_token)
        if token_payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El token no es de renovacion.",
            )

        try:
            user_id = UUID(str(token_payload.get("sub", "")))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de renovacion invalido.",
            ) from exc

        user = self.user_repository.find_by_id(user_id)
        if user is None or not user.is_active or user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="La sesion ya no esta activa.",
            )

        role_name = user.role.name if user.role else "UNKNOWN"
        claims = {"role": role_name, "email": user.email}
        return TokenResponse(
            access_token=create_access_token(str(user.id), claims),
            refresh_token=create_refresh_token(str(user.id), claims),
            user=self._build_auth_user_response(user),
        )

    def request_password_reset(
        self,
        payload: PasswordResetRequest,
    ) -> PasswordResetResponse:
        normalized_email = payload.email.lower().strip()
        user = self.user_repository.find_by_email(normalized_email)

        if user is None or not user.is_active or user.status != "ACTIVE":
            return PasswordResetResponse(message=PASSWORD_RESET_MESSAGE)

        otp_code = f"{secrets.randbelow(1_000_000):06d}"
        now = datetime.now(UTC)

        self.password_reset_otp_repository.consume_active_for_user(user.id, now)
        self.password_reset_otp_repository.create(
            PasswordResetOtp(
                user_id=user.id,
                code_hash=self._hash_otp(otp_code),
                expires_at=now + timedelta(minutes=10),
            ),
        )

        email_delivery_configured = self.email_service.send_password_reset_otp(
            recipient_email=user.email,
            otp_code=otp_code,
        )

        return PasswordResetResponse(
            message=PASSWORD_RESET_MESSAGE,
            email_delivery_configured=email_delivery_configured,
        )

    def verify_password_reset_otp(
        self,
        payload: PasswordResetVerifyRequest,
    ) -> PasswordResetResponse:
        user = self._get_active_user_for_password_reset(payload.email)
        self._get_valid_password_reset_otp(user, payload.otp_code)

        return PasswordResetResponse(message="Código verificado correctamente.")

    def confirm_password_reset(
        self,
        payload: PasswordResetConfirmRequest,
    ) -> PasswordResetResponse:
        user = self._get_active_user_for_password_reset(payload.email)
        otp = self._get_valid_password_reset_otp(user, payload.otp_code)
        now = datetime.now(UTC)

        user.password_hash = hash_password(payload.new_password)
        self.user_repository.update(user)
        self.password_reset_otp_repository.consume(otp, now)
        self.password_reset_otp_repository.consume_active_for_user(user.id, now)

        return PasswordResetResponse(
            message="Contraseña actualizada correctamente. Ya puedes iniciar sesión.",
        )

    def _build_auth_user_response(self, user: User) -> AuthUserResponse:
        role_name = user.role.name if user.role else "UNKNOWN"

        return AuthUserResponse(
            id=user.id,
            first_name=user.first_name,
            paternal_last_name=user.paternal_last_name,
            maternal_last_name=user.maternal_last_name,
            email=user.email,
            role=role_name,
            status=user.status,
        )

    def _get_active_user_for_password_reset(self, email: str) -> User:
        normalized_email = email.lower().strip()
        user = self.user_repository.find_by_email(normalized_email)

        if user is None or not user.is_active or user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido o expirado.",
            )

        return user

    def _get_valid_password_reset_otp(
        self,
        user: User,
        otp_code: str,
    ) -> PasswordResetOtp:
        now = datetime.now(UTC)
        otp = self.password_reset_otp_repository.find_latest_active_by_user(
            user.id,
            now,
        )

        if otp is None or otp.code_hash != self._hash_otp(otp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido o expirado.",
            )

        return otp

    def _hash_otp(self, otp_code: str) -> str:
        return hashlib.sha256(
            f"{settings.jwt_secret_key}:{otp_code}".encode("utf-8"),
        ).hexdigest()
