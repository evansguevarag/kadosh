# Kadosh POS - Contexto general del proyecto

## Nombre del proyecto

Kadosh POS

## Objetivo

Construir un sistema POS profesional para una tienda de ropa urbana llamada Kadosh.

El sistema debe permitir:

- Gestión de productos.
- Gestión de variantes por talla, color, SKU y stock.
- Gestión de clientes.
- Ventas desde POS.
- Descuento automático de stock.
- Pagos manuales y digitales.
- Pantalla cliente en tablet.
- Integración con Culqi.
- Reportes de ventas, inventario y bajo stock.
- Auditoría de acciones importantes.

## Estructura principal

```text
kadosh-pos/
├── apps/
│   ├── api/
│   └── web/
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── diagrams/
├── docs/
└── scripts/
```

## Backend

Ruta:

```text
apps/api
```

Tecnologías:

- Python 3.12.
- FastAPI.
- SQLAlchemy.
- PostgreSQL Supabase.
- Psycopg.
- HTTPX.
- JWT.
- Pydantic.

Comando local actual:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

URL backend local:

```text
http://127.0.0.1:8010/api/v1
```

## Frontend

Ruta:

```text
apps/web
```

Tecnologías:

- Next.js.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- lucide-react.
- sonner.
- Culqi Checkout JS.

Comando local actual:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev
```

URL frontend local:

```text
http://localhost:3000
```

## Base de datos

Proveedor:

```text
Supabase PostgreSQL
```

Tablas principales:

- roles.
- users.
- customers.
- categories.
- products.
- product_variants.
- sales.
- sale_items.
- payments.
- payment_sessions.
- inventory_movements.
- audit_logs.
- customer_display_devices.
- customer_display_pairing_codes.

## Flujo POS esperado

```text
1. Usuario inicia sesión como ADMIN, SELLER o CASHIER.
2. Entra al POS.
3. Agrega variantes al carrito.
4. Crea venta.
5. El sistema descuenta stock.
6. La venta queda PENDING_PAYMENT.
7. El usuario puede registrar pago manual o enviar venta a tablet.
8. La tablet muestra el monto al cliente.
9. Cliente paga.
10. El sistema registra el pago.
11. La venta cambia a PAID.
12. La sesión de pago cambia a PAID.
```

## Pantalla cliente / tablet

Flujo actual:

```text
1. Admin entra a /customer-displays.
2. Genera código para Tablet Caja 1.
3. Tablet entra a /customer-display/pair.
4. Se ingresa el código.
5. El backend vincula la tablet.
6. La tablet guarda device_id y device_token en localStorage.
7. La tablet entra a /customer-display.
8. Caja envía una venta.
9. Tablet consulta sesiones activas cada 3 segundos.
10. Cliente ve el monto y paga.
```

## Corrección reciente de tablets

Antes, cada código de vinculación podía crear una nueva tablet aunque tuviera el mismo nombre. Eso generaba duplicados como:

```text
Tablet Caja 1
Tablet Caja 1
Tablet Caja 1
```

Se corrigió para que:

- Si no existe una tablet con ese nombre, se crea.
- Si ya existe una tablet con ese nombre, se reutiliza.
- Si se vuelve a vincular, se regenera el token.
- Se limpiaron tablets duplicadas de desarrollo.

Archivos modificados:

```text
apps/api/app/repositories/customer_display_device_repository.py
apps/api/app/services/customer_display_device_service.py
```

## Corrección reciente de PaymentSession

La sesión de pago se crea antes de que exista un pago real. Por eso `payment_sessions.payment_id` debe permitir `NULL`.

La base de datos ya fue ajustada y también debe quedar corregido el modelo Python:

```python
payment_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    ForeignKey("payments.id", onupdate="CASCADE", ondelete="SET NULL"),
    nullable=True,
    index=True,
)
```

Archivo:

```text
apps/api/app/models/payment_session.py
```

## Integración Culqi actual

Actualmente el sistema tiene un flujo inicial de Culqi basado en:

```text
Culqi Checkout genera token.
Frontend recibe token_id.
Frontend manda token_id al backend.
Backend crea charge en Culqi.
Backend registra Payment.
Backend marca Sale como PAID.
Backend marca PaymentSession como PAID.
```

Endpoint actual:

```text
POST /api/v1/culqi/charges
```

Archivos principales:

```text
apps/api/app/api/v1/endpoints/culqi.py
apps/api/app/services/culqi_service.py
apps/api/app/schemas/culqi.py
apps/web/src/features/payments/culqi-service.ts
apps/web/src/app/customer-display/page.tsx
```

## Lo último que se estaba trabajando

Se estaba analizando que Culqi también puede manejar QR, Yape, billeteras digitales, banca móvil o bancos mediante un flujo de órdenes o checkout más completo.

El problema actual es que el sistema solo tiene token + charge. Para QR/billeteras probablemente se necesita implementar Culqi Orders / Checkout, sin romper el flujo actual de `/culqi/charges`.

## Reglas de desarrollo

- No usar `eslint-disable`.
- No romper funcionalidades existentes.
- No eliminar módulos sin revisar dependencias.
- Mantener nombres en inglés para código y rutas.
- Mantener mensajes de UI en español.
- Mantener arquitectura por capas:
  - model.
  - schema.
  - repository.
  - service.
  - endpoint.
- Mantener errores claros con `HTTPException` en backend.
- Mantener TypeScript estricto en frontend.
- Validar bien nulls y estados.
- No exponer llaves secretas en frontend.
- No poner la secret key de Culqi en archivos públicos.
- No borrar pagos manuales.
- No borrar el flujo actual de Culqi charges.
- No borrar la pantalla cliente.