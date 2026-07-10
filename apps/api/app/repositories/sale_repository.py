from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.sale import Sale


class SaleRepository:
    """Repositorio de acceso a datos para ventas."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all(self) -> list[Sale]:
        """Obtiene todas las ventas con sus items."""

        statement = (
            select(Sale)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
            .order_by(Sale.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, sale_id: UUID) -> Sale | None:
        """Obtiene una venta por su identificador."""

        statement = (
            select(Sale)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
            .where(Sale.id == sale_id)
        )

        return self.db.scalar(statement)

    def find_by_sale_number(self, sale_number: str) -> Sale | None:
        """Obtiene una venta por su número correlativo."""

        statement = (
            select(Sale)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
            .where(Sale.sale_number == sale_number)
        )

        return self.db.scalar(statement)

    def create(self, sale: Sale) -> Sale:
        """Crea una nueva venta."""

        self.db.add(sale)
        self.db.flush()
        self.db.refresh(sale)

        return sale

    def update(self, sale: Sale) -> Sale:
        """Actualiza una venta existente."""

        self.db.add(sale)
        self.db.flush()
        self.db.refresh(sale)

        return sale
