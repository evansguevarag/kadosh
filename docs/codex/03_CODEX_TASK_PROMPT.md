# Prompt para Codex - Continuar Kadosh POS

Actúa como Arquitecto de Software Senior Full Stack especializado en:

- FastAPI.
- SQLAlchemy.
- PostgreSQL.
- Supabase.
- Next.js.
- TypeScript.
- POS retail.
- Integración de pagos Culqi.
- Seguridad backend/frontend.
- Arquitectura limpia por capas.

Estoy trabajando en un proyecto llamado **Kadosh POS**.

Antes de escribir código, lee estos archivos en orden:

```text
docs/codex/01_PROJECT_CONTEXT.md
docs/codex/02_CURRENT_STATUS_AND_PROBLEMS.md
```

Después revisa el código real del proyecto.

## Objetivo principal

Continuar exactamente desde el punto actual del proyecto.

Lo último que se estaba trabajando era la integración de **Culqi** para pasar del flujo actual:

```text
token + charge
```

a un flujo más completo que permita, si Culqi lo soporta en la cuenta del comercio:

```text
QR
Yape
Billeteras digitales
Banca móvil
Bancos
Tarjeta
```

El sistema actualmente ya tiene un flujo inicial de tarjeta con Culqi, pero se sospecha que para QR/billeteras digitales se necesita implementar **Culqi Orders / Checkout** o el flujo correcto indicado por la documentación oficial de Culqi.

## Contexto técnico actual

Backend local:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

URL backend:

```text
http://127.0.0.1:8010/api/v1
```

Frontend local:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev
```

URL frontend:

```text
http://localhost:3000
```

## Rutas importantes de frontend

```text
/login
/dashboard
/pos
/products
/product-variants
/inventory
/customers
/payments
/reports
/customer-displays
/customer-display/pair
/customer-display
```

## Flujo POS esperado

```text
1. Usuario inicia sesión.
2. Entra al POS.
3. Agrega productos/variantes al carrito.
4. Crea venta.
5. La venta queda PENDING_PAYMENT.
6. Se descuenta stock.
7. Se registra movimiento de inventario tipo VENTA.
8. El cajero puede registrar pago manual o enviar la venta a una tablet.
9. La tablet muestra el monto.
10. El cliente paga.
11. El backend registra Payment.
12. La venta queda PAID.
13. La PaymentSession queda PAID.
```

## Flujo tablet actual

```text
1. Admin entra a /customer-displays.
2. Genera código para una tablet, por ejemplo Tablet Caja 1.
3. Tablet entra a /customer-display/pair.
4. Se ingresa el código.
5. Backend vincula tablet.
6. Tablet guarda device_id y device_token en localStorage.
7. Tablet entra a /customer-display.
8. Tablet consulta sesiones activas cada 3 segundos.
9. Cuando POS envía una venta, aparece el monto.
10. Cliente presiona "Pagar con Culqi".
```

## Archivos que debes revisar primero

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

## Integración Culqi actual

El endpoint actual es:

```text
POST /api/v1/culqi/charges
```

El flujo actual es:

```text
1. Frontend abre Culqi Checkout.
2. Culqi genera token.
3. Frontend recibe token_id.
4. Frontend llama /culqi/charges.
5. Backend crea charge en Culqi.
6. Backend registra Payment.
7. Backend marca Sale como PAID.
8. Backend marca PaymentSession como PAID.
```

Este flujo no debe eliminarse sin razón.

Debe mantenerse como fallback si sirve para tarjeta.

## Tarea principal

Revisar documentación oficial de Culqi y diseñar la integración correcta para QR, Yape, billeteras digitales, banca móvil o bancos.

No inventes payloads.

No inventes nombres de campos.

No asumas que un parámetro existe si no está en la documentación oficial.

Si Culqi requiere Orders para mostrar QR/billeteras, implementa el flujo de Orders correctamente.

Si Culqi permite QR/billeteras con otro flujo distinto, implementa ese flujo.

## Reglas obligatorias

1. No romper `/culqi/charges`.
2. No borrar pagos manuales.
3. No borrar pantalla cliente.
4. No usar `eslint-disable`.
5. No ocultar errores.
6. No exponer `CULQI_SECRET_KEY` en frontend.
7. El frontend solo puede usar `NEXT_PUBLIC_CULQI_PUBLIC_KEY`.
8. Mantener arquitectura por capas.
9. Mantener mensajes visibles en español.
10. Mantener nombres de código en inglés.
11. No hacer cambios masivos innecesarios.
12. No hacer commit si no se prueba el flujo.
13. No cambiar toda la arquitectura.
14. No dejar código temporal.
15. No silenciar errores de TypeScript ni Python.

## Flujo ideal a implementar si Culqi Orders aplica

```text
1. Tablet tiene una PaymentSession activa.
2. Cliente presiona "Pagar con Culqi".
3. Frontend llama al backend para crear una orden Culqi asociada a payment_session_id.
4. Backend valida:
   - PaymentSession existe.
   - PaymentSession no está en estado final.
   - PaymentSession no expiró.
   - Sale existe.
   - Sale no está PAID.
   - Sale no está CANCELLED.
