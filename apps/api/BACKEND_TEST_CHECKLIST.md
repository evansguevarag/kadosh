# Checklist de pruebas backend - Kadosh POS

## 1. Levantar backend

Desde apps/api:

Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

Swagger:
http://localhost:8000/docs

## 2. Salud del sistema

- GET /api/v1/health
- GET /api/v1/system/ping
- GET /api/v1/system/database-status

## 3. Autenticacion

- POST /api/v1/auth/login
- Copiar access_token
- Authorize con BearerAuth
- GET /api/v1/auth/me

## 4. Catalogo

- GET /api/v1/categories
- POST /api/v1/categories
- GET /api/v1/products
- POST /api/v1/products
- GET /api/v1/product-variants
- POST /api/v1/product-variants

## 5. Inventario

- POST /api/v1/inventory/movements con ENTRADA
- GET /api/v1/inventory/movements
- Verificar que el stock de la variante aumente

## 6. Clientes

- GET /api/v1/document-lookup/dni/{dni}
- POST /api/v1/customers
- GET /api/v1/customers

## 7. Ventas

- POST /api/v1/sales
- Verificar que descuente stock
- GET /api/v1/sales
- GET /api/v1/inventory/movements

## 8. Pagos manuales

- POST /api/v1/payments/manual
- Verificar que la venta pase a PAID si el pago cubre el total
- GET /api/v1/payments/by-sale/{sale_id}

## 9. Sesiones de pago

- Crear venta pendiente
- POST /api/v1/payment-sessions
- GET /api/v1/payment-sessions/by-device/tablet-caja-01

## 10. Pantalla cliente

- GET /api/v1/customer-display/sessions/tablet-caja-01
- Header requerido: X-Device-Secret
- No debe pedir BearerAuth

## 11. Culqi

- El frontend generara token_id con Culqi Checkout Custom
- POST /api/v1/culqi/charges
- Verificar que registre payment, actualice payment_session y marque sale como PAID

## 12. Reportes

- GET /api/v1/reports/dashboard
- Verificar ventas, ingresos, ticket promedio y bajo stock

## 13. Auditoria

- GET /api/v1/audit-logs
- Verificar acciones de ventas, pagos y sesiones

## Resultado esperado

El backend debe quedar listo para integrarse con el frontend Next.js.
