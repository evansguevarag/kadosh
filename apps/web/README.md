# Kadosh POS - Web

Frontend Next.js del sistema Kadosh POS.

## Desarrollo

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev
```

URL:

```text
http://localhost:3000
```

## Variables

Crear `apps/web/.env.local`:

```env
NEXT_PUBLIC_APP_NAME=Kadosh POS
NEXT_PUBLIC_API_URL=http://127.0.0.1:8010/api/v1
NEXT_PUBLIC_SCANNER_WEB_URL=http://TU_IP_WIFI:3000
NEXT_PUBLIC_SCANNER_API_URL=http://TU_IP_WIFI:8010/api/v1
NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_ID=tablet-caja-01
NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_SECRET=
NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_test_TU_LLAVE_PUBLICA
NEXT_PUBLIC_CULQI_RSA_ID=
NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY=
```

## Backend requerido

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Para usar scanner móvil desde celular, levantar API y web escuchando en la red local:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8010
```

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run dev -- --hostname 0.0.0.0
```

En la red actual, abrir:

```text
http://192.168.18.232:3000/pos
```

## Rutas principales

| Ruta | Uso |
| --- | --- |
| `/login` | Inicio de sesión |
| `/dashboard` | Indicadores operativos |
| `/products` | Productos base |
| `/product-variants` | Variantes, SKU, barcode y etiquetas |
| `/inventory` | Movimientos de stock |
| `/customers` | Directorio de clientes |
| `/pos` | Caja/POS |
| `/payments` | Historial de pagos y reimpresión |
| `/customer-display` | Pantalla para tablet cliente |
| `/scanner` | Scanner móvil vinculado al POS |
| `/reports` | Reportes operativos |

## Validación

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run lint
npx tsc --noEmit
```

## Notas

- Los pagos manuales usan `/payments/manual`.
- El POS imprime comprobantes con una vista exclusiva para impresión.
- Las variantes generan códigos internos automáticamente si no se ingresa barcode.
- `/product-variants` permite exportar códigos a CSV e imprimir etiquetas Code 128 una por una o en bloque.
- Para scanner móvil con cámara puede hacer falta abrir la web desde la IP local de la PC y usar HTTPS si el navegador lo exige.
