from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=list[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[ProductResponse]:
    service = ProductService(db)

    return service.list_products()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> ProductResponse:
    service = ProductService(db)

    return service.get_product_by_id(product_id)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ProductResponse:
    service = ProductService(db)

    return service.create_product(payload)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ProductResponse:
    service = ProductService(db)

    return service.update_product(product_id, payload)
