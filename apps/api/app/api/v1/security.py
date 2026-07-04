from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.core.security import decode_token
from app.models.user import User
from app.repositories.user_repository import UserRepository


bearer_scheme = HTTPBearer(
    scheme_name="BearerAuth",
    description="Pega solamente el access_token JWT. No escribas la palabra Bearer.",
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Obtiene el usuario autenticado a partir del token JWT."""

    token = credentials.credentials
    payload = decode_token(token)

    token_type = payload.get("type")

    if token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token no es de acceso.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = payload.get("sub")

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin identificador de usuario.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificador de usuario inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_repository = UserRepository(db)
    user = user_repository.find_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active or user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no está activo.",
        )

    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """Valida que el usuario autenticado tenga uno de los roles permitidos."""

    normalized_roles = {role.upper() for role in allowed_roles}

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_role = current_user.role.name.upper() if current_user.role else ""

        if user_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción.",
            )

        return current_user

    return role_checker
