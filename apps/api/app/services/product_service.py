from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.product import Product
from app.repositories.category_repository import CategoryRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate


ALLOWED_PRODUCT_STATUSES = {"ACTIVE", "INACTIVE", "DISCONTINUED"}


class ProductService:
    """Servicio de lógica de negocio para productos."""

    def __init__(self, db: Session) -> None:
        self.product_repository = ProductRepository(db)
        self.category_repository = CategoryRepository(db)

    def list_active_products(self) -> list[Product]:
        """Lista todos los productos activos."""

        return self.product_repository.find_all_active()

    def get_product_by_id(self, product_id: UUID) -> Product:
        """Obtiene un producto por ID."""

        product = self.product_repository.find_by_id(product_id)

        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado.",
            )

        return product

    def create_product(self, payload: ProductCreate) -> Product:
        """Crea un producto validando categoría y duplicados."""

        category = self.category_repository.find_by_id(payload.category_id)

        if category is None or not category.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La categoría seleccionada no existe o no está activa.",
            )

        existing_product = self.product_repository.find_by_name(payload.name)

        if existing_product is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un producto con ese nombre.",
            )

        product = Product(
            category_id=payload.category_id,
            name=payload.name.strip(),
            description=payload.description.strip() if payload.description else None,
            brand=payload.brand.strip() if payload.brand else None,
            status="ACTIVE",
        )

        return self.product_repository.create(product)

    def update_product(self, product_id: UUID, payload: ProductUpdate) -> Product:
        """Actualiza un producto existente."""

        product = self.get_product_by_id(product_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "category_id" in update_data and update_data["category_id"] is not None:
            category = self.category_repository.find_by_id(update_data["category_id"])

            if category is None or not category.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La categoría seleccionada no existe o no está activa.",
                )

            product.category_id = update_data["category_id"]

        if "name" in update_data and update_data["name"] is not None:
            normalized_name = update_data["name"].strip()
            existing_product = self.product_repository.find_by_name(normalized_name)

            if existing_product is not None and existing_product.id != product.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otro producto con ese nombre.",
                )

            product.name = normalized_name

        if "description" in update_data:
            description = update_data["description"]
            product.description = description.strip() if description else None

        if "brand" in update_data:
            brand = update_data["brand"]
            product.brand = brand.strip() if brand else None

        if "status" in update_data and update_data["status"] is not None:
            normalized_status = update_data["status"].upper()

            if normalized_status not in ALLOWED_PRODUCT_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Estado de producto inválido.",
                )

            product.status = normalized_status

        if "is_active" in update_data and update_data["is_active"] is not None:
            product.is_active = update_data["is_active"]

        return self.product_repository.update(product)
