# Despliegue completo de Kadosh POS en Vercel

Esta guía describe el despliegue de Kadosh POS desde este repositorio. Está
adaptada a su arquitectura real: un monorepo con un frontend Next.js, una API
FastAPI y una base PostgreSQL alojada en Supabase.

La estrategia recomendada es crear dos proyectos independientes en Vercel,
conectados al mismo repositorio Git:

| Proyecto Vercel | Directorio raíz | Tecnología | Resultado |
| --- | --- | --- | --- |
| `kadosh-pos-api` | `apps/api` | FastAPI/Python 3.12 | URL pública del backend |
| `kadosh-pos-web` | `apps/web` | Next.js 16 | URL pública del frontend |

Vercel recomienda crear un proyecto por cada aplicación de un monorepo y
seleccionar su Root Directory. Consulta la documentación oficial de
[monorepos de Vercel](https://vercel.com/docs/monorepos).

## 1. Arquitectura que se desplegará

### Frontend

- Framework: Next.js 16 con App Router.
- Lenguaje: TypeScript.
- Directorio: `apps/web`.
- Comando de compilación: `npm run build`.
- Variables locales: `apps/web/.env.local`.
- Archivo de ejemplo: `apps/web/.env.example`.
- Consume el backend mediante `NEXT_PUBLIC_API_URL`.

### Backend

- Framework: FastAPI.
- Interfaz: ASGI.
- Runtime: Python 3.12, fijado en `apps/api/.python-version`.
- Directorio: `apps/api`.
- Entrada ASGI: `app/main.py`, variable `app`.
- Dependencias: `apps/api/requirements.txt`.
- Configuración: `apps/api/vercel.json`.
- Todas las rutas se ejecutan dentro de una sola Vercel Function Python.

La documentación oficial confirma que el runtime Python admite aplicaciones
ASGI mediante una variable `app`. También advierte que Python no elimina
automáticamente dependencias sin usar al construir la función. Consulta
[Python Runtime de Vercel](https://vercel.com/docs/functions/runtimes/python).

### Base de datos

- Proveedor: Supabase PostgreSQL.
- Conexión de producción: Supavisor transaction pooler.
- Puerto esperado: `6543`.
- SQLAlchemy utiliza `NullPool` para no conservar un pool local por cada
  instancia serverless.
- Los prepared statements están desactivados mediante `prepare_threshold=None`.
- Crear el motor SQLAlchemy no abre inmediatamente una conexión. La conexión se
  solicita cuando un endpoint ejecuta su primera consulta.

Supabase recomienda transaction mode para funciones serverless y exige
desactivar prepared statements. Consulta
[conexiones PostgreSQL de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Qué permanece fuera de Vercel

La base de datos no se mueve a Vercel. Vercel aloja el frontend y la API; los
datos continúan en el mismo proyecto Supabase indicado por
`SUPABASE_DATABASE_URL`.

Por tanto:

- Un redeploy no elimina productos, ventas, clientes ni usuarios.
- No es necesario crear nuevamente el administrador.
- Cambiar de URL frontend/backend no crea una base nueva.
- Solo se perdería el acceso a los datos si se configura otra URL de Supabase,
  se elimina el proyecto Supabase o se ejecuta una operación destructiva.
- Las migraciones se aplican contra Supabase, no contra el filesystem efímero
  de Vercel.

## 3. Requisitos previos

Antes de desplegar, comprobar:

1. El repositorio está publicado en GitHub, GitLab o Bitbucket.
2. La rama de producción, normalmente `main`, contiene los commits deseados.
3. Las migraciones de `database/migrations` están aplicadas en Supabase.
4. Se puede iniciar sesión localmente.
5. El frontend pasa lint, TypeScript y build.
6. El backend compila y puede conectarse a Supabase.
7. Se dispone de todas las claves reales, sin pegarlas en documentos o commits.

Comandos de validación local:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm install
npm run lint
npx tsc --noEmit
npm run build
```

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\python.exe -m compileall app
```

Nunca subir estos archivos:

```text
apps/api/.env
apps/web/.env.local
```

Ya están ignorados por Git. Los archivos `.env.example` sí se versionan porque
solo contienen valores de muestra.

## 4. Orden correcto de despliegue

El orden evita referencias circulares entre las URLs:

1. Crear y desplegar el proyecto backend con un `FRONTEND_URL` temporal.
2. Copiar la URL de producción del backend.
3. Crear el frontend usando esa URL en `NEXT_PUBLIC_API_URL`.
4. Copiar la URL de producción del frontend.
5. Actualizar `FRONTEND_URL` en el backend.
6. Actualizar las URLs del scanner en el frontend.
7. Redeploy backend y frontend.
8. Ejecutar las pruebas posteriores al despliegue.

Los cambios en variables de Vercel solo se aplican a despliegues nuevos. Después
de editar una variable se debe hacer Redeploy. Consulta
[variables de entorno de Vercel](https://vercel.com/docs/environment-variables).

## 5. Desplegar el backend

### 5.1 Crear el proyecto

1. Entrar a [Vercel](https://vercel.com/).
2. Seleccionar **Add New > Project**.
3. Importar el repositorio `kadosh-pos`.
4. Asignar un nombre, por ejemplo `kadosh-pos-api`.
5. En **Root Directory**, seleccionar `apps/api`.
6. Dejar Framework Preset como `Other` si Vercel no detecta Python.
7. No configurar Output Directory.
8. No escribir un comando manual para iniciar Uvicorn. Vercel carga directamente
   la aplicación ASGI definida en `app/main.py`.

El archivo `apps/api/vercel.json` realiza lo siguiente:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "regions": ["sfo1"],
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

Todas las rutas llegan a una sola aplicación FastAPI. Esto permite reutilizar
imports y conexiones dentro de una instancia caliente.

### 5.2 Variables del backend

En **Project > Settings > Environment Variables**, crear las siguientes
variables. Marcar al menos **Production**. Para previews funcionales, marcarlas
también como **Preview**, teniendo presente que `FRONTEND_URL` deberá permitir
el dominio que realmente consumirá la API.

| Variable | Producción | Secreta | Observación |
| --- | --- | --- | --- |
| `APP_NAME` | `Kadosh POS API` | No | Nombre visible en OpenAPI |
| `APP_ENV` | `production` | No | Distingue producción de local |
| `APP_VERSION` | `0.1.0` | No | Versión informativa |
| `API_V1_PREFIX` | `/api/v1` | No | No retirar la barra inicial |
| `FRONTEND_URL` | `https://TU-FRONTEND.vercel.app` | No | Sin barra final |
| `SUPABASE_DATABASE_URL` | Valor real de Supabase | Sí | Usar transaction pooler `:6543` |
| `JWT_SECRET_KEY` | Secreto largo y aleatorio | Sí | Debe ser igual entre redeploys |
| `JWT_ALGORITHM` | `HS256` | No | Algoritmo actual |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | No | Duración del access token |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | No | Duración configurada del refresh token |
| `CULQI_PUBLIC_KEY` | Llave pública real | No | Usar test o live según el entorno |
| `CULQI_SECRET_KEY` | Llave secreta real | Sí | Solo backend |
| `CULQI_DEFAULT_PHONE_NUMBER` | Número configurado | Sí | No inventar uno para producción |
| `APIPERU_BASE_URL` | `https://apiperu.dev/api` | No | Se conserva |
| `APIPERU_TOKEN` | Token real | Sí | Solo backend |
| `CUSTOMER_DISPLAY_DEVICE_ID` | Identificador actual | No | Debe coincidir con el flujo usado |
| `CUSTOMER_DISPLAY_DEVICE_SECRET` | Secreto actual | Sí | Debe coincidir con el frontend actual |
| `SMTP_HOST` | `smtp.gmail.com` | No | Gmail SMTP |
| `SMTP_PORT` | `587` | No | STARTTLS |
| `SMTP_USER` | Correo emisor | Sí | Cuenta Gmail configurada |
| `SMTP_PASSWORD` | App Password de Google | Sí | No usar contraseña normal |
| `SMTP_FROM_EMAIL` | Correo emisor | Sí | Normalmente igual a SMTP_USER |
| `SMTP_USE_TLS` | `true` | No | Requerido para puerto 587 |

No colocar comillas alrededor de los valores desde el formulario de Vercel.
No copiar los textos `change_this...` del archivo de ejemplo.

Para generar un JWT secret desde PowerShell:

```powershell
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Guardar el resultado solamente en Vercel y en un gestor de contraseñas. Si se
cambia `JWT_SECRET_KEY`, todos los JWT emitidos anteriormente dejan de ser
válidos y los usuarios deben iniciar sesión de nuevo.

### 5.3 Primera publicación del backend

1. Usar temporalmente `FRONTEND_URL=https://example.invalid` si el frontend aún
   no tiene dominio.
2. Pulsar **Deploy**.
3. Esperar que finalice el build Python.
4. Copiar el dominio de producción, por ejemplo:

```text
https://kadosh-pos-api.vercel.app
```

5. Probar el endpoint público:

```text
https://kadosh-pos-api.vercel.app/api/v1/health
```

Respuesta esperada:

```json
{"status":"ok"}
```

Este endpoint no consulta Supabase, no valida JWT y no ejecuta lógica de
negocio. Sirve para separar el tiempo de arranque de FastAPI del tiempo de base
de datos.

## 6. Desplegar el frontend

### 6.1 Crear el proyecto

1. Seleccionar nuevamente **Add New > Project**.
2. Importar el mismo repositorio.
3. Nombrar el proyecto, por ejemplo `kadosh-pos-web`.
4. Seleccionar `apps/web` como **Root Directory**.
5. Verificar que Framework Preset sea **Next.js**.
6. Mantener Install Command automático o `npm install`.
7. Mantener Build Command automático o `npm run build`.
8. Mantener Output Directory automático de Next.js.

### 6.2 Variables del frontend

Crear estas variables para Production:

| Variable | Valor de producción | Observación |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Kadosh POS` | Nombre de la aplicación |
| `NEXT_PUBLIC_API_URL` | `https://TU-BACKEND.vercel.app/api/v1` | Debe incluir `/api/v1` |
| `NEXT_PUBLIC_SCANNER_WEB_URL` | `https://TU-FRONTEND.vercel.app` | Sin barra final |
| `NEXT_PUBLIC_SCANNER_API_URL` | `https://TU-BACKEND.vercel.app/api/v1` | API pública HTTPS |
| `NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_ID` | Valor actual | Copiar desde configuración real |
| `NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_SECRET` | Valor actual | Visible en el navegador |
| `NEXT_PUBLIC_CULQI_PUBLIC_KEY` | Llave pública Culqi | Nunca usar la secret key aquí |
| `NEXT_PUBLIC_CULQI_RSA_ID` | RSA ID actual | Puede quedar vacío si el flujo no lo usa |
| `NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY` | Llave pública RSA completa | Conservar saltos de línea |

Toda variable cuyo nombre empieza con `NEXT_PUBLIC_` termina dentro del código
que descarga el navegador. No se debe guardar allí:

- `JWT_SECRET_KEY`.
- `CULQI_SECRET_KEY`.
- `APIPERU_TOKEN`.
- `SMTP_PASSWORD`.
- Contraseña de Supabase.

`NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_SECRET` actualmente es consumida por el
frontend y, por definición, puede inspeccionarse en el navegador. No debe
tratarse como una credencial de servidor de alta confianza. La seguridad del
backend debe seguir validando el dispositivo y limitar lo que esa credencial
puede hacer.

Para `NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY`, usar el editor multilínea de Vercel y
pegar todo el bloque:

```text
-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
```

No convertir los saltos de línea manualmente en `\n` salvo que el panel los
esté almacenando literalmente de esa forma y se haya comprobado el resultado.

### 6.3 Primera publicación del frontend

1. Pulsar **Deploy**.
2. Copiar el dominio final, por ejemplo:

```text
https://kadosh-pos-web.vercel.app
```

3. Volver al proyecto backend.
4. Cambiar:

```env
FRONTEND_URL=https://kadosh-pos-web.vercel.app
```

5. Redeploy del backend.
6. Volver al frontend y confirmar:

```env
NEXT_PUBLIC_SCANNER_WEB_URL=https://kadosh-pos-web.vercel.app
```

7. Redeploy del frontend si esa variable cambió.

## 7. CORS y dominios

FastAPI permite el dominio configurado en `FRONTEND_URL`. En producción debe
contener el origen exacto del frontend:

```text
https://kadosh-pos-web.vercel.app
```

Configuraciones incorrectas comunes:

```text
https://kadosh-pos-web.vercel.app/     # barra final innecesaria
http://kadosh-pos-web.vercel.app       # protocolo incorrecto
https://kadosh-pos-api.vercel.app      # dominio del backend, no del frontend
```

Si se agrega un dominio propio, por ejemplo `https://pos.midominio.com`, se debe
actualizar `FRONTEND_URL` y volver a desplegar el backend.

Los Preview Deployments tienen dominios diferentes. La configuración actual
autoriza un único dominio público mediante `FRONTEND_URL`; por seguridad no se
usa un regex abierto para cualquier `*.vercel.app`. Para probar un preview con
backend real, configurar temporalmente el dominio exacto o utilizar un backend
de preview separado.

## 8. Configuración para reducir cold starts

### 8.1 Qué se optimizó en este proyecto

Antes de esta guía, `report_service.py` importaba pandas y numpy durante el
arranque general de FastAPI. Como el router importa todos los endpoints, una
petición de login o health pagaba también el costo de esas librerías.

Los cálculos realizados eran conteos, sumas, promedios, filtros y ordenamiento.
Ahora usan Python estándar y `Decimal`, por lo que:

- Se retiran pandas y numpy de `requirements.txt`.
- Disminuye el tamaño de la función Python.
- Disminuye el trabajo de import inicial.
- Se conserva la precisión monetaria con `Decimal`.
- No se cambia la respuesta pública de reportes.

Vercel documenta un máximo descomprimido de 500 MB para funciones Python y
recomienda mantener únicamente dependencias necesarias. Véase
[Using the Python Runtime](https://vercel.com/docs/functions/runtimes/python).

### 8.2 Región de ejecución

Vercel ejecuta Functions en `iad1` por defecto. La URL actual de Supabase utiliza
un pooler `aws-1-us-west-2`, por lo que se configuró:

```json
"regions": ["sfo1"]
```

La intención es acercar la función a la base. Vercel recomienda alojar la
función en la misma región que la base o lo más cerca posible. Hobby permite
seleccionar una sola región. Consulta
[regiones de Vercel](https://vercel.com/docs/regions) y
[configuración de vercel.json](https://vercel.com/docs/project-configuration/vercel-json).

Esta decisión debe verificarse con mediciones. Si Supabase cambia de región,
también debe reevaluarse `sfo1`.

### 8.3 Fluid Compute

En el proyecto backend, revisar **Settings > Functions** y confirmar que Fluid
Compute esté habilitado. En proyectos nuevos suele estar activo por defecto.

Fluid Compute:

- Reutiliza capacidad disponible antes de crear nuevas instancias.
- Permite concurrencia dentro de una instancia.
- Reduce la frecuencia de cold starts.
- Puede pre-calentar despliegues de producción.

Fluid Compute no garantiza que una instancia permanezca viva para siempre.
Una función puede volver a arrancar por inactividad, escalado, despliegues,
cambios de configuración o decisiones internas de la plataforma. Consulta
[Fluid Compute de Vercel](https://vercel.com/fluid).

### 8.4 Conexión Supabase

La configuración actual es adecuada para serverless:

```python
engine = create_engine(
    settings.supabase_database_url,
    pool_pre_ping=True,
    poolclass=NullPool,
    connect_args={"prepare_threshold": None},
)
```

Comprobar en Supabase **Connect** que la URL usada por Vercel sea Transaction
pooler y termine en `:6543/postgres`. No usar una base local ni crear otra base
para producción.

Ventajas:

- Supavisor comparte conexiones de backend.
- Cada función puede abrir una conexión temporal sin mantener pools locales.
- Se evita acumular pools independientes por instancia serverless.
- `prepare_threshold=None` respeta la limitación de transaction mode.

No conviene cambiar a un pool SQLAlchemy grande dentro de Vercel. Tampoco
conviene usar simultáneamente varios poolers sin medir límites de conexiones.

## 9. Endpoint de salud

Endpoint:

```text
GET /api/v1/health
```

Contrato:

```json
{"status":"ok"}
```

Debe permanecer:

- Público.
- Sin JWT.
- Sin consulta SQL.
- Sin llamadas a Culqi, Gmail o API Perú.
- Sin migraciones.
- Sin información sensible.

No confundirlo con `/api/v1/system/ping`, que sí comprueba conectividad con
Supabase y por ello mide otro componente.

## 10. Medición de cold start y respuesta caliente

No decidir sobre keep-alive antes de medir producción.

### 10.1 Medición rápida con curl

Desde PowerShell:

```powershell
$backend = "https://TU-BACKEND.vercel.app"
curl.exe -sS -o NUL -D - -w "DNS: %{time_namelookup}s`nTCP: %{time_connect}s`nTLS: %{time_appconnect}s`nTTFB: %{time_starttransfer}s`nTOTAL: %{time_total}s`n" "$backend/api/v1/health"
```

Ejecutar una vez después de un periodo sin tráfico y repetir cinco veces:

```powershell
1..5 | ForEach-Object {
  curl.exe -sS -o NUL -w "Peticion $_ TOTAL=%{time_total}s TTFB=%{time_starttransfer}s`n" "https://TU-BACKEND.vercel.app/api/v1/health"
}
```

Registrar:

| Prueba | Condición | TOTAL | TTFB | `X-Process-Time-Ms` | Start type |
| --- | --- | --- | --- | --- | --- |
| 1 | Después de inactividad | | | | |
| 2 | Inmediata | | | | |
| 3 | Inmediata | | | | |
| 4 | Inmediata | | | | |
| 5 | Inmediata | | | | |

### 10.2 Interpretar Server-Timing

La API agrega:

```text
Server-Timing: app;dur=12.34
X-Process-Time-Ms: 12.34
```

Ese valor mide el procesamiento dentro de FastAPI una vez que la aplicación ya
está cargada. No incluye por completo DNS, TLS, red ni el import previo de un
cold start.

Interpretación:

- TOTAL alto y `X-Process-Time-Ms` bajo: plataforma, red, cold start o DNS.
- Ambos altos: lógica del endpoint, autenticación, base o API externa.
- Health rápido y login lento: revisar Supabase y bcrypt.
- Health y endpoint con DB lentos: revisar región/conexión.
- API rápida y pantalla lenta: revisar frontend, cantidad de peticiones y JS.

### 10.3 Logs de Vercel

En el proyecto backend:

1. Abrir **Logs**.
2. Filtrar Environment = Production.
3. Filtrar Request Path = `/api/v1/health`.
4. Abrir una invocación.
5. Revisar Function duration, memory, region y start type.
6. Comparar una invocación cold con varias warm.
7. Revisar Outgoing Requests para detectar Supabase o APIs externas.

Los Runtime Logs muestran duración, memoria, región y tipo de arranque. En Hobby
la retención indicada por Vercel es corta, por lo que conviene medir y guardar
resultados el mismo día. Consulta
[Runtime Logs](https://vercel.com/docs/logs/runtime).

### 10.4 Medir base de datos

Comparar:

```text
/api/v1/health       # sin base
/api/v1/system/ping  # SELECT 1 contra Supabase
```

Si health responde en 100 ms y system/ping en 900 ms, el cuello está en
conexión/región/base, no en FastAPI. No usar `system/ping` como keep-alive porque
crearía tráfico y conexiones SQL innecesarias.

## 11. ¿Conviene usar un ping periódico?

Recomendación inicial: no activarlo hasta obtener mediciones repetibles.

| Alternativa | Beneficio | Limitación | Consumo | Recomendación |
| --- | --- | --- | --- | --- |
| UptimeRobot | Monitoriza disponibilidad y latencia | No garantiza misma instancia | Invocaciones periódicas | Útil como monitor, no como solución arquitectónica |
| Better Stack | Monitoreo, alertas y observabilidad | Plan y retención variables | Invocaciones y almacenamiento | Útil si se necesitan alertas profesionales |
| cron-job.org | Ping simple externo | Menor control y sin garantía térmica | Invocaciones periódicas | Solo para una prueba temporal |
| GitHub Actions | Programable | No es un sistema de uptime y consume Actions | Workflow + invocaciones | No recomendado para keep-alive |
| Vercel Cron | Integrado y con logs | Hobby solo permite una ejecución diaria | Invocación de Function | No sirve para calentamiento frecuente en Hobby |

Vercel Cron está disponible en todos los planes, pero Hobby solo permite una
ejecución diaria y puede ejecutarla en cualquier momento dentro de la hora
indicada. Consulta
[gestión de Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Aunque un servicio llame health cada cinco minutos:

- Vercel no garantiza que la siguiente petición use esa instancia.
- Puede haber más de una instancia por concurrencia o región.
- Un nuevo deploy siempre puede iniciar capacidad nueva.
- El ping consume invocaciones y puede ocultar imports pesados o mala región.

Solo considerar UptimeRobot o Better Stack cuando el objetivo principal sea
monitorizar disponibilidad. Si después de optimizar y medir se prueba un
keep-alive, comenzar con un intervalo moderado de 10 a 15 minutos y revisar
Usage. No hacer ping a endpoints que consultan la base.

## 12. Caché CDN

No aplicar caché CDN a las rutas actuales que contienen:

- `Authorization: Bearer ...`.
- Login o recuperación de contraseña.
- Usuarios, clientes o auditoría.
- Ventas, pagos, inventario o reportes.
- Estado de sesiones de pantalla cliente.
- Respuestas personalizadas por rol.

Vercel no almacena normalmente respuestas de requests con `Authorization` y
recomienda `private, max-age=0` o `no-store` para datos personalizados. Consulta
[Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers) y
[Vercel CDN Cache](https://vercel.com/docs/caching/cdn-cache).

Un catálogo verdaderamente público y no personalizado podría usar, después de
separarlo de las rutas internas:

```http
Cache-Control: public, max-age=0
Vercel-CDN-Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

No se implementa ahora porque productos y variantes forman parte del POS
autenticado y los cambios de stock requieren datos recientes.

## 13. Pruebas posteriores al despliegue

### Backend

1. `GET /api/v1/health` devuelve 200 y `{"status":"ok"}`.
2. `GET /api/v1/system/ping` devuelve 200 cuando Supabase está accesible.
3. `GET /api/v1/auth/me` sin token devuelve 401.
4. Login con el administrador devuelve access token.
5. Recuperación de contraseña envía el OTP.
6. Listar productos sin token devuelve 401.
7. Listar productos con token válido devuelve 200.

### Frontend

1. La portada abre por HTTPS.
2. El login no contiene credenciales prellenadas.
3. Un login correcto entra al dashboard.
4. Recargar dashboard conserva y valida la sesión.
5. Un JWT inválido redirige al login.
6. Productos, variantes, inventario y clientes cargan.
7. Caja permite crear una venta de prueba.
8. Reportes muestran los mismos totales que antes.
9. La recuperación de contraseña abre en su página independiente.
10. La pantalla cliente puede vincularse con el dispositivo configurado.
11. El scanner genera enlaces HTTPS con el dominio de producción.

### Navegador

En DevTools > Network comprobar:

- Las llamadas van a `https://TU-BACKEND.vercel.app/api/v1`.
- No aparece Mixed Content.
- No hay errores CORS.
- Las rutas protegidas envían `Authorization: Bearer ...`.
- Los tiempos de espera corresponden a API y no a recursos faltantes.

## 14. Problemas frecuentes

### Network Error hacia 127.0.0.1

Causa: `NEXT_PUBLIC_API_URL` quedó con la URL local durante el build.

Solución:

```env
NEXT_PUBLIC_API_URL=https://TU-BACKEND.vercel.app/api/v1
```

Después hacer Redeploy del frontend.

### Error CORS

Causa: `FRONTEND_URL` no coincide exactamente con el origen del navegador.

Solución: actualizar la variable backend con el dominio HTTPS del frontend y
redeploy del backend.

### Backend devuelve 500 al iniciar

Revisar Build Logs y Runtime Logs. Causas comunes:

- Falta `SUPABASE_DATABASE_URL`.
- Falta `JWT_SECRET_KEY`.
- Falta alguna variable obligatoria de Culqi.
- URL de Supabase mal escapada.
- Contraseña con caracteres especiales sin codificación URL.
- Dependencia Python incompatible.

### Supabase no conecta

Confirmar:

- Host del transaction pooler.
- Puerto `6543`.
- Usuario con formato `postgres.PROJECT_REF` cuando corresponda.
- Contraseña URL-encoded.
- Base `/postgres`.
- `prepare_threshold=None` continúa configurado.

### OTP no llega

Confirmar:

- Verificación en dos pasos activa en Google.
- App Password de Google, no contraseña normal.
- `SMTP_PORT=587`.
- `SMTP_USE_TLS=true`.
- `SMTP_FROM_EMAIL` coincide con la cuenta autorizada.
- Runtime Logs no muestran rechazo SMTP.

### El primer request sigue lento

1. Comparar health cold y warm.
2. Revisar start type en Vercel Logs.
3. Comparar `X-Process-Time-Ms` con tiempo TOTAL.
4. Confirmar región `sfo1` en la invocación.
5. Confirmar Fluid Compute.
6. Comparar health con system/ping.
7. Revisar tamaño de build y memoria.
8. Solo después evaluar un monitor externo.

## 15. Dominios propios opcionales

Una configuración clara sería:

```text
Frontend: https://pos.tudominio.com
Backend:  https://api-pos.tudominio.com
```

Después de asignarlos en Vercel:

Backend:

```env
FRONTEND_URL=https://pos.tudominio.com
```

Frontend:

```env
NEXT_PUBLIC_API_URL=https://api-pos.tudominio.com/api/v1
NEXT_PUBLIC_SCANNER_WEB_URL=https://pos.tudominio.com
NEXT_PUBLIC_SCANNER_API_URL=https://api-pos.tudominio.com/api/v1
```

Redeploy de ambos proyectos después de cambiar variables.

## 16. Actualizaciones y rollback

Cada push a `main` generará despliegues para ambos proyectos conectados al
mismo repositorio. Vercel permite omitir builds cuando el directorio del
proyecto no cambió desde la configuración de monorepo.

Antes de una actualización:

1. Ejecutar validaciones locales.
2. Confirmar si existen migraciones nuevas.
3. Aplicar migraciones compatibles antes o durante la ventana prevista.
4. Hacer push.
5. Revisar ambos deployments.
6. Ejecutar smoke tests.

Si una versión falla, usar el deployment anterior desde Vercel y seleccionar
Rollback/Promote según la interfaz disponible. Un rollback de código no revierte
automáticamente una migración de base de datos; las migraciones deben diseñarse
compatibles con la versión anterior cuando se necesite rollback rápido.

## 17. Checklist final

### Backend Vercel

- [ ] Root Directory = `apps/api`.
- [ ] Python 3.12 detectado.
- [ ] Región de Function = `sfo1`.
- [ ] Fluid Compute activo.
- [ ] Todas las variables backend registradas.
- [ ] `FRONTEND_URL` contiene el dominio final.
- [ ] Supabase usa transaction pooler `6543`.
- [ ] Health responde 200.
- [ ] Logs no contienen secretos.

### Frontend Vercel

- [ ] Root Directory = `apps/web`.
- [ ] Framework = Next.js.
- [ ] `NEXT_PUBLIC_API_URL` contiene backend + `/api/v1`.
- [ ] URLs de scanner usan HTTPS de producción.
- [ ] Solo claves públicas tienen prefijo `NEXT_PUBLIC_`.
- [ ] RSA public key conserva su formato.
- [ ] Build termina correctamente.
- [ ] No hay errores CORS ni Mixed Content.

### Operación

- [ ] Login y JWT probados.
- [ ] Usuario administrador existente en la misma base Supabase.
- [ ] OTP probado en producción.
- [ ] Venta de prueba completada.
- [ ] Inventario verificado después de la venta.
- [ ] Reportes comparados.
- [ ] Pantalla cliente y scanner probados.
- [ ] Primera petición y peticiones calientes medidas.
- [ ] Decisión sobre monitoreo tomada usando datos reales.

## 18. Decisión recomendada para Kadosh POS

La combinación inicial recomendada es:

1. Dos proyectos Vercel separados dentro del monorepo.
2. Backend como una sola aplicación FastAPI ASGI.
3. Python 3.12 fijado.
4. Región `sfo1`, cercana a Supabase `us-west-2`.
5. Fluid Compute habilitado.
6. Supavisor transaction pooler `6543` con `NullPool`.
7. Runtime sin pandas/numpy.
8. Health mínimo sin base de datos.
9. Medición con headers, curl y Runtime Logs.
10. Sin keep-alive periódico hasta demostrar que aporta una mejora real.

Esta estrategia reduce peso y distancia sin generar consumo artificial ni
cambiar innecesariamente la arquitectura del sistema.
