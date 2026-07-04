from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    health,
    inventory,
    product_variants,
    products,
    roles,
    system,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(product_variants.router)
api_router.include_router(inventory.router)
api_router.include_router(roles.router)