5. Backend crea orden en Culqi.
6. Backend devuelve al frontend los datos necesarios para abrir Checkout.
7. Frontend abre Culqi Checkout usando esa orden.
8. Culqi muestra los métodos disponibles según la cuenta:
   - tarjeta.
   - Yape.
   - QR.
   - billetera digital.
   - banca móvil.
   - agente.
   - otros si aplica.
9. Si el pago se aprueba:
   - Backend registra Payment.
   - Payment.status queda PAID.
   - Sale.status queda PAID.
   - Sale.paid_at se completa.
   - PaymentSession.payment_id se completa.
   - PaymentSession.status queda PAID.
   - PaymentSession.completed_at se completa.
10. Si el pago falla:
   - Registrar fallo si corresponde.
   - No marcar la venta como pagada.
   - No dejar sesión en estado inconsistente.
```

## Consideraciones de base de datos

La tabla `payments` ya tiene campos útiles para Culqi:

```text
provider_order_id
provider_transaction_id
culqi_charge_id
raw_response
operation_code
status
paid_at
failed_at
```

Usa esos campos antes de proponer migraciones nuevas.

La tabla `payment_sessions` debe permitir `payment_id` como NULL porque la sesión se crea antes de existir el pago.

Modelo esperado:

```python
payment_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    ForeignKey("payments.id", onupdate="CASCADE", ondelete="SET NULL"),
    nullable=True,
    index=True,
)
```

## Posibles endpoints nuevos

Solo si la documentación oficial lo justifica, agregar endpoints como:

```text
POST /api/v1/culqi/orders
POST /api/v1/culqi/orders/{order_id}/confirm
POST /api/v1/culqi/confirm-payment
```

Los nombres pueden cambiar si existe una convención mejor en el proyecto, pero deben ser claros.

## Resultado esperado para backend

Si se implementa Orders, actualizar o crear:

```text
apps/api/app/schemas/culqi.py
apps/api/app/services/culqi_service.py
apps/api/app/api/v1/endpoints/culqi.py
```

Debe incluir:

- Schemas Pydantic claros.
- Validación de PaymentSession.
- Validación de Sale.
- Llamada segura a Culqi con secret key en backend.
- Manejo de errores de Culqi.
- Registro de auditoría si corresponde.
- Registro de Payment cuando el pago se confirme.
- Actualización de Sale.
- Actualización de PaymentSession.

## Resultado esperado para frontend

Actualizar:

```text
apps/web/src/features/payments/culqi-service.ts
apps/web/src/app/customer-display/page.tsx
```

Debe incluir:

- Servicio para crear orden Culqi si aplica.
- Apertura de Culqi Checkout con datos de la orden si aplica.
- Mantener fallback de charge/token si corresponde.
- Mostrar mensajes claros al cliente.
- No dejar al cliente en pantalla bloqueada si falla.
- Refrescar sesiones después del pago.
- Mantener experiencia simple para tablet.

## Cómo probar

Probar mínimo:

```text
1. Iniciar backend en 8010.
2. Iniciar frontend en 3000.
3. Login como admin.
4. Ir a POS.
5. Crear venta.
6. Enviar venta a Tablet Caja 1.
7. Abrir /customer-display.
8. Ver monto.
9. Presionar Pagar con Culqi.
10. Ver si Culqi muestra QR/Yape/billeteras/banca móvil.
11. Completar o simular pago.
12. Verificar en base de datos:
    - payments
    - sales
    - payment_sessions
13. Verificar que la venta cambie a PAID si corresponde.
14. Verificar que la PaymentSession cambie a PAID si corresponde.
```

## Pendientes después de Culqi

Después de Culqi, continuar con:

```text
1. Switch activo/inactivo en productos.
2. Switch activo/inactivo en variantes.
3. POS debe ocultar productos inactivos.
4. POS debe ocultar variantes inactivas.
5. Agregar scroll a tablas grandes.
6. Mejorar pagos manuales Yape/Plin/Transferencia.
7. Probar flujo completo antes del commit.
```

## Formato de entrega obligatorio

Cuando modifiques o reemplaces un archivo, entrégalo archivo por archivo.

Para cada archivo:

```text
1. Ruta del archivo.
2. Qué problema resuelve.
3. Código completo.
4. Comando PowerShell listo para copiar y pegar.
5. Cómo probar.
```

El comando PowerShell debe tener esta forma:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos"

@'
CONTENIDO_COMPLETO_DEL_ARCHIVO
'@ | Set-Content -Path "ruta\archivo.ext" -Encoding UTF8
```

Si el archivo tiene bloques Markdown internos, evita que se rompa el formato.

No usar Canvas.

No entregar ZIP.

No mezclar varios archivos en una sola respuesta si el cambio es grande.

## Instrucción final

Primero analiza y explica el plan técnico.

Luego implementa por pasos.

No empieces a modificar archivos hasta tener claro si Culqi QR/billeteras requiere Orders u otro flujo documentado oficialmente.