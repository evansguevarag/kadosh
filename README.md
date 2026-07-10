# Kadosh

Sistema de punto de venta para tienda urbana Kadosh: productos, variantes, inventario, clientes, POS, pagos, pantalla de cliente, scanner móvil y reportes.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Base de datos: PostgreSQL/Supabase
- Reportes: Python y SQLAlchemy
- Pagos externos: Culqi

## Levantar API

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

API local:

```text
http://127.0.0.1:8010/api/v1
```

## Levantar Web

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev
```

Web local:

```text
http://localhost:3000
```

## Variables importantes

Backend `apps/api/.env`:

```env
SUPABASE_DATABASE_URL=postgresql+psycopg://...
JWT_SECRET_KEY=...
CULQI_PUBLIC_KEY=pk_test_...
CULQI_SECRET_KEY=sk_test_...
CULQI_DEFAULT_PHONE_NUMBER=924454127
APIPERU_TOKEN=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASSWORD=tu-app-password-de-google
SMTP_FROM_EMAIL=tu-correo@gmail.com
SMTP_USE_TLS=true
```

Frontend `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8010/api/v1
NEXT_PUBLIC_SCANNER_WEB_URL=http://192.168.18.232:3000
NEXT_PUBLIC_SCANNER_API_URL=http://192.168.18.232:8010/api/v1
NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_test_...
NEXT_PUBLIC_CULQI_RSA_ID=
NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY=
```

## Flujo recomendado de prueba

1. Entrar a `/login`.
2. Revisar productos en `/products`.
3. Revisar variantes y códigos de barras en `/product-variants`.
4. Generar códigos faltantes si hace falta.
5. Exportar códigos o imprimir etiquetas desde `/product-variants`.
6. Ajustar stock desde `/inventory`.
7. Vender desde `/pos`.
8. Cobrar manualmente con efectivo, Yape, Plin, transferencia o POS físico.
9. Imprimir comprobante desde el POS.
10. Revisar pagos y reimprimir desde `/payments`.
11. Revisar operación en `/dashboard` y `/reports`.

## Scanner móvil

Antes de usarlo en una base nueva, aplicar la migración:

```text
database/migrations/005_scanner_sessions.sql
```

Para usar el celular como scanner:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8010
```

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev -- --hostname 0.0.0.0
```

Abrir el POS desde la IP local de la PC, por ejemplo:

```text
http://192.168.18.232:3000/pos
```

En POS usar **Vincular celular** y abrir el enlace en el celular.
También se muestra un QR generado localmente para escanearlo directamente desde el teléfono.
El enlace del scanner debe verse con este formato:

```text
http://192.168.18.232:3000/scanner/ID_SESION/TOKEN
```

Si cambia la red WiFi o cambia la IP de la PC, actualizar en `apps/web/.env.local`:

```env
NEXT_PUBLIC_SCANNER_WEB_URL=http://NUEVA_IP_WIFI:3000
NEXT_PUBLIC_SCANNER_API_URL=http://NUEVA_IP_WIFI:8010/api/v1
```

Luego reiniciar `npm run dev`.

Nota: algunos navegadores móviles solo permiten cámara con HTTPS. Si la cámara no abre por HTTP local, usar el campo manual del scanner o configurar HTTPS local.

## Códigos y etiquetas

- Cada variante puede usar un código real del proveedor.
- Si el campo queda vacío al crear la variante, el backend genera un código interno único desde el SKU.
- En `/product-variants` se pueden generar códigos faltantes para variantes antiguas.
- Las etiquetas se imprimen con código de barras real Code 128.
- Se puede imprimir una etiqueta individual, imprimir todas las etiquetas ordenadas por SKU o exportar los códigos a CSV.

## Validación

Frontend:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run lint
npx tsc --noEmit
```

Backend:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
python -m compileall app
```

## Estado actual

Implementado:

- Login y roles.
- Dashboard operativo.
- Productos como cards con modal de creación/edición.
- Variantes con SKU, barcode automático, exportación CSV y etiquetas Code 128 imprimibles.
- Inventario con entradas, salidas, devoluciones, ajustes e historial.
- Clientes con consulta DNI local primero y API externa si falta.
- POS con scanner/input, carrito, cobro manual, tablet cliente y comprobante.
- Scanner móvil con QR de vinculación, sesiones persistidas en DB y bloqueo anti-duplicados.
- Pagos como historial, filtros y reimpresión.
- Pantalla cliente con Culqi Checkout.
- Reportes por rango, método de pago, productos vendidos y bajo stock.

Pendiente importante:

- Culqi QR/Yape/billeteras todavía requiere retomar documentación/credenciales oficiales.
- Cámara móvil en red local puede requerir HTTPS.
