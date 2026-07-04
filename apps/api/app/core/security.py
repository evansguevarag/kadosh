from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


password_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(plain_password: str) -> str:
    """Genera un hash seguro para una contraseña."""

    if not plain_password or len(plain_password.strip()) < 8:
        raise ValueError("La contraseña debe tener como mínimo 8 caracteres.")

    return password_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica una contraseña contra su hash almacenado."""

    return password_context.verify(plain_password, password_hash)


def create_access_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Crea un access token JWT de corta duración."""

    expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)

    return _create_token(
        subject=subject,
        token_type="access",
        expires_delta=expires_delta,
        extra_claims=extra_claims,
    )


def create_refresh_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Crea un refresh token JWT de mayor duración."""

    expires_delta = timedelta(days=settings.jwt_refresh_token_expire_days)

    return _create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=expires_delta,
        extra_claims=extra_claims,
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un JWT."""

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(UTC)
    expires_at = now + expires_delta

    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": expires_at,
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
