from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit_logs,
    auth,
    categories,
    culqi,
    customer_display,
    customer_display_devices,
    customers,
    document_lookup,
    health,
    inventory,
    payment_sessions,
    payments,
    product_variants,
    products,
    public_receipts,
    reports,
    returns,
    roles,
    sales,
    scanner_sessions,
    system,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(roles.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(public_receipts.router)
api_router.include_router(product_variants.router)
api_router.include_router(inventory.router)
api_router.include_router(document_lookup.router)
api_router.include_router(customers.router)
api_router.include_router(sales.router)
api_router.include_router(scanner_sessions.router)
api_router.include_router(payments.router)
api_router.include_router(payment_sessions.router)
api_router.include_router(customer_display.router)
api_router.include_router(customer_display_devices.router)
api_router.include_router(culqi.router)
api_router.include_router(reports.router)
api_router.include_router(returns.router)
api_router.include_router(audit_logs.router)
