# Guia de arquitectura, codificacion y control tecnico de Kadosh POS

> Documento elaborado a partir de la revision del repositorio real de Kadosh POS.
> Version de referencia: 17 de julio de 2026.
> Estado documentado: avance funcional actual; no representa el cierre definitivo del proyecto.

## 1. Control del documento

| Campo | Valor |
|---|---|
| Sistema | Kadosh POS |
| Tipo de sistema | Aplicacion web de punto de venta y administracion comercial |
| Organizacion | Kadosh, tienda de ropa urbana |
| Repositorio | `kadosh-pos` |
| Frontend | `apps/web` |
| Backend | `apps/api` |
| Base de datos | PostgreSQL administrado en Supabase |
| Despliegue actual | Vercel para frontend y API; Supabase para persistencia |
| URL publica frontend | `https://kadosh-pos-web.vercel.app/` |
| Estado | En desarrollo evolutivo |

### 1.1 Proposito

Esta guia establece como esta construido Kadosh POS, que convenciones sigue y que reglas deben respetarse al continuar su desarrollo. Su finalidad es que cualquier integrante del equipo pueda:

- comprender la arquitectura sin depender del autor original;
- mantener una estructura uniforme;
- implementar nuevos modulos sin mezclar responsabilidades;
- proteger la informacion comercial y las credenciales;
- reducir defectos en ventas, inventario y pagos;
- revisar cambios de forma repetible;
- desplegar sin reemplazar ni perder la base de datos;
- distinguir entre capacidades implementadas y trabajo pendiente.

### 1.2 Fuentes revisadas

La guia se basa en el codigo y configuracion existentes, principalmente:

- `README.md`;
- `apps/web/package.json` y `package-lock.json`;
- `apps/web/src/app`, `components`, `features`, `services`, `config` y `types`;
- `apps/api/requirements.txt`;
- `apps/api/app/api`, `core`, `db`, `models`, `repositories`, `schemas` y `services`;
- `database/001_init_schema.sql`;
- `database/migrations/003` a `017`;
- `apps/api/tests/test_critical_contracts.py` y scripts de prueba Culqi sandbox;
- `apps/api/vercel.json`;
- ejemplos de variables de entorno;
- documentacion funcional y de despliegue existente.

## 2. Identidad y objetivo del sistema

### 2.1 Titulo

**Kadosh POS - Sistema web de punto de venta, inventario y gestion comercial.**

### 2.2 Objetivo general

Desarrollar una plataforma web segura, responsive y operativamente rapida que permita administrar el catalogo de una tienda de ropa urbana, controlar existencias por variante, registrar clientes, realizar ventas, cobrar mediante diferentes medios, operar con pantallas de cliente y escaneres moviles, emitir comprobantes internos consultables mediante QR, procesar cambios o devoluciones y producir reportes para la toma de decisiones.

### 2.3 Objetivos especificos

1. Mantener productos base separados de sus variantes de talla, color, SKU y codigo de barras.
2. Controlar el stock mediante movimientos trazables y no mediante modificaciones invisibles.
3. Registrar ventas con detalle historico de nombre, variante, precio y costo.
4. Permitir ventas identificadas y ventas a publico general.
5. Registrar pagos manuales y preparar la integracion con Culqi.
6. Vincular celulares para lectura de productos o identificacion de boletas.
7. Vincular tablets de cliente para presentar el carrito y ejecutar cobros.
8. Emitir comprobantes internos con subtotal, descuento, IGV incluido y total.
9. Gestionar cambios y devoluciones conservando la referencia a la venta original.
10. Exponer reportes de ingresos, costos, utilidad, margen y stock bajo.
11. Proteger operaciones mediante autenticacion JWT y roles.
12. Mantener auditoria de acciones sensibles.

### 2.4 Alcance funcional actual

| Area | Estado | Alcance actual |
|---|---|---|
| Autenticacion | Implementado | Login, usuario actual, JWT, recuperacion con OTP por correo y primer administrador |
| Panel | Implementado | Indicadores operativos y ventas recientes |
| Productos | Implementado | Alta, consulta, edicion y activacion de productos base |
| Catalogo | Implementado | Variantes, SKU, barcode, costo, precio, stock minimo, etiquetas y CSV |
| Inventario | Implementado | Movimientos manuales y automaticos, consulta historica |
| Clientes | Implementado | CRUD funcional, busqueda por documento y consulta DNI externa |
| Caja | Implementado | Carrito, cliente, scanner, venta, cobro manual, tablet y comprobante |
| Ventas | Implementado | Historial, filtros, detalle, anulacion y reimpresion |
| Pagos | Implementado | Historial, medios manuales y Culqi para ventas y diferencias de cambio |
| Pantallas cliente | Implementado | Vinculacion por codigo, carrito, sesiones de venta y cobro de diferencias |
| Scanner movil | Implementado | Sesiones diferenciadas para productos y boletas |
| Cambios y devoluciones | Implementado | Busqueda exacta, reemplazos, liquidacion, reservas, Culqi e historial |
| Comprobante QR | Implementado | Token publico unico, consulta web e impresion/guardado mediante navegador |
| Reportes | Implementado base | Resumen, detalle, costo, utilidad, margen y exportacion |
| Auditoria | Implementado backend | Persistencia y endpoints de consulta para ADMIN |
| Facturacion electronica SUNAT | No implementado | El comprobante actual es interno, no CPE homologado |
| Pago Culqi de diferencias | Implementado | Tablet, token Culqi, ordenes, confirmacion, cancelacion segura y revision manual |
| Pruebas automatizadas | Implementado base | Suite de contratos criticos y prueba E2E sandbox; falta ampliar cobertura integral |

## 3. Arquitectura del sistema

### 3.1 Estilo arquitectonico

Kadosh no utiliza el MVC tradicional de PHP mostrado en la guia referencial. Su arquitectura real es una **aplicacion web cliente-servidor organizada como monorepo**, con separacion por capas:

```text
Navegador / dispositivo movil
        |
        | HTTPS + JSON
        v
Frontend Next.js (presentacion y estado de interfaz)
        |
        | REST API /api/v1
        v
FastAPI Endpoints (transporte y autorizacion)
        |
        v
Services (casos de uso y reglas de negocio)
        |
        v
Repositories (consultas y persistencia)
        |
        v
SQLAlchemy ORM + Psycopg
        |
        v
PostgreSQL / Supabase
```

Las integraciones externas se conectan desde el backend:

```text
FastAPI -> Culqi API
FastAPI -> ApiPeru
FastAPI -> Servidor SMTP de Gmail
```

Esta organizacion se aproxima a una arquitectura en capas con principios de **Repository + Service**, mientras Next.js usa componentes y servicios por funcionalidad.

### 3.2 Regla principal de separacion

- Una pagina React no debe consultar PostgreSQL directamente.
- Un endpoint no debe contener toda la logica de negocio.
- Un repositorio no debe decidir reglas comerciales.
- Un schema Pydantic define el contrato HTTP, no la tabla.
- Un modelo SQLAlchemy representa persistencia, no la interfaz.
- Una clave secreta de proveedor nunca debe llegar al frontend.

### 3.3 Flujo de una peticion protegida

