from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.product_variant import (
    ProductVariantBarcodeBackfillResponse,
    ProductVariantCreate,
    ProductVariantResponse,
    ProductVariantUpdate,
)
from app.services.product_variant_service import ProductVariantService

router = APIRouter(prefix="/product-variants", tags=["Product Variants"])


@router.get("", response_model=list[ProductVariantResponse])
def list_product_variants(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[ProductVariantResponse]:
    service = ProductVariantService(db)

    return service.list_variants()


@router.get(
    "/by-product/{product_id}",
    response_model=list[ProductVariantResponse],
)
def list_variants_by_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> list[ProductVariantResponse]:
    service = ProductVariantService(db)

    return service.list_variants_by_product(product_id)


@router.get("/by-code/{code}", response_model=ProductVariantResponse)
def get_product_variant_by_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> ProductVariantResponse:
    service = ProductVariantService(db)

    return service.get_active_variant_by_code(code)


@router.post(
    "/barcodes/generate-missing",
    response_model=ProductVariantBarcodeBackfillResponse,
)
def generate_missing_variant_barcodes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ProductVariantBarcodeBackfillResponse:
    service = ProductVariantService(db)
    updated_variants = service.generate_missing_barcodes()

    return ProductVariantBarcodeBackfillResponse(
        updated_count=len(updated_variants),
        variants=[
            ProductVariantResponse.model_validate(variant)
            for variant in updated_variants
        ],
    )


@router.get("/{variant_id}", response_model=ProductVariantResponse)
def get_product_variant(
    variant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> ProductVariantResponse:
    service = ProductVariantService(db)

    return service.get_variant_by_id(variant_id)


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
