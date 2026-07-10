# Reglas de trabajo con Codex para Kadosh

Este documento define como debe trabajar Codex en este proyecto para ahorrar tokens, evitar repetir contexto y mantener una calidad profesional.

## Objetivo

Trabajar por bloques pequenos, claros y verificables, sin romper flujos existentes.

Codex debe ayudar a construir Kadosh como una plataforma profesional para caja, ventas, catalogo, inventario, clientes, pagos, reportes, pantalla de cliente y procesos internos de tienda.

## Reglas generales

1. Antes de modificar archivos, Codex debe revisar el contexto real del proyecto.
2. Si el cambio toca backend y frontend, Codex debe analizar ambos lados.
3. No debe romper funcionalidades que ya funcionan.
4. No debe tocar Culqi QR salvo que se pida explicitamente.
5. No debe hacer redisenos grandes sin explicar primero el flujo.
6. Debe preferir cambios incrementales y faciles de validar.
7. Debe respetar el estilo existente del proyecto.
8. Debe trabajar con los cambios actuales del usuario y no revertir archivos sin permiso.

## Control de tokens

Codex debe avisar que conviene cambiar de chat cuando:

- La conversacion tenga muchos temas mezclados.
- Se hayan acumulado muchas imagenes, errores y cambios anteriores.
- El resumen del estado actual sea mas util que seguir arrastrando todo el historial.
- Codex empiece a confundirse con tareas antiguas.
- Se vaya a empezar un modulo grande nuevo.
- La tarea nueva ya no dependa directamente de lo que se estaba haciendo.

Ejemplos de tareas que conviene empezar en un chat nuevo:

- Facturacion o boleta electronica formal.
- Culqi QR o billeteras digitales.
- Reportes avanzados.
- Usuarios, roles y permisos.
- Impresion profesional de comprobantes.
- Redisenar todo el flujo de caja.
- Integraciones externas.

Antes de recomendar cambiar de chat, Codex debe entregar:

1. Resumen corto del estado actual.
2. Que ya esta funcionando.
3. Que queda pendiente.
4. Archivos importantes tocados.
5. Siguiente tarea recomendada.
6. Prompt listo para pegar en el nuevo chat.

## Formato de respuesta esperado

### Si Codex va a analizar

Debe responder con:

- Que va a revisar.
- Que encontro.
- Que recomienda.
- Riesgos.
- Plan tecnico antes de editar.

### Si Codex va a modificar archivos

Debe responder con:

- Archivos que cambiara.
- Motivo del cambio.
- Cambios realizados.
- Comandos de validacion.
- Resultado de validacion.

### Si aparece un error

Debe responder con:

- Causa probable.
- Como reproducir.
- Solucion aplicada o recomendada.
- Si se debe reiniciar frontend, backend o ambos.

## Reglas de calidad

Antes de decir que termino, Codex debe validar segun corresponda.