1. El usuario inicia sesion desde `/login`.
2. El frontend envia correo y contrasena a `POST /api/v1/auth/login`.
3. `AuthService` localiza al usuario y verifica bcrypt.
4. El backend emite access token y refresh token JWT.
5. El frontend conserva la sesion y agrega `Authorization: Bearer <token>`.
6. FastAPI ejecuta `get_current_user`.
7. Se valida firma, expiracion, tipo `access`, UUID y estado del usuario.
8. `require_roles(...)` verifica el rol permitido.
9. El endpoint delega al servicio.
10. El servicio aplica reglas y utiliza repositorios.
11. SQLAlchemy genera consultas parametrizadas.
12. Pydantic serializa una respuesta JSON controlada.

### 3.4 Estructura real del repositorio

```text
kadosh-pos/
|-- apps/
|   |-- api/
|   |   |-- app/
|   |   |   |-- api/v1/
|   |   |   |   |-- endpoints/       # Rutas REST por recurso
|   |   |   |   |-- dependencies.py  # Sesion de BD por peticion
|   |   |   |   |-- router.py        # Registro central de rutas
|   |   |   |   `-- security.py      # Usuario actual y RBAC
|   |   |   |-- core/
|   |   |   |   |-- config.py        # Variables de entorno tipadas
|   |   |   |   `-- security.py      # bcrypt y JWT
|   |   |   |-- db/session.py         # Engine y SessionLocal
|   |   |   |-- models/               # Modelos SQLAlchemy
|   |   |   |-- repositories/         # Persistencia y consultas
|   |   |   |-- schemas/              # Contratos Pydantic
|   |   |   |-- services/             # Casos de uso
|   |   |   |-- integrations/culqi/   # Integracion externa
|   |   |   `-- main.py               # Aplicacion FastAPI y CORS
|   |   |-- scripts/                   # Semillas, diagnostico y reparacion
|   |   |-- requirements.txt
|   |   `-- vercel.json
|   `-- web/
|       |-- public/                    # Activos estaticos
|       |-- src/
|       |   |-- app/                   # App Router y pantallas
|       |   |-- components/
|       |   |   |-- layout/            # Shell y navegacion
|       |   |   |-- receipts/          # Encabezado y QR de boleta
|       |   |   `-- ui/                # Componentes base shadcn
|       |   |-- config/env.ts          # Variables publicas normalizadas
|       |   |-- features/              # Servicios por dominio
|       |   |-- lib/                   # Utilidades compartidas
|       |   |-- services/api-client.ts # Cliente HTTP comun
|       |   `-- types/api.ts           # Tipos del contrato API
|       |-- package.json
|       `-- tsconfig.json
|-- database/
|   |-- 001_init_schema.sql            # Esquema inicial
|   `-- migrations/                    # Cambios incrementales 003-017
|-- docs/
|   |-- codex/                         # Contexto y reglas de trabajo
|   |-- deployment/                    # Guia de Vercel
|   `-- technical/                     # Documentacion tecnica formal
`-- README.md
```

### 3.5 Responsabilidad por capa backend

| Capa | Responsabilidad | No debe hacer |
|---|---|---|
| `endpoints` | Ruta, dependencias, rol, status HTTP y schema | SQL directo o reglas extensas |
| `schemas` | Validar entrada y definir salida | Acceder a BD |
| `services` | Coordinar el caso de uso y transacciones | Renderizar UI |
| `repositories` | Consultar, crear y actualizar entidades | Decidir politicas comerciales |
| `models` | Mapear tablas, columnas y relaciones | Exponer secretos o mensajes UI |
| `core` | Configuracion y utilidades transversales | Conocer pantallas concretas |

### 3.6 Responsabilidad por capa frontend

| Capa | Responsabilidad |
|---|---|
| `app` | Ruta, composicion de pantalla, estados y acciones del usuario |
| `features` | Operaciones de dominio contra la API y estado reutilizable |
| `services/api-client` | HTTP, headers, errores y respuesta comun |
| `components/ui` | Controles visuales reutilizables |
| `components/layout` | Navegacion y proteccion visual de modulos |
| `components/receipts` | Partes compartidas del comprobante |
| `types/api.ts` | Tipado de requests y responses consumidos |
| `config/env.ts` | Unico acceso normalizado a variables publicas |

## 4. Tecnologias utilizadas y justificacion

### 4.1 Frontend

| Tecnologia | Version observada | Uso | Justificacion |
|---|---:|---|---|
| Next.js | 16.2.10 | App Router, rutas y compilacion | Estructura moderna, optimizacion y despliegue directo en Vercel |
| React | 19.2.4 | Componentes y estado | Interfaz interactiva para flujos POS |
| TypeScript | 5.x | Tipado estatico | Reduce errores de contratos y propiedades |
| Tailwind CSS | 4.x | Estilos responsivos | Permite UI consistente sin CSS disperso |
| shadcn | 4.13.0 | Base de componentes | Componentes editables y coherentes |
| Base UI React | 1.6.0 | Primitivas accesibles | Interacciones robustas en dialogos y controles |
| Lucide React | 1.23.0 | Iconografia | Iconos consistentes y comprensibles |
| Sonner | 2.0.7 | Notificaciones | Feedback no bloqueante |
| qrcode | 1.5.4 | QR de boleta y vinculacion | Identificacion unica desde celular |
| JsBarcode | 3.12.3 | Etiquetas Code 128 | Lectura de variantes en caja |
| ESLint | 9.x | Calidad estatica | Convenciones y errores comunes |

### 4.2 Backend

| Tecnologia | Version observada | Uso | Justificacion |
|---|---:|---|---|
| Python | 3.12 documentado | Lenguaje del backend | Legibilidad y ecosistema API |
| FastAPI | 0.115.6 | API REST | Validacion, OpenAPI e inyeccion de dependencias |
| Uvicorn | 0.34.0 | Servidor ASGI | Ejecucion de FastAPI |
| Pydantic | 2.10.4 | Schemas y validacion | Contratos tipados y errores estructurados |
| pydantic-settings | 2.7.1 | Configuracion | Variables de entorno tipadas |
| SQLAlchemy | 2.0.36 | ORM y transacciones | Consultas parametrizadas y separacion de persistencia |
| Psycopg | 3.2.3 | Driver PostgreSQL | Conexion nativa con PostgreSQL |
| Alembic | 1.14.0 | Disponible para migraciones | Aun convive con migraciones SQL manuales |
| Passlib + bcrypt | 1.7.4 / 4.0.1 | Hash de contrasenas | No guarda contrasenas reversibles |
| python-jose | 3.3.0 | Tokens JWT | Firma y validacion HS256 |
| HTTPX | 0.28.1 | APIs externas | Culqi y consulta documental |
| email-validator | 2.2.0 | Correos Pydantic | Rechazo temprano de formatos invalidos |

### 4.3 Datos e infraestructura

| Tecnologia | Uso actual |
|---|---|
| PostgreSQL | Base relacional transaccional |
| Supabase | Hospedaje persistente de PostgreSQL |
| Vercel | Frontend Next.js y backend Python serverless |
| Gmail SMTP | Entrega de OTP de recuperacion |
| Culqi | Procesamiento de pagos digitales, integracion parcial |
| ApiPeru | Consulta externa de DNI |

### 4.4 Por que una base relacional

Ventas, pagos, items, stock, clientes y devoluciones exigen integridad referencial y transacciones. PostgreSQL permite:

- claves foraneas;
- restricciones `CHECK`;
- indices;
- tipos `numeric(12,2)` para dinero;
- UUID como identificadores;
- `timestamptz` para fechas;
- `jsonb` solo donde la respuesta externa es variable;
- operaciones atomicas para evitar ventas o inventario a medias.

## 5. Estandares de base de datos

### 5.1 Nombre logico

El entorno local de ejemplo utiliza `kadosh_pos_db`. En Supabase, la base fisica puede llamarse `postgres`; por ello el nombre funcional que debe usarse en documentacion es **Base de datos de Kadosh POS en Supabase PostgreSQL**.

### 5.2 Convenciones obligatorias

| Elemento | Convencion | Ejemplo real |
|---|---|---|
| Tablas | plural, minusculas, `snake_case` | `product_variants` |
| Clave primaria | `id`, tipo UUID | `sales.id` |
| Clave foranea | entidad singular + `_id` | `sale_id`, `customer_id` |
| Booleanos | prefijo `is_` | `is_active` |
| Fechas | sufijo `_at` y `timestamptz` | `created_at`, `paid_at` |
| Cantidades | nombre + `_quantity` | `stock_quantity` |
| Importes | `numeric(12,2)` | `sale_price`, `total` |
| Estados | texto en `UPPER_SNAKE_CASE` | `PENDING_PAYMENT` |
| Indices | `idx_` o `ix_` + tabla/campo | `idx_sales_created_at` |
| Unicos | `uq_` o `ux_` | `ux_sales_receipt_token` |
| Restricciones | `chk_` / `fk_` + descripcion | `chk_sales_total` |
| Triggers | `trg_` + tabla + evento | `trg_sales_updated_at` |

### 5.3 Tipos recomendados

- UUID: identificadores distribuidos y no secuenciales.
- `varchar(n)`: datos cortos con limite conocido.
- `text`: descripciones sin limite pequeño.
- `numeric(12,2)`: dinero; nunca `float`.
- `integer`: unidades de stock y cantidades.
- `boolean`: banderas activas/inactivas.
- `timestamptz`: fechas con zona horaria.
- `jsonb`: respuesta cruda de proveedor o auditoria.

### 5.4 Campos de auditoria

Las entidades editables deben incluir:

```sql
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Las tablas inmutables de detalle o movimiento pueden conservar solo `created_at`. Las acciones sensibles deben generar ademas un registro en `audit_logs`.

