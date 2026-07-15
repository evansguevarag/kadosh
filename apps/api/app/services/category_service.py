from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.category import Category
from app.repositories.category_repository import CategoryRepository
from app.schemas.category import (
    CategoryCreate,
    CategoryManagementResponse,
    CategoryUpdate,
)


class CategoryService:
    """Servicio de negocio para categorías."""

    def __init__(self, db: Session) -> None:
        self.repository = CategoryRepository(db)

    def list_active_categories(self) -> list[Category]:
        """Lista categorías activas."""

        return self.repository.find_all_active()

    def list_categories_for_management(self) -> list[CategoryManagementResponse]:
        """Lista todas las categorías con información de uso administrativo."""

        return [
            CategoryManagementResponse.model_validate(
                {
                    "id": category.id,
                    "name": category.name,
                    "description": category.description,
                    "is_active": category.is_active,
                    "created_at": category.created_at,
                    "updated_at": category.updated_at,
                    "product_count": product_count,
                },
            )
            for category, product_count in self.repository.find_all_with_product_count()
        ]

    def get_category_by_id(self, category_id: UUID) -> Category:
        """Obtiene una categoría por ID o lanza error controlado."""

        category = self.repository.find_by_id(category_id)

        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La categoría solicitada no existe.",
            )

        return category

    def create_category(self, payload: CategoryCreate) -> Category:
        """Crea una categoría validando duplicados."""

        normalized_name = payload.name.strip()

        existing_category = self.repository.find_by_name(normalized_name)

        if existing_category is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoría con ese nombre.",
            )

        category = Category(
            name=normalized_name,
            description=payload.description.strip()
            if payload.description is not None
            else None,
        )

        return self.repository.create(category)

    def update_category(
        self,
        category_id: UUID,
        payload: CategoryUpdate,
    ) -> Category:
        """Actualiza una categoría existente."""

        category = self.get_category_by_id(category_id)

        if payload.name is not None:
            normalized_name = payload.name.strip()
            existing_category = self.repository.find_by_name(normalized_name)

            if (
                existing_category is not None
                and existing_category.id != category.id
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otra categoría con ese nombre.",
                )

            category.name = normalized_name

        if payload.description is not None:
            category.description = payload.description.strip()

        if payload.is_active is not None:
            category.is_active = payload.is_active

        return self.repository.update(category)