### Frontend

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\web"
npm run lint
npx tsc --noEmit
```

### Backend

```powershell
Set-Location "C:\Users\JAIME Y BRISSA\kadosh-pos\apps\api"
.\.venv\Scripts\Activate.ps1
python -m compileall app
```

### Base de datos

Si el cambio toca base de datos, Codex debe indicar:

- Si requiere migracion.
- Que tabla cambia.
- Que campos se agregan o modifican.
- Si es compatible con datos existentes.
- SQL o comando necesario para aplicarlo.

## Reglas de UX

1. Todos los textos visibles deben estar en espanol.
2. Evitar tablas con scroll horizontal cuando se pueda resolver con un layout profesional.
3. No usar alertas nativas del navegador para acciones importantes.
4. Las acciones peligrosas deben usar un modal propio.
5. Caja debe ser rapida para vender: escanear, agregar, cobrar.
6. Clientes debe servir para consultar y administrar, pero la venta debe poder hacerse desde Caja.
7. Reportes PDF deben ser reportes limpios, no capturas de la interfaz.
8. El vendedor no debe repetir pasos innecesarios.
9. El flujo debe estar pensado para una tienda real, con poco cansancio operativo.
10. Si una accion termina una venta, debe limpiar los datos temporales correspondientes.

## Reglas para Caja

Caja debe priorizar velocidad.

El flujo ideal es:

1. Buscar cliente por DNI si aplica.
2. Escanear o ingresar codigo de producto.
3. Agregar producto automaticamente si el codigo coincide.
4. Revisar carrito.
5. Cobrar venta o enviar a pantalla de cliente.
6. Al terminar o cancelar, limpiar datos temporales de la venta.

No debe obligar al vendedor a ir al modulo Clientes para poder vender.

## Reglas para Clientes

El modulo Clientes debe servir para:

- Ver clientes registrados.
- Consultar historial o datos del cliente.
- Editar datos si es necesario.

La busqueda rapida para vender debe estar en Caja.

## Reglas para Pagos

Pagos debe servir para:

- Ver historial de pagos.
- Reimprimir comprobantes.
- Consultar metodo, estado y referencia.

El registro manual de pago debe vivir dentro del flujo de Caja, no como una tabla separada de ventas pendientes.

Si una venta esta pendiente porque se envio a Culqi o a tablet, debe existir una forma clara de cancelarla.

## Reglas para Reportes

Reportes debe permitir entender el negocio, no solo listar datos.

Debe priorizar:

- Ventas del periodo.
- Ingresos por metodo de pago.
- Productos mas vendidos.
- Stock bajo.
- Exportacion CSV compatible con Excel.
- PDF limpio tipo reporte.

El PDF no debe imprimir la interfaz visual del sistema.

## Cuando Codex debe pedir confirmacion

Codex debe pedir confirmacion antes de:

- Cambiar arquitectura.
- Agregar librerias.
- Crear migraciones grandes.
- Eliminar modulos.
- Cambiar el flujo de pagos.
- Tocar Culqi QR.
- Hacer cambios visuales amplios.
- Limpiar o reiniciar base de datos.
- Ejecutar comandos destructivos.

## Que debe evitar Codex

- No responder con explicaciones enormes si el usuario pidio avanzar.
- No mezclar muchas tareas en un solo cambio.
- No tocar archivos sin relacion.
- No cambiar nombres internos criticos si solo se requiere cambio visual.
- No asumir que el backend esta bien solo porque el frontend compila.
- No dejar sesiones de comandos corriendo.
- No usar soluciones temporales si el problema requiere backend.

## Prompt para abrir un nuevo chat

Usar este prompt cuando se decida cambiar de chat:

```md
Estamos trabajando en el proyecto:

C:\Users\JAIME Y BRISSA\kadosh-pos

Lee primero:

1. README.md
2. docs/codex/01_PROJECT_CONTEXT.md
3. docs/codex/02_CURRENT_STATUS_AND_PROBLEMS.md
4. docs/codex/03_CODEX_TASK_PROMPT.md
5. docs/codex/04_CODEX_WORKFLOW_RULES.md
6. apps/web/AGENTS.md si existe
7. apps/api/BACKEND_TEST_CHECKLIST.md si existe

Contexto actual:

- Es un sistema Kadosh para caja, ventas, productos, catalogo, inventario, clientes, pagos, reportes y pantalla de cliente.
- No tocar Culqi QR por ahora, salvo que lo pida explicitamente.
- Mantener funcionando lo que ya esta hecho.
- Trabajar por bloques pequenos para ahorrar tokens.
- Antes de editar, analiza el flujo y dime el plan tecnico.
- Cuando modifiques, valida frontend/backend segun corresponda.
- Si la conversacion se vuelve muy larga, avisame que conviene cambiar de chat y dame resumen listo para pegar.

Tarea nueva:

[ESCRIBIR AQUI LA TAREA EXACTA]
```

## Resumen para Codex

Si estas leyendo esto en un chat nuevo:

- No empieces editando a ciegas.
- Lee los documentos de contexto.
- Revisa el codigo real.
- Propone un plan corto.
- Ejecuta cambios pequenos.
- Valida.
- Reporta claro y sin gastar tokens innecesarios.