### 5.5 Inventario actual de tablas

| Tabla | Proposito | Relaciones principales |
|---|---|---|
| `roles` | Roles del sistema | Uno a muchos con `users` |
| `users` | Operadores autenticados | Rol, ventas, inventario, auditoria |
| `customers` | Clientes | Uno a muchos con ventas |
| `categories` | Clasificacion de productos | Uno a muchos con productos |
| `products` | Producto base | Categoria y variantes |
| `product_variants` | Unidad vendible por talla/color | Producto, items y movimientos |
| `sales` | Cabecera de venta | Vendedor, cliente, items, pagos |
| `sale_items` | Detalle historico de venta | Venta y variante |
| `payments` | Cobros | Venta y sesiones |
| `payment_sessions` | Pago enviado a tablet | Venta, pago opcional, vendedor |
| `inventory_movements` | Kardex de stock | Variante, usuario y venta |
| `audit_logs` | Trazabilidad | Usuario y entidad afectada |
| `customer_display_devices` | Tablets autorizadas | Usuario que vincula |
| `customer_display_pairing_codes` | Codigos temporales | Usuario y dispositivo |
| `scanner_sessions` | Vinculo de scanner movil | Usuario y proposito |
| `scanner_scans` | Lecturas recibidas | Sesion de scanner |
| `password_reset_otps` | OTP temporales | Usuario |
| `return_transactions` | Cabecera de cambio/devolucion | Venta y usuario procesador |
| `return_items` | Items recibidos | Transaccion y item vendido |
| `replacement_items` | Productos entregados | Transaccion y variante |
| `return_settlements` | Liquidacion economica del cambio | Transaccion, direccion, importe y estado |
| `return_settlement_sessions` | Cobro Culqi enviado a tablet | Liquidacion, dispositivo y referencias Culqi |
| `return_inventory_reservations` | Reserva temporal de reemplazos | Transaccion, variante, cantidad y vencimiento |

### 5.6 Diccionario resumido de entidades centrales

#### `products`

| Campo | Tipo | Regla |
|---|---|---|
| `id` | UUID | PK |
| `category_id` | UUID | FK obligatoria, borrado restringido |
| `name` | varchar(150) | Obligatorio |
| `description` | text | Opcional |
| `brand` | varchar(100) | Opcional |
| `status` | varchar(30) | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `is_active` | boolean | Baja logica |
| `created_at`, `updated_at` | timestamptz | Auditoria temporal |

#### `product_variants`

| Campo | Tipo | Regla |
|---|---|---|
| `product_id` | UUID | Producto padre |
| `sku` | varchar(80) | Unico y obligatorio |
| `size`, `color` | varchar | Identidad comercial |
| `barcode` | varchar(100) | Indexado, puede generarse |
| `cost_price` | numeric(12,2) | Mayor o igual a cero |
| `sale_price` | numeric(12,2) | Mayor a cero |
| `stock_quantity` | integer | Mayor o igual a cero |
| `min_stock_quantity` | integer | Umbral de alerta |
| `status`, `is_active` | varchar/boolean | Disponibilidad |

#### `sales`

| Campo | Tipo | Regla |
|---|---|---|
| `sale_number` | varchar(40) | Numero visible unico |
| `seller_id` | UUID | Usuario responsable |
| `customer_id` | UUID nullable | Permite publico general |
| `subtotal` | numeric(12,2) | Suma previa |
| `discount_total` | numeric(12,2) | Descuento total |
| `tax_total` | numeric(12,2) | IGV incluido, no adicional |
| `total` | numeric(12,2) | Importe final |
| `status` | varchar(30) | Ciclo de vida de venta |
| `receipt_token` | varchar(64) | Token publico unico |
| `paid_at`, `cancelled_at` | timestamptz | Eventos del ciclo |

#### `sale_items`

Conserva snapshots de `product_name`, `variant_sku`, talla, color, `unit_price` y `cost_price`. Esto evita que una venta historica cambie si luego se edita el catalogo y permite calcular utilidad historica correctamente.

#### `payments`

Registra metodo, proveedor, importe, moneda, estado, codigo de operacion e identificadores del proveedor. `raw_response` permite conservar evidencia tecnica de Culqi sin alterar el esquema por cada campo externo.

#### `inventory_movements`

Registra variante, usuario, venta asociada, tipo, cantidad, stock anterior, stock nuevo y motivo. El stock visible debe poder explicarse reconstruyendo esta bitacora.

#### `return_transactions`

Registra el tipo `RETURN` o `EXCHANGE`, motivo, condicion, resolucion de inventario, valores recibido/reemplazo, diferencia, medio de liquidacion, usuario y estado.

#### `return_settlements`

Separa el resultado economico del movimiento de mercaderia. La direccion puede ser `CHARGE`, `REFUND` o `NONE`; el estado puede ser `SETTLED`, `PENDING`, `FAILED` o `CANCELLED`. Esto impide interpretar una operacion de cambio como pagada solo porque sus productos fueron seleccionados.

#### `return_settlement_sessions`

