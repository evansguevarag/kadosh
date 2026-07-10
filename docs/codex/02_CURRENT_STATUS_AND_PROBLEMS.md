# Kadosh POS - Estado actual y problemas pendientes

## Estado actual del proyecto

Kadosh POS ya tiene una base funcional con frontend, backend y base de datos conectada.

El sistema actualmente incluye:

- Login.
- Dashboard.
- Productos.
- Variantes de productos.
- Inventario.
- Clientes.
- POS.
- Pagos manuales.
- Reportes.
- Pantalla cliente en tablet.
- Vinculación de tablets por código.
- Integración inicial con Culqi.

## Backend actual

Ruta:

```text
apps/api
```

Servidor local:

```text
http://127.0.0.1:8010/api/v1
```

Comando para iniciar backend:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

## Frontend actual

Ruta:

```text
apps/web
```

Servidor local:

```text
http://localhost:3000
```

Comando para iniciar frontend:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev
```

## Base de datos actual

Proveedor:

```text
Supabase PostgreSQL
```

Tablas principales existentes:

```text
roles
users
customers
categories
products
product_variants
sales
sale_items
payments
payment_sessions
inventory_movements
audit_logs
customer_display_devices
customer_display_pairing_codes
```

## Módulos implementados

### Autenticación

El sistema tiene login y control básico por roles.

Roles esperados:

```text
ADMIN
SELLER
CASHIER
```

### Productos

Existe gestión de productos.

La tabla `products` tiene campos como:

```text
id
category_id
name
description
brand
status
is_active
created_at
updated_at
```

Pendiente:

- Agregar switch visual para activar/desactivar producto.
- Evitar mostrar productos inactivos en POS.
- Definir si producto `ARCHIVED` debe ocultarse totalmente.

### Variantes

Existe gestión de variantes por talla, color, SKU y stock.

La tabla `product_variants` usa:

```text
stock_quantity
min_stock_quantity
status
is_active
```

Importante:

No usar nombres antiguos como:

```text
stock
min_stock
current_stock
```

El estándar correcto debe ser:

```text
stock_quantity
min_stock_quantity
```

Pendiente:

- Agregar switch visual para activar/desactivar variante.
- Evitar mostrar variantes inactivas en POS.
- Decidir si variantes sin stock se ocultan o se muestran como agotadas.

### Inventario

El sistema registra movimientos de inventario.

Tipos esperados:

```text
ENTRADA
SALIDA
AJUSTE
VENTA
DEVOLUCION
```

Ya se corrigió la base de datos para permitir `VENTA` como movimiento automático cuando se crea una venta.

### Clientes

Existe gestión de clientes.

El sistema permite buscar por DNI mediante ApiPeruDev.

Pendiente:

- Mejorar tabla con scroll.
- Mantener validaciones limpias para DNI, RUC, CE y PASSPORT.
- Evitar duplicados por documento.

### Ventas / POS

El POS permite crear ventas y descontar stock.

Flujo actual esperado:

```text
1. Cajero selecciona variantes.
2. Agrega cantidades al carrito.
3. Crea venta.
4. Venta queda PENDING_PAYMENT.
5. Stock se descuenta.
6. Se registran movimientos de inventario.
7. Cajero puede registrar pago o enviar venta a tablet.
```

Pendiente:

- Validar mejor qué ocurre si se cancela una venta pendiente.
- Definir si al cancelar venta se devuelve stock.
- Evitar mostrar variantes inactivas o agotadas en POS.
- Mejorar actualización de la pantalla después de pago.

### Pagos manuales

Existen pagos manuales para:

```text
CASH
YAPE
PLIN
TRANSFER
POS
```

Pendiente:

- Mejorar flujo manual con código de operación.
- Permitir registrar pago Yape/Plin verificado por cajero.
- Mantener pagos manuales como respaldo aunque Culqi funcione.

### Payment Sessions

Las sesiones de pago permiten enviar una venta a una tablet.

Tabla:

```text
payment_sessions
```

Estados esperados:

```text
CREATED
SENT_TO_CUSTOMER
CUSTOMER_VIEWING
PROCESSING
PAID
FAILED
EXPIRED
CANCELLED
```

Corrección importante:

`payment_sessions.payment_id` debe permitir `NULL`, porque la sesión se crea antes de tener un pago.

Modelo esperado:

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

### Tablets / Pantalla cliente

Pantallas:

```text
/customer-displays
/customer-display/pair
/customer-display
```

Flujo:

```text
1. Admin genera código desde /customer-displays.
2. Tablet ingresa código en /customer-display/pair.
3. Backend vincula la tablet.
4. Tablet guarda device_id y device_token.
5. Tablet entra a /customer-display.
6. Tablet consulta sesiones activas cada 3 segundos.
7. Cuando POS envía venta, aparece monto.
```

Corrección reciente:

Antes se duplicaban tablets con el mismo nombre.

Ejemplo incorrecto:

```text
Tablet Caja 1
Tablet Caja 1
Tablet Caja 1
```

Se corrigió para que:

```text
Si no existe tablet, se crea.
Si ya existe tablet con ese nombre, se reutiliza.
Si se vuelve a vincular, se regenera token.
```

Archivos corregidos:

```text
apps/api/app/repositories/customer_display_device_repository.py
apps/api/app/services/customer_display_device_service.py
```

Pendiente:

- Mejorar UI de tablets.
- Agregar scroll a tabla.
- Tal vez agregar botón "Regenerar token".
- Tal vez agregar botón "Desvincular".
- Diferenciar mejor entre desactivar y desvincular.

## Integración Culqi actual

Actualmente existe integración inicial con Culqi usando token + charge.

Archivos principales:

```text
apps/api/app/api/v1/endpoints/culqi.py
apps/api/app/services/culqi_service.py
apps/api/app/schemas/culqi.py
apps/web/src/features/payments/culqi-service.ts
apps/web/src/app/customer-display/page.tsx
```

Endpoint actual:

```text
POST /api/v1/culqi/charges
```

Flujo actual:

```text
1. Cliente presiona "Pagar con Culqi" en tablet.
2. Frontend abre Culqi Checkout.
3. Culqi genera token.
4. Frontend recibe token_id.
5. Frontend llama /culqi/charges.
6. Backend crea cargo en Culqi.
7. Backend registra Payment.
8. Backend marca Sale como PAID.
9. Backend marca PaymentSession como PAID.
```

Payload actual aproximado hacia Culqi charges:

```python
{
    "amount": amount_in_cents,
    "currency_code": payment_session.currency,
    "email": str(payload.email),
    "source_id": payload.token_id,
    "capture": True,
    "description": f"Venta {sale.sale_number}",
    "metadata": {
        "sale_id": str(sale.id),
        "payment_session_id": str(payment_session.id),
        "sale_number": sale.sale_number,
    },
}
```

## Problema actual con Culqi

El usuario quiere que Culqi muestre opciones como:

```text
QR
Yape
Billeteras digitales
Banca móvil
Bancos
Tarjeta
```

En el frontend ya se activaron métodos visuales:

```ts
const paymentMethods = {
  tarjeta: true,
  yape: true,
  billetera: true,
  bancaMovil: true,
  agente: true,
  cuotealo: false,
};
```

Pero el flujo sigue siendo:

```text
token + charge
```

Eso puede no ser suficiente para que Culqi muestre QR/billeteras digitales correctamente.

## Objetivo pendiente con Culqi

Implementar o revisar el flujo correcto de Culqi para órdenes y checkout.

Posible objetivo:

```text
Backend crea orden Culqi.
Frontend abre Checkout con esa orden.
Checkout muestra métodos disponibles según cuenta Culqi.
Backend confirma o registra el pago.
Venta queda PAID.
PaymentSession queda PAID.
Payment queda registrado.
```

Importante:

- No inventar parámetros de Culqi.
- Revisar documentación oficial de Culqi.
- No romper `/culqi/charges`.
- Mantener `/culqi/charges` como fallback si es necesario.
- No exponer `CULQI_SECRET_KEY` en frontend.
- Frontend solo debe usar `NEXT_PUBLIC_CULQI_PUBLIC_KEY`.

## Archivos que Codex debe revisar para Culqi

```text
apps/api/app/api/v1/endpoints/culqi.py
apps/api/app/services/culqi_service.py
apps/api/app/schemas/culqi.py
apps/api/app/models/payment.py
apps/api/app/models/payment_session.py
apps/api/app/repositories/payment_repository.py
apps/api/app/repositories/payment_session_repository.py
apps/api/app/repositories/sale_repository.py
apps/web/src/features/payments/culqi-service.ts
apps/web/src/app/customer-display/page.tsx
apps/web/src/types/api.ts
```

## Problemas pendientes de UI

Agregar scroll en tablas largas:

```text
Productos
Variantes
Clientes
Inventario
Pagos
Tablets
Reportes
```

Ejemplo recomendado:

```tsx
<div className="max-h-130 overflow-auto rounded-2xl border">
  <Table>
    ...
  </Table>
</div>
```

Para cabecera fija:

```tsx
<TableHeader className="sticky top-0 z-10 bg-white">
```

## Pendientes antes de hacer commit

No hacer commit todavía hasta validar:

```text
1. Crear venta desde POS.
2. Enviar venta a tablet.
3. Tablet muestra monto.
4. Cliente puede intentar pago Culqi.
5. Backend registra Payment.
6. Sale cambia a PAID.
7. PaymentSession cambia a PAID.
8. POS y tablet refrescan correctamente.
9. Productos inactivos no aparecen en POS.
10. Variantes inactivas no aparecen en POS.
11. Tablas principales tienen scroll.
12. No se duplican tablets.
```

## No hacer

- No borrar pagos manuales.
- No borrar `/culqi/charges`.
- No borrar pantalla cliente.
- No cambiar toda la arquitectura.
- No meter secretos en frontend.
- No usar `eslint-disable`.
- No silenciar errores.
- No hacer cambios masivos sin probar.
- No hacer commit sin probar el flujo completo.