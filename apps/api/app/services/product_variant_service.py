from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.product_variant import ProductVariant
from app.repositories.product_repository import ProductRepository
from app.repositories.product_variant_repository import ProductVariantRepository
from app.schemas.product_variant import ProductVariantCreate, ProductVariantUpdate


ALLOWED_VARIANT_STATUSES = {"ACTIVE", "INACTIVE", "DISCONTINUED"}


class ProductVariantService:
    """Servicio de lógica de negocio para variantes de productos."""

    def __init__(self, db: Session) -> None:
        self.product_repository = ProductRepository(db)
        self.variant_repository = ProductVariantRepository(db)

    def list_active_variants(self) -> list[ProductVariant]:
        """Lista todas las variantes activas."""

        return self.variant_repository.find_all_active()

    def list_variants_by_product(self, product_id: UUID) -> list[ProductVariant]:
        """Lista variantes activas de un producto."""

        product = self.product_repository.find_by_id(product_id)

        if product is None or not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado.",
            )

        return self.variant_repository.find_by_product_id(product_id)

    def get_variant_by_id(self, variant_id: UUID) -> ProductVariant:
        """Obtiene una variante por ID."""

        variant = self.variant_repository.find_by_id(variant_id)

        if variant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Variante de producto no encontrada.",
            )

        return variant

    def create_variant(self, payload: ProductVariantCreate) -> ProductVariant:
        """Crea una variante validando producto, SKU y código de barras."""

        product = self.product_repository.find_by_id(payload.product_id)

        if product is None or not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El producto seleccionado no existe o no está activo.",
            )

        normalized_sku = payload.sku.strip().upper()
        existing_sku = self.variant_repository.find_by_sku(normalized_sku)

        if existing_sku is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una variante con ese SKU.",
            )

        normalized_barcode = payload.barcode.strip() if payload.barcode else None

        if normalized_barcode:
            existing_barcode = self.variant_repository.find_by_barcode(normalized_barcode)

            if existing_barcode is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe una variante con ese código de barras.",
                )

        variant = ProductVariant(
            product_id=payload.product_id,
            sku=normalized_sku,
            size=payload.size.strip().upper() if payload.size else None,
            color=payload.color.strip().title() if payload.color else None,
            barcode=normalized_barcode,
            cost_price=payload.cost_price,
            sale_price=payload.sale_price,
            stock_quantity=payload.stock_quantity,
            min_stock_quantity=payload.min_stock_quantity,
            status="ACTIVE",
        )

        return self.variant_repository.create(variant)

    def update_variant(
        self,
        variant_id: UUID,
        payload: ProductVariantUpdate,
    ) -> ProductVariant:
        """Actualiza una variante existente."""

        variant = self.get_variant_by_id(variant_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "sku" in update_data and update_data["sku"] is not None:
            normalized_sku = update_data["sku"].strip().upper()
            existing_sku = self.variant_repository.find_by_sku(normalized_sku)

            if existing_sku is not None and existing_sku.id != variant.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otra variante con ese SKU.",
                )

            variant.sku = normalized_sku

        if "size" in update_data:
            size = update_data["size"]
            variant.size = size.strip().upper() if size else None

        if "color" in update_data:
            color = update_data["color"]
            variant.color = color.strip().title() if color else None

        if "barcode" in update_data:
            barcode = update_data["barcode"]
            normalized_barcode = barcode.strip() if barcode else None

            if normalized_barcode:
                existing_barcode = self.variant_repository.find_by_barcode(
                    normalized_barcode
                )

                if existing_barcode is not None and existing_barcode.id != variant.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Ya existe otra variante con ese código de barras.",
                    )

            variant.barcode = normalized_barcode

        if "cost_price" in update_data and update_data["cost_price"] is not None:
            variant.cost_price = update_data["cost_price"]

        if "sale_price" in update_data and update_data["sale_price"] is not None:
            variant.sale_price = update_data["sale_price"]

        if "stock_quantity" in update_data and update_data["stock_quantity"] is not None:
            variant.stock_quantity = update_data["stock_quantity"]

        if (
            "min_stock_quantity" in update_data
            and update_data["min_stock_quantity"] is not None
        ):
            variant.min_stock_quantity = update_data["min_stock_quantity"]

        if "status" in update_data and update_data["status"] is not None:
            normalized_status = update_data["status"].upper()

            if normalized_status not in ALLOWED_VARIANT_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Estado de variante inválido.",
                )

            variant.status = normalized_status

        if "is_active" in update_data and update_data["is_active"] is not None:
            variant.is_active = update_data["is_active"]

        return self.variant_repository.update(variant)