Representa el cobro de una diferencia enviado a una tablet. Conserva estado, expiracion, orden y transaccion del proveedor, referencia de operacion y respuesta tecnica. Los identificadores Culqi son unicos para prevenir conciliaciones duplicadas.

#### `return_inventory_reservations`

Reserva temporalmente el stock de los productos de reemplazo mientras se procesa el cobro. Una reserva se `CONSUMED` al completar la operacion o se `RELEASED` al cancelar, fallar o expirar; el stock disponible para otras operaciones descuenta reservas `ACTIVE` vigentes.

### 5.7 Ejemplo relacional de cuatro tablas

```sql
-- Producto base
products.id
    |
    +-- product_variants.product_id
            |
            +-- sale_items.product_variant_id
                    |
                    +-- sales.id = sale_items.sale_id
```

Reglas demostradas:

- nombres plurales y `snake_case`;
- PK uniforme `id`;
- FKs descriptivas;
- producto y variante separados;
- venta e items con relacion uno a muchos;
- borrado restringido para conservar historia comercial.

### 5.8 Migraciones

| Migracion | Cambio |
|---|---|
| `003` | Dispositivos y codigos de vinculacion de pantalla cliente |
| `004` | `payment_sessions.payment_id` pasa a nullable |
| `005` | Sesiones y lecturas del scanner movil |
| `006` | Normalizacion de barcodes Code 128C |
| `007` | Correo de comprobante en sesion de pago |
| `008` | OTP de recuperacion de contrasena |
| `009` | Snapshot del costo en `sale_items` |
| `010` | Cambios, devoluciones e items de reemplazo |
| `011` | Token QR de boleta y proposito del scanner |
| `012` | Recalculo historico de IGV incluido |
| `013` | Liquidaciones economicas separadas para cambios y devoluciones |
| `014` | Sesiones Culqi de diferencias enviadas a pantalla cliente |
| `015` | Reservas temporales de inventario para productos de reemplazo |
| `016` | Movimiento `CAMBIO_SALIDA` en el kardex de inventario |
| `017` | FK UUID entre sesiones de pago de ventas y tablets vinculadas |

Regla: una migracion aplicada nunca se edita para cambiar su historia. Se crea una nueva migracion incremental, idempotente cuando sea razonable y compatible con datos existentes.

## 6. Estandares de codificacion backend

### 6.1 Convenciones Python

| Elemento | Convencion | Ejemplo |
|---|---|---|
| Archivos | `snake_case.py` | `payment_session_service.py` |
| Clases | `PascalCase` | `PaymentSessionService` |
| Funciones/metodos | `snake_case` | `create_payment_session` |
| Variables | `snake_case` | `current_user` |
| Constantes | `UPPER_SNAKE_CASE` | `PASSWORD_RESET_MESSAGE` |
| Tipos | Anotaciones explicitas | `def login(...) -> TokenResponse` |
| Clases privadas | Prefijo `_` en metodos internos | `_hash_otp` |

### 6.2 Reglas backend

1. Toda entrada HTTP se define con Pydantic.
2. Todo endpoint protegido declara `get_current_user` o `require_roles`.
3. El endpoint crea/delega al servicio y retorna un schema.
4. El servicio controla reglas, estados y transaccion.
5. El repositorio concentra consultas SQLAlchemy.
6. No se concatenan datos del usuario en SQL.
7. El dinero usa `Decimal` y `Numeric`.
8. Los identificadores usan `UUID`.
9. Los errores esperables se convierten en `HTTPException` con texto seguro.
10. Un `commit` debe ocurrir al completar la unidad de negocio; ante fallo se debe hacer rollback.

### 6.3 Ejemplo integrado backend

El patron recomendado para un recurso protegido es:

```python
@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
) -> ProductResponse:
    service = ProductService(db)
    return service.create_product(payload)
```

El endpoint resuelve transporte y permisos. El servicio valida reglas, y el repositorio persiste. Esto reemplaza el ejemplo PHP/PDO de la guia referencial con el patron real de FastAPI y SQLAlchemy.

### 6.4 Comentarios y docstrings

- Documentar clases, reglas no obvias e integraciones.
- No comentar asignaciones evidentes.
- Explicar el motivo, no repetir la sintaxis.
- Usar docstrings breves en funciones publicas o sensibles.
- Mantener nombres descriptivos para reducir comentarios.

## 7. Estandares de codificacion frontend

### 7.1 Convenciones TypeScript y React

| Elemento | Convencion | Ejemplo |
|---|---|---|
| Componentes | `PascalCase` | `AppShell` |
| Hooks | prefijo `use` | `useAuth` |
| Funciones/variables | `camelCase` | `confirmLogout` |
| Constantes globales | `UPPER_SNAKE_CASE` | `AUTH_UNAUTHORIZED_EVENT` |
| Tipos | `PascalCase` | `ApiClientOptions` |
| Rutas App Router | carpeta en minusculas | `returns/history/page.tsx` |
| Alias interno | `@/` | `@/services/api-client` |

### 7.2 Tipado estricto

`tsconfig.json` tiene `strict: true` y `noEmit: true`. Por tanto:

- evitar `any`;
- modelar respuestas en `types/api.ts`;
- no asumir que datos opcionales existen;
- normalizar respuestas en servicios;
- validar estados antes de renderizar;
- ejecutar `npx tsc --noEmit` antes de integrar.

### 7.3 Cliente HTTP comun

Todas las funciones de dominio deben utilizar `apiClient`. El cliente:

- construye la URL desde `NEXT_PUBLIC_API_URL`;
- serializa JSON;
- agrega Bearer token cuando corresponde;
- desactiva cache para datos operativos;
- normaliza mensajes FastAPI;
- emite un evento global en 401;
- diferencia error HTTP de error de red.

No debe repetirse `fetch` sin necesidad en cada pagina.

### 7.4 UX obligatoria

- Textos visibles en espanol.
- Estados de carga, vacio, exito y error.
- Notificaciones no bloqueantes con Sonner.
- Confirmacion propia para acciones destructivas.
- En celular, listas adaptadas en vez de tablas con scroll horizontal.
- Botones con iconos Lucide cuando el simbolo es conocido.
- Inputs con etiquetas y mensajes asociados.
- Sidebar desktop fijo y menu movil de altura `100dvh`.
- Caja optimizada para pocos pasos y uso continuo.
- No mostrar datos antes de autenticar correctamente.

### 7.5 Persistencia local

La persistencia del navegador se divide por duracion y responsabilidad:

- `sessionStorage`: access token, refresh token, usuario autenticado y borrador temporal del carrito;
- `localStorage`: vinculacion del scanner, referencia de una venta enviada a tablet y credenciales del dispositivo de pantalla cliente;
- PostgreSQL: usuarios, catalogo, stock, ventas, pagos, devoluciones y toda informacion comercial definitiva.

Al cerrar sesion del operador se limpian tokens, usuario, scanner y estado de caja. La credencial de una tablet pertenece al dispositivo vinculado y se conserva hasta desvincularla expresamente; no representa la sesion JWT del operador. Ningun dato comercial definitivo puede depender solo del almacenamiento del navegador.

## 8. Flujo de desarrollo de un modulo

### 8.1 Orden recomendado

