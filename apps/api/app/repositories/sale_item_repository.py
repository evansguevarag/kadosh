from app.models.sale_item import SaleItem
from sqlalchemy.orm import Session


class SaleItemRepository:
    """Repositorio de acceso a datos para items de venta."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, sale_items: list[SaleItem]) -> list[SaleItem]:
        """Crea varios items de venta en una sola operación."""

        self.db.add_all(sale_items)
        self.db.flush()

        for sale_item in sale_items:
            self.db.refresh(sale_item)

        return sale_items
