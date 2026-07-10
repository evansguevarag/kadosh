# Kadosh POS API

Backend profesional para el sistema POS de la tienda de ropa urbana Kadosh.

## Tecnologias

- Python
- FastAPI
- SQLAlchemy
- Supabase PostgreSQL
- JWT
- RBAC
- Culqi
- ApiPeruDev

## Ejecutar backend

Desde apps/api:

Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

## Swagger

http://localhost:8000/docs

## Modulos implementados

- Autenticacion JWT
- RBAC por roles
- Categorias
- Productos
- Variantes de productos
- Inventario con historial
- Consulta DNI con ApiPeruDev
- Clientes
- Ventas
- Pagos manuales
- Culqi
- Sesiones de pago para tablet
- Pantalla del cliente con X-Device-Secret
- Reportes operativos con Python y SQLAlchemy
- Auditoria

## Estado

Backend funcional para integracion con frontend.