1. Definir objetivo, actores, entradas, salidas y estados.
2. Revisar si ya existe una entidad reutilizable.
3. Diseñar cambio de datos y migracion.
4. Crear o actualizar modelo SQLAlchemy.
5. Definir schemas Pydantic de request/response.
6. Implementar repositorio.
7. Implementar servicio y transaccion.
8. Exponer endpoint con rol explicito.
9. Agregar tipos y servicio frontend.
10. Construir pantalla y estados UX.
11. Validar desktop y movil.
12. Probar errores, permisos y datos vacios.
13. Ejecutar validaciones estaticas y build.
14. Documentar endpoint, migracion y operacion.

### 8.2 Criterio de aceptacion

Un modulo no se considera terminado solo porque abre en el navegador. Debe incluir:

- regla comercial definida;
- persistencia coherente;
- permisos;
- validacion de entrada;
- manejo de error;
- estado de carga y vacio;
- responsive;
- trazabilidad cuando aplica;
- prueba de flujo feliz y fallos;
- documentacion minima;
- migracion reproducible si cambia datos.

## 9. Flujos funcionales actuales

### 9.1 Autenticacion

```text
Login -> verificar correo/bcrypt -> emitir access y refresh JWT
      -> cargar /auth/me -> habilitar AppShell
```

Recuperacion:

```text
Correo -> OTP aleatorio de 6 digitos -> hash SHA-256 con secreto
       -> SMTP -> validar vigencia -> cambiar hash bcrypt
       -> consumir OTP -> redirigir al login
```

La respuesta de solicitud no revela si el correo existe, reduciendo enumeracion de usuarios.

### 9.2 Catalogo e inventario

```text
Categoria -> Producto base -> Variante vendible
Variante -> SKU + barcode + talla + color + costo + precio + stock
Movimiento -> stock anterior + cantidad + stock nuevo + motivo
```

El costo se usa para reportar costo de mercaderia, utilidad bruta y margen. Al vender se copia a `sale_items.cost_price`.

### 9.3 Venta y pago

```text
Carrito -> crear sale PENDING_PAYMENT
        -> crear sale_items
        -> descontar stock
        -> registrar SALE_OUT
        -> pago manual o sesion tablet
        -> PAID y comprobante
```

Si la venta pendiente se cancela:

- pasa a `CANCELLED`;
- se cancelan sesiones pendientes;
- se restaura stock;
- se registra `CANCEL_SALE_IN`;
- se limpian datos temporales de caja.

Una venta cancelada no debe seguir apareciendo como deuda pendiente.

### 9.4 IGV incluido

En Peru el precio final ya incluye IGV. Kadosh aplica:

```text
Base imponible = Total / 1.18
IGV incluido   = Total - Base imponible
Equivalente    = Total * 18 / 118
```

Ejemplo para S/ 169.90:

```text
Base imponible: S/ 143.98
IGV incluido:   S/ 25.92
Total:          S/ 169.90
```

El IGV se informa, no se suma nuevamente al cliente.

### 9.5 Scanner movil

Existen dos propositos aislados:

- `POS_PRODUCT_SCAN`: envia barcode/SKU al carrito de caja.
- `RECEIPT_LOOKUP`: envia el token o numero para localizar una boleta.

Cada sesion tiene token de vinculacion y lecturas asociadas. Esto evita que el scanner de devoluciones agregue accidentalmente un producto al carrito.

### 9.6 Pantalla cliente

1. ADMIN genera codigo temporal.
2. La tablet ingresa el codigo.
3. El backend valida hash y expiracion.
4. Se crea o reutiliza el dispositivo.
5. Se genera un token de dispositivo.
6. Caja envia una sesion con venta y monto.
7. La tablet consulta sesiones activas y muestra el carrito.
8. El cliente paga o el operador cancela.

### 9.7 Cambios y devoluciones

1. Buscar venta pagada por numero, DNI, nombre, telefono, monto o QR.
2. Elegir la venta exacta.
3. Seleccionar items y cantidades disponibles para devolver.
4. Indicar motivo, condicion y destino de inventario.
5. En cambio, seleccionar reemplazo y cantidad.
6. Calcular valor recibido, reemplazo y diferencia.
7. Crear una liquidacion `CHARGE`, `REFUND` o `NONE` segun el signo de la diferencia.
8. Si el cliente debe pagar por Culqi, reservar los reemplazos y enviar la sesion a la tablet.
9. Procesar tarjeta mediante token y Charges, o billetera mediante Order y confirmacion.
10. Validar en backend importe, moneda, metadata, estado e identificadores del proveedor.
11. Consumir reservas y registrar `CAMBIO_SALIDA` solo cuando el pago queda confirmado.
12. Liberar reservas al cancelar, fallar o expirar una operacion no pagada.
13. Guardar el historial con numero unico de operacion y resultado economico.

Reglas de integridad:

- el precio del reemplazo y el importe de la diferencia se calculan en backend;
- una orden Culqi pagada tiene precedencia y no puede generar un segundo cargo;
- una orden pendiente debe eliminarse en Culqi antes de cancelar localmente;
- una sesion `PROCESSING` no puede marcarse manualmente como pagada, fallida, cancelada o expirada;
- si Culqi confirma el pago pero falla la actualizacion de inventario, la operacion pasa a `PAYMENT_REVIEW` para conciliacion, no a cancelada;
- no se puede devolver mas cantidad que la comprada menos lo ya procesado.

### 9.8 Boleta digital

Cada venta tiene `receipt_token` unico. El QR apunta a `/receipt/[token]`, que consume el endpoint publico limitado. La vista incluye datos del negocio, venta, cliente, items, medio de pago, base imponible, IGV incluido, total y opciones del navegador para imprimir o guardar como PDF.

El comprobante solo esta disponible cuando la venta y su pago se encuentran en estado `PAID`. Una venta pendiente o cancelada conserva su numero y trazabilidad administrativa, pero no expone QR publico, descarga ni plantilla imprimible. El endpoint publico responde como recurso no disponible aunque alguien conserve un token anterior.

El documento actual es un **comprobante interno de venta**. No debe denominarse boleta electronica SUNAT mientras no exista integracion CPE, serie/correlativo fiscal, firma y aceptacion correspondiente.

## 10. Mapa de modulos y rutas frontend

| Ruta | Modulo | Acceso esperado |
|---|---|---|
| `/login` | Inicio de sesion | Publico |
| `/forgot-password` | Recuperacion OTP | Publico |
| `/dashboard` | Panel | Autenticado |
| `/pos` | Caja | ADMIN/SELLER/CASHIER |
| `/sales` | Ventas | Autenticado segun backend |
| `/sales/[saleId]` | Detalle de venta | Autenticado |
| `/returns` | Cambios y devoluciones | Operador autorizado |
| `/returns/history` | Historial de devoluciones | Operador autorizado |
| `/products` | Productos | Lectura general; escritura ADMIN |
| `/product-variants` | Catalogo | Lectura general; escritura ADMIN |
| `/inventory` | Inventario | Roles autorizados |
| `/customers` | Clientes | Roles autorizados |
| `/payments` | Pagos | Roles autorizados |
| `/customer-displays` | Dispositivos | ADMIN |
| `/customer-display/pair` | Vinculacion tablet | Publico con codigo |
| `/customer-display` | Vista tablet | Token de dispositivo |
| `/scanner/[sessionId]/[pairingToken]` | Scanner movil | Token temporal |
| `/reports` | Reportes | ADMIN |
| `/receipt/[token]` | Comprobante digital | Publico con token no predecible |

