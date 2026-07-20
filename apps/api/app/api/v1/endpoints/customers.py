from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerResolveDniResponse,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerResponse])
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[CustomerResponse]:
    service = CustomerService(db)

    return service.list_active_customers()


@router.get(
    "/by-document/{document_type}/{document_number}",
    response_model=CustomerResponse,
)
def get_customer_by_document(
    document_type: str,
    document_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> CustomerResponse:
    service = CustomerService(db)

    return service.get_customer_by_document(document_type, document_number)


@router.post(
    "/resolve-dni/{dni}",
    response_model=CustomerResolveDniResponse,
)
def resolve_customer_by_dni(
    dni: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> CustomerResolveDniResponse:
    service = CustomerService(db)
    customer, source = service.resolve_dni_customer(dni)

    return CustomerResolveDniResponse(
        customer=CustomerResponse.model_validate(customer),
        source=source,
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> CustomerResponse:
    service = CustomerService(db)

    return service.get_customer_by_id(customer_id)


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> CustomerResponse:
    service = CustomerService(db)

    return service.create_customer(payload)


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> CustomerResponse:
    service = CustomerService(db)

    return service.update_customer(customer_id, payload)
