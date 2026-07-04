from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    customers,
    document_lookup,
    health,
    inventory,
    payments,
    product_variants,
    products,
    roles,
    sales,
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
api_router.include_router(document_lookup.router)
api_router.include_router(customers.router)
api_router.include_router(sales.router)
api_router.include_router(payments.router)
api_router.include_router(roles.router)