## 11. Mapa resumido de API

Prefijo general: `/api/v1`.

| Grupo | Operaciones principales | Proteccion |
|---|---|---|
| `/health`, `/system` | Salud y diagnostico | Salud publica; revisar diagnosticos de BD en produccion |
| `/auth` | Bootstrap, login, OTP, usuario actual | Mixto |
| `/roles` | Listar roles | JWT/RBAC |
| `/categories` | Listar, obtener, crear, editar | Lectura operativa; escritura ADMIN |
| `/products` | CRUD parcial | Lectura operativa; escritura ADMIN |
| `/product-variants` | CRUD, buscar codigo, backfill | JWT/RBAC |
| `/inventory` | Listar y registrar movimientos | JWT/RBAC |
| `/customers` | Listar, buscar, resolver DNI, crear, editar | JWT/RBAC |
| `/sales` | Listar, obtener, crear, pagar, cancelar | JWT/RBAC |
| `/payments` | Listar y pago manual | JWT/RBAC |
| `/payment-sessions` | Crear, consultar y actualizar | JWT/RBAC |
| `/customer-display-devices` | Vincular y administrar | Mixto: ADMIN y token/codigo |
| `/customer-display` | Sesiones y recibo para tablet | Credencial de dispositivo |
| `/scanner-sessions` | Crear, leer scans, enviar scan | JWT para operador; token para celular |
| `/culqi` | Charge, order y confirmacion de ventas | Sesion de pago, credencial de dispositivo y validacion del proveedor |
| `/reports` | Dashboard y detalle | ADMIN |
| `/returns` | Listar y crear | JWT/RBAC |
| `/return-culqi` | Charge, orden, confirmacion y conciliacion de diferencias | Token de dispositivo y validacion de proveedor |
| `/audit-logs` | Consultas | ADMIN |
| `/public/receipts/{token}` | Comprobante limitado | Publico por token |

FastAPI genera documentacion OpenAPI en `/docs` cuando no se deshabilita en produccion.

## 12. Seguridad y control de vulnerabilidades

### 12.1 Controles implementados

| Riesgo | Control actual |
|---|---|
| Inyeccion SQL | SQLAlchemy y parametros; no concatenacion directa en flujos normales |
| Contrasenas expuestas | Hash bcrypt con minimo de 8 caracteres |
| Suplantacion | JWT firmado HS256 con expiracion |
| Acceso indebido | `require_roles` y verificacion de usuario activo |
| Enumeracion de correos | Mensaje neutro en solicitud OTP |
| Robo de OTP en BD | Se almacena hash, no codigo plano |
| Reuso de OTP | `consumed_at`, expiracion y consumo de activos |
| Secretos frontend | Culqi secret, BD, JWT y SMTP solo backend |
| XSS directo | React escapa texto por defecto; no se observo `dangerouslySetInnerHTML` como patron |
| Acceso tablet | Token de dispositivo almacenado como hash en backend |
| Acceso scanner | Token de pairing y sesion con proposito |
| CORS | Lista de frontend y redes locales controladas |
| Integridad de datos | PK, FK, `CHECK`, unicos e indices PostgreSQL |
| Precio de venta | El backend usa el precio vigente del catalogo; el cliente no puede sobrescribirlo |
| Concurrencia de stock | Bloqueo de filas en ventas, variantes, sesiones y devoluciones criticas |
| Pago Culqi duplicado | Identificadores unicos, validacion de orden y prioridad del estado pagado |
| Stock durante cambios | Reservas activas reducen disponibilidad y se consumen o liberan atomicamente |
| Estado del proveedor | El operador no puede declarar manualmente `PAID` o `FAILED` |

### 12.2 JWT y sesiones

- Access token: 30 minutos por defecto.
- Refresh token: 7 dias por defecto.
- Algoritmo: HS256.
- Claims: `sub`, `type`, `iat`, `exp`, rol y correo.
- El backend verifica que el token sea de tipo `access`.
- El usuario se vuelve a cargar desde BD y debe estar activo.
- Existe `POST /auth/refresh`; valida un token de tipo `refresh` y rota ambos tokens.
- El frontend guarda access, refresh y usuario en `sessionStorage`, por lo que la sesion no se comparte indefinidamente entre sesiones del navegador.

### 12.3 Riesgos y mejoras recomendadas

| Prioridad | Hallazgo | Recomendacion |
|---|---|---|
| Alta | Tokens de usuario siguen accesibles desde JavaScript en `sessionStorage` | Evaluar cookies `HttpOnly`, `Secure`, `SameSite` y proteccion CSRF |
| Alta | La suite automatizada cubre contratos criticos, no todo el dominio | Ampliar integracion de venta, inventario, Culqi y E2E frontend |
| Alta | Endpoints publicos sensibles pueden sufrir abuso | Rate limit para login, OTP, pairing, scanner y recibos |
| Alta | CORS permite redes privadas en desarrollo | Separar politica CORS por `APP_ENV` |
| Media | Endpoint bootstrap es publico hasta existir un usuario | Deshabilitarlo por configuracion tras aprovisionamiento |
| Media | Los tokens publicos de boleta no tienen expiracion | Mantener alta entropia y agregar opcion de revocacion |
| Media | Logs aun no son estructurados | Usar `logging`, request ID y plataforma centralizada |
| Media | RLS esta habilitado, pero el modelo de politicas debe verificarse | Documentar rol de conexion y politicas Supabase |
| Media | Variables `NEXT_PUBLIC_CUSTOMER_DISPLAY_*` son visibles | No tratar ningun `NEXT_PUBLIC_*` como secreto |
| Baja | OpenAPI puede revelar superficie | Restringir `/docs` en produccion si el contexto lo exige |

### 12.4 XSS, CSRF y salida

React escapa valores renderizados. Se debe evitar `dangerouslySetInnerHTML`. Si se migra autenticacion a cookies, debera incorporarse proteccion CSRF. Los valores incluidos en CSV deben sanear formulas que empiecen con `=`, `+`, `-` o `@` para prevenir CSV injection.

### 12.5 Secretos

Nunca se suben al repositorio:

- `SUPABASE_DATABASE_URL`;
- `JWT_SECRET_KEY`;
- `CULQI_SECRET_KEY`;
- `APIPERU_TOKEN`;
- `SMTP_PASSWORD`;
- tokens reales de dispositivos;
- archivos `.env` y `.env.local`.

Solo las claves deliberadamente publicas usan prefijo `NEXT_PUBLIC_`.

## 13. Manejo de errores, excepciones y logs

### 13.1 Politica actual

- Pydantic devuelve 422 para payload invalido.
- Los servicios lanzan `HTTPException` para errores comerciales.
- El cliente extrae `detail` de FastAPI.
- Los errores de red muestran la URL llamada para diagnostico.
- Las respuestas no incluyen stack trace de PostgreSQL.
- El middleware agrega `Server-Timing` y `X-Process-Time-Ms`.

### 13.2 Estandar recomendado

| Tipo | HTTP | Ejemplo |
|---|---:|---|
| Entrada invalida | 422 | Campo fuera de rango |
| Credencial invalida | 401 | Token vencido |
| Sin permiso | 403 | CASHIER intenta editar categoria |
| No encontrado | 404 | Venta inexistente |
| Conflicto | 409 | SKU duplicado o devolucion excedida |
| Regla comercial | 400 | Stock insuficiente |
| Proveedor externo | 502/503 | Culqi o ApiPeru no disponible |
| Error inesperado | 500 | Mensaje generico y detalle solo en logs |

