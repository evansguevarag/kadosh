from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.sale import Sale


class SaleRepository:
    """Repositorio de acceso a datos para ventas."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all(self, *, limit: int = 100, offset: int = 0) -> list[Sale]:
        """Obtiene todas las ventas con sus items."""

        statement = (
            select(Sale)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
            .order_by(Sale.created_at.desc())
            .offset(offset)
            .limit(limit)
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

    def find_by_id_for_update(self, sale_id: UUID) -> Sale | None:
        """Obtiene y bloquea una venta durante una operacion financiera."""

        statement = (
            select(Sale)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
            .where(Sale.id == sale_id)
            .with_for_update()
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

    def find_by_receipt_token(self, receipt_token: str) -> Sale | None:
        statement = (
            select(Sale)
            .options(
                selectinload(Sale.items),
                selectinload(Sale.customer),
                selectinload(Sale.payments),
            )
            .where(Sale.receipt_token == receipt_token)
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
