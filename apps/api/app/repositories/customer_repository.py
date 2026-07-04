from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer


class CustomerRepository:
    """Repositorio de acceso a datos para clientes."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_all_active(self) -> list[Customer]:
        """Obtiene todos los clientes activos."""

        statement = (
            select(Customer)
            .where(Customer.is_active.is_(True))
            .order_by(Customer.created_at.desc())
        )

        return list(self.db.scalars(statement).all())

    def find_by_id(self, customer_id: UUID) -> Customer | None:
        """Obtiene un cliente por su identificador."""

        statement = select(Customer).where(Customer.id == customer_id)

        return self.db.scalar(statement)

    def find_by_document(
        self,
        document_type: str,
        document_number: str,
    ) -> Customer | None:
        """Obtiene un cliente por tipo y número de documento."""

        statement = select(Customer).where(
            Customer.document_type == document_type,
            Customer.document_number == document_number,
        )

        return self.db.scalar(statement)

    def create(self, customer: Customer) -> Customer:
        """Crea un nuevo cliente."""

        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)

        return customer

    def update(self, customer: Customer) -> Customer:
        """Actualiza un cliente existente."""

        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)

        return customer