Formato objetivo de log:

```json
{
  "timestamp": "2026-07-14T15:30:00Z",
  "level": "ERROR",
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/v1/sales",
  "user_id": "uuid",
  "event": "sale_creation_failed",
  "message": "Stock insuficiente",
  "duration_ms": 182.42
}
```

No registrar contrasenas, JWT completos, OTP, datos de tarjeta, `CULQI_SECRET_KEY` ni URL de BD.

### 13.3 Transacciones y rollback

Venta, items, inventario y auditoria deben confirmarse como una unidad. Una excepcion debe provocar rollback. Lo mismo aplica a cambios/devoluciones. No debe quedar stock descontado sin venta o devolucion creada sin movimientos asociados.

## 14. Rendimiento y disponibilidad

### 14.1 Medidas actuales

- Indices en campos de busqueda y relaciones.
- `pool_pre_ping=True`.
- `NullPool`, apropiado para ejecucion serverless.
- `prepare_threshold=None` para compatibilidad con pooler PostgreSQL.
- Region Vercel backend `sfo1`.
- `cache: no-store` para datos operativos.
- Indicadores de tiempo de procesamiento.

### 14.2 Cold start

Vercel puede detener funciones Python inactivas. La primera peticion debe iniciar runtime, importar dependencias y abrir conexion. Para reducir impacto:

1. Mantener dependencias estrictamente necesarias.
2. Evitar trabajo pesado durante importacion.
3. Ubicar API y Supabase en regiones cercanas cuando sea posible.
4. Mantener consultas indexadas y respuestas acotadas.
5. Usar un monitor externo de salud solo si el plan y las politicas lo permiten.
6. Medir por separado cold start, red y SQL mediante logs y headers.
7. Considerar un proveedor backend persistente si el POS necesita latencia estable garantizada.

Un ping periodico reduce algunos cold starts, pero no es una garantia y puede consumir cuota. La solucion profesional es medir primero y elegir infraestructura segun el SLA requerido.

### 14.3 Mejoras de rendimiento

- Paginacion server-side en ventas, pagos, auditoria e inventario.
- Busqueda server-side con debounce.
- Limites explicitos en listados.
- Evitar N+1 mediante carga de relaciones.
- Cache selectivo para categorias y catalogo estable.
- Suspense/skeletons sin ocultar errores.
- Compresion y optimizacion de activos.
- Instrumentacion de consultas lentas.

## 15. Control de versiones Git

### 15.1 Ramas

```text
main                  produccion estable
develop               integracion, si el equipo la adopta
feature/nombre-corto  funcionalidad
fix/nombre-corto      correccion
hotfix/nombre-corto   incidencia urgente
docs/nombre-corto     documentacion
```

Para un equipo pequeno puede trabajarse desde ramas cortas contra `main`, siempre mediante Pull Request.

### 15.2 Commits semanticos

```text
feat: add return receipt lookup
fix: restore stock when pending sale is cancelled
docs: add system coding guide
refactor: centralize payment status formatting
test: cover sale cancellation transaction
chore: update development tooling
```

Cada commit debe representar una unidad coherente. No mezclar scripts de diagnostico personales con una funcionalidad.

### 15.3 Flujo de Pull Request

1. Actualizar rama base.
2. Crear rama descriptiva.
3. Implementar por bloques pequenos.
4. Ejecutar validaciones.
5. Revisar `git diff` y secretos.
6. Crear commits semanticos.
7. Abrir PR con objetivo, cambios, migracion y pruebas.
8. Obtener revision de otra persona.
9. Corregir hallazgos.
10. Integrar y observar despliegue Vercel.

### 15.4 Contenido minimo del PR

- problema u objetivo;
- solucion tecnica;
- rutas y archivos afectados;
- cambio de BD y compatibilidad;
- evidencia desktop/movil si cambia UI;
- comandos ejecutados;
- casos manuales probados;
- riesgos o pendientes conocidos;
- plan de rollback.

## 16. Calidad y pruebas

### 16.1 Validaciones actuales obligatorias

Frontend:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run lint
npx tsc --noEmit
npm run build
```

Backend:

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
python -m compileall app
python -c "from app.main import app; print(app.title)"
python -m unittest discover -s tests -p "test_*.py"
```

### 16.2 Estado real de pruebas

El backend incluye `tests/test_critical_contracts.py`, actualmente con catorce contratos automatizados para impedir sobrescritura de precios, publicacion de comprobantes pendientes o cancelados, identificadores de tablet invalidos, perdida de la FK de dispositivos, items duplicados en devoluciones, estados de proveedor declarados por el operador, transiciones indebidas desde `PROCESSING`, diferencias de importe o metadata Culqi y cancelacion insegura de ordenes pagadas. Tambien existe una prueba E2E Culqi sandbox que ejecuta un cobro aislado, valida el efecto temporal de inventario y revierte los datos locales de prueba.

Estas pruebas constituyen una base de regresion valiosa, pero todavia no equivalen a una cobertura completa. Faltan pruebas de integracion con PostgreSQL para todos los estados, pruebas frontend de componentes y una suite Playwright del recorrido de usuario.

### 16.3 Piramide recomendada

| Nivel | Casos prioritarios |
|---|---|
| Unitarias backend | IGV, totales, barcode, estados, diferencia de cambio |
| Servicios backend | Venta atomica, cancelacion, pago, devolucion, stock |
| API integracion | Login/RBAC, CRUD, errores y transacciones |
| Frontend unitarias | Formateadores, reducers y servicios |
| E2E | Login, venta, pago, cancelacion, QR, devolucion |
| Seguridad | Expiracion JWT, roles, rate limit, tokens invalidos |

### 16.4 Casos criticos antes de produccion

1. Dos ventas simultaneas no deben dejar stock negativo.
2. Fallo al crear un item debe revertir la venta.
3. Cancelar devuelve exactamente el stock descontado una sola vez.
4. Un pago duplicado no debe duplicar ingreso.
5. Una devolucion no excede cantidad comprada menos devuelta.
6. Un QR de producto no altera el flujo de boleta.
7. Logout limpia scanner, tablet seleccionada y carrito temporal.
8. Un CASHIER no puede ejecutar acciones ADMIN.
9. OTP vencido, consumido o incorrecto se rechaza.
10. El comprobante historico conserva precio y costo de la venta.

## 17. Configuracion por ambiente

### 17.1 Backend

| Variable | Sensible | Finalidad |
|---|---|---|
| `APP_NAME`, `APP_ENV`, `APP_VERSION` | No | Identidad y ambiente |
| `API_V1_PREFIX` | No | Prefijo de API |
| `FRONTEND_URL` | No | CORS del frontend |
| `SUPABASE_DATABASE_URL` | Si | Conexion PostgreSQL persistente |
| `JWT_SECRET_KEY` | Si | Firma de tokens y hash OTP |
| `JWT_ALGORITHM` | No | Algoritmo JWT |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Vigencia access |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | No | Vigencia refresh |
| `CULQI_PUBLIC_KEY` | No/semi-publica | Identificador Culqi |
| `CULQI_SECRET_KEY` | Si | Operaciones servidor Culqi |
| `APIPERU_TOKEN` | Si | Consulta DNI |
| `CUSTOMER_DISPLAY_DEVICE_SECRET` | Si | Compatibilidad de pantalla |
| `SMTP_USER`, `SMTP_PASSWORD` | Si | Entrega OTP |

