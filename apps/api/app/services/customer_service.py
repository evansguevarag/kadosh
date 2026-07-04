from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate


ALLOWED_DOCUMENT_TYPES = {"DNI", "RUC", "CE", "PASAPORTE"}


class CustomerService:
    """Servicio de lógica de negocio para clientes."""

    def __init__(self, db: Session) -> None:
        self.customer_repository = CustomerRepository(db)

    def list_active_customers(self) -> list[Customer]:
        """Lista todos los clientes activos."""

        return self.customer_repository.find_all_active()

    def get_customer_by_id(self, customer_id: UUID) -> Customer:
        """Obtiene un cliente por ID."""

        customer = self.customer_repository.find_by_id(customer_id)

        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado.",
            )

        return customer

    def create_customer(self, payload: CustomerCreate) -> Customer:
        """Crea un cliente validando documento duplicado."""

        document_type = payload.document_type.strip().upper()
        document_number = payload.document_number.strip()

        self._validate_document(document_type, document_number)

        existing_customer = self.customer_repository.find_by_document(
            document_type=document_type,
            document_number=document_number,
        )

        if existing_customer is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un cliente con ese documento.",
            )

        customer = Customer(
            document_type=document_type,
            document_number=document_number,
            first_name=payload.first_name.strip().upper(),
            last_name=payload.last_name.strip().upper(),
            phone=payload.phone.strip() if payload.phone else None,
            email=str(payload.email).strip().lower() if payload.email else None,
        )

        return self.customer_repository.create(customer)

    def update_customer(self, customer_id: UUID, payload: CustomerUpdate) -> Customer:
        """Actualiza un cliente existente."""

        customer = self.get_customer_by_id(customer_id)
        update_data = payload.model_dump(exclude_unset=True)

        next_document_type = customer.document_type
        next_document_number = customer.document_number

        if "document_type" in update_data and update_data["document_type"] is not None:
            next_document_type = update_data["document_type"].strip().upper()

        if "document_number" in update_data and update_data["document_number"] is not None:
            next_document_number = update_data["document_number"].strip()

        self._validate_document(next_document_type, next_document_number)

        existing_customer = self.customer_repository.find_by_document(
            document_type=next_document_type,
            document_number=next_document_number,
        )

        if existing_customer is not None and existing_customer.id != customer.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe otro cliente con ese documento.",
            )

        customer.document_type = next_document_type
        customer.document_number = next_document_number

        if "first_name" in update_data and update_data["first_name"] is not None:
            customer.first_name = update_data["first_name"].strip().upper()

        if "last_name" in update_data and update_data["last_name"] is not None:
            customer.last_name = update_data["last_name"].strip().upper()

        if "phone" in update_data:
            phone = update_data["phone"]
            customer.phone = phone.strip() if phone else None

        if "email" in update_data:
            email = update_data["email"]
            customer.email = str(email).strip().lower() if email else None

        if "is_active" in update_data and update_data["is_active"] is not None:
            customer.is_active = update_data["is_active"]

        return self.customer_repository.update(customer)

    def _validate_document(self, document_type: str, document_number: str) -> None:
        """Valida tipo y número de documento."""

        if document_type not in ALLOWED_DOCUMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo de documento inválido.",
            )

        if document_type == "DNI" and (
            not document_number.isdigit() or len(document_number) != 8
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El DNI debe tener exactamente 8 dígitos.",
            )

        if document_type == "RUC" and (
            not document_number.isdigit() or len(document_number) != 11
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El RUC debe tener exactamente 11 dígitos.",
            )
