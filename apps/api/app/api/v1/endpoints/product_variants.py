from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.product_variant import (
    ProductVariantCreate,
    ProductVariantResponse,
    ProductVariantUpdate,
)
from app.services.product_variant_service import ProductVariantService

router = APIRouter(prefix="/product-variants", tags=["Product Variants"])


@router.get("", response_model=list[ProductVariantResponse])
def list_product_variants(
    db: Session = Depends(get_db),
) -> list[ProductVariantResponse]:
    service = ProductVariantService(db)

    return service.list_active_variants()


@router.get("/{variant_id}", response_model=ProductVariantResponse)
def get_product_variant(
    variant_id: UUID,
    db: Session = Depends(get_db),
) -> ProductVariantResponse:
    service = ProductVariantService(db)

    return service.get_variant_by_id(variant_id)


@router.get(
    "/by-product/{product_id}",
    response_model=list[ProductVariantResponse],
)
def list_variants_by_product(
    product_id: UUID,
    db: Session = Depends(get_db),
) -> list[ProductVariantResponse]:
    service = ProductVariantService(db)

    return service.list_variants_by_product(product_id)


@router.post(
    "",
    response_model=ProductVariantResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product_variant(
    payload: ProductVariantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ProductVariantResponse:
    service = ProductVariantService(db)

    return service.create_variant(payload)


@router.patch("/{variant_id}", response_model=ProductVariantResponse)
def update_product_variant(
    variant_id: UUID,
    payload: ProductVariantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ProductVariantResponse:
    service = ProductVariantService(db)

    return service.update_variant(variant_id, payload)