### 17.2 Frontend

Toda variable `NEXT_PUBLIC_*` queda incluida en JavaScript y es visible. Por tanto no puede contener secretos.

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL publica del backend + `/api/v1` |
| `NEXT_PUBLIC_SCANNER_WEB_URL` | Origen publico para enlaces QR |
| `NEXT_PUBLIC_SCANNER_API_URL` | API alcanzable desde celular |
| `NEXT_PUBLIC_CULQI_PUBLIC_KEY` | Clave publica Culqi |
| `NEXT_PUBLIC_CULQI_RSA_ID` | Configuracion publica Culqi |
| `NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY` | Llave RSA publica |

### 17.3 Regla de persistencia

Desplegar un commit en Vercel no borra la base de datos porque PostgreSQL vive en Supabase. Se conservan usuarios, clientes y ventas siempre que todos los despliegues usen la misma `SUPABASE_DATABASE_URL`. Nunca debe sustituirse por una base temporal durante produccion.

## 18. Despliegue y operacion

### 18.1 Arquitectura productiva

```text
Usuario
  -> https://kadosh-pos-web.vercel.app
  -> Next.js en Vercel
  -> HTTPS /api/v1
  -> FastAPI en Vercel
  -> Supabase PostgreSQL
```

### 18.2 Despliegue automatico

Cuando los proyectos Vercel estan conectados al repositorio GitHub:

1. se realiza commit;
2. se hace push a la rama vinculada;
3. Vercel construye un deployment;
4. si compila, actualiza produccion o preview segun la rama;
5. las variables se leen desde Vercel, no desde el `.env` local.

### 18.3 Checklist previo

- Migraciones aplicadas en Supabase.
- Variables Production y Preview configuradas.
- `FRONTEND_URL` coincide con dominio web.
- `NEXT_PUBLIC_API_URL` apunta al dominio API.
- CORS probado.
- Login, venta y pago probados.
- Cambio con diferencia Culqi, cancelacion y liberacion de reservas probados.
- No hay secretos en Git.
- Lint, tipos, build y compileall correctos.
- Plan de rollback identificado por commit/deployment.

## 19. Auditoria profesional del estado actual

### 19.1 Fortalezas

- Separacion clara endpoint/servicio/repositorio/modelo.
- Contratos Pydantic y TypeScript estricto.
- PostgreSQL con integridad referencial.
- Snapshot de datos comerciales en items de venta.
- Inventario trazable.
- Roles aplicados en numerosos endpoints.
- UI responsive trabajada para movil.
- Tokens especificos para scanner, tablet y boleta.
- Variables de entorno separadas por frontend/backend.
- Despliegue desacoplado de la persistencia.
- Precios de catalogo autoritativos en backend y bloqueo de filas criticas.
- Reserva de inventario y conciliacion segura para diferencias de cambios.
- Contratos automatizados y prueba Culqi sandbox disponibles.

### 19.2 Deuda tecnica y funcional

| Prioridad | Trabajo | Motivo |
|---|---|---|
| P0 | Ampliar pruebas de integracion de venta/inventario/devoluciones | La base contractual no cubre todos los fallos de BD y red |
| P0 | Webhooks Culqi firmados y conciliacion asincrona | Recuperar estados cuando el navegador o la red se interrumpen |
| P1 | Cookies HttpOnly y revocacion de refresh | Reducir impacto de XSS y controlar sesiones comprometidas |
| P1 | Logs estructurados y observabilidad | Diagnostico en produccion |
| P1 | Paginacion server-side | Crecimiento de datos |
| P1 | Facturacion electronica formal | Requisito legal si se emiten CPE |
| P1 | Politica de devoluciones y autorizaciones | Evitar operaciones discrecionales |
| P2 | Unificar migraciones bajo Alembic o runner formal | Reproducibilidad |
| P2 | Modulo de usuarios y permisos UI | Administracion completa de RBAC |
| P2 | Backups y restauracion probada | Continuidad del negocio |
| P2 | Accesibilidad automatizada | Calidad inclusiva |

### 19.3 Recomendacion de proximas etapas

**Etapa 1 - Integridad comercial**

- ampliar pruebas de venta, pago, anulacion y devolucion;
- incorporar webhooks verificados e idempotentes;
- automatizar conciliacion de sesiones `PAYMENT_REVIEW`;
- probar concurrencia real con PostgreSQL y varias cajas.

**Etapa 2 - Seguridad operativa**

- cookies HttpOnly y refresh rotativo;
- rate limiting;
- logs centralizados;
- revision RBAC endpoint por endpoint.

**Etapa 3 - Escalabilidad**

- paginacion y filtros backend;
- metricas de rendimiento;
- estrategia de cold start;
- jobs o webhooks para procesos asincronos.

**Etapa 4 - Cumplimiento y administracion**

- evaluar facturacion electronica SUNAT;
- modulo de usuarios/roles;
- politica de retencion y privacidad;
- manual de respaldo y recuperacion.

## 20. Entregables tecnicos por modulo

Cada modulo aceptado debe entregar:

1. Historia o descripcion funcional.
2. Reglas de negocio y estados.
3. Migracion y diccionario de datos.
4. Modelos SQLAlchemy.
5. Schemas Pydantic.
6. Repositorio y servicio.
7. Mapa de endpoints y roles.
8. Tipos y servicio frontend.
9. Pantallas desktop/movil.
10. Pruebas unitarias/integracion/E2E segun riesgo.
11. Evidencia de validaciones.
12. Variables nuevas documentadas.
13. Plan de despliegue y rollback.
14. Actualizacion de README o manual operativo.

## 21. Definicion de terminado

Un cambio esta terminado cuando:

- cumple el caso de uso real;
- no rompe flujos existentes;
- respeta capas y convenciones;
- valida datos en frontend y backend;
- controla permisos;
- conserva integridad transaccional;
- maneja carga, vacio y error;
- funciona en movil y escritorio;
- no expone secretos;
- cuenta con pruebas proporcionales al riesgo;
- pasa lint, TypeScript, build y compileall;
- documenta migraciones y operacion;
- fue revisado mediante Pull Request antes de produccion.

## 22. Conclusion

Kadosh POS ya supera la etapa de prototipo visual: posee una arquitectura cliente-servidor coherente, persistencia relacional, autenticacion, catalogo, inventario, ventas, pagos, dispositivos, comprobantes QR, devoluciones, reservas y reportes. La tecnologia correcta para documentarlo no es PHP/MVC, sino Next.js y React en presentacion, FastAPI con servicios y repositorios en negocio, SQLAlchemy/Pydantic en acceso y contratos, y PostgreSQL/Supabase en persistencia.

La prioridad profesional no debe ser agregar modulos de forma indefinida, sino ampliar la cobertura automatizada, endurecer sesiones, incorporar webhooks y conciliacion, observar produccion y, si corresponde legalmente, formalizar la emision ante SUNAT. Esta guia debe actualizarse con cada cambio arquitectonico importante y revisarse antes de aceptar nuevos modulos.
