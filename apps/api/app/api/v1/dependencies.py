from collections.abc import Generator

from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Entrega una sesión de base de datos por petición.

    La sesión se cierra automáticamente al finalizar la petición.
    """

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
