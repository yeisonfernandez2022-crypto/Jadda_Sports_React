# Panel Admin Revamp — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los 14 cambios del panel admin acordados: páginas en vez de modales (usuario/reto/vendedor), estado de venta 100% automático (admin y vendedor), cards KPI funcionales, badges veraces del sidebar, panel de notificaciones que cabe en pantalla, Excel/PDF arreglados, Reportes con look del Dashboard, carpetas de Cloudinary correctas, eliminar páginas de Categorías y Chats (queda el widget flotante), y consistencia visual del panel.

**Architecture:** Backend Express 5 CommonJS (`backend/controllers|routes|utils`) + SPA React 19 TS (`frontend/src/{admin,pages,components,context}`). El estado de la venta deja de ser editable a mano: `actualizarEstadoGenerico` (admin) y `actualizarEnvioVenta` (vendedor) ganan las transiciones `ENTREGADO→COMPLETADA` y `CANCELADO→cancelarVentaYReembolsar`; los endpoints `PUT estado` se eliminan en ambos paneles. Tres modales se convierten en páginas de ruta completa reutilizando endpoints (2 nuevos). El widget flotante gana `abrirChatPorId` y hereda todo el tráfico de chats.

**Tech Stack:** Node 22, Express 5, MySQL 8, exceljs, pdfkit, vitest (backend), React 19 + TS + Vite 8, Bootstrap 5, SweetAlert2, vitest + RTL + MSW (frontend).

**Spec:** `docs/superpowers/specs/2026-11-17-panel-admin-revamp-design.md` (el plan argumenta desde el spec; leer ambos).

## Global Constraints

- Ejecutar desde la raíz con `corepack pnpm`. Tests backend: `corepack pnpm --prefix backend test`; targeted: `corepack pnpm --prefix backend exec vitest run <nombre-archivo>` (el config incluye `../tests/backend/**`). Frontend: `corepack pnpm --prefix frontend test|lint|build`; targeted: `corepack pnpm --prefix frontend exec vitest run <nombre-archivo>`.
- Identificadores, mensajes y documentación en español (CODING_STANDARDS.md). Commits Conventional Commits, ramas descriptivas.
- Sesión por cookie: todo `fetch` con `credentials: "include"`. No existe JWT.
- CSS: un archivo por página con prefijo propio; reutilizar clases existentes de `adminDashboard.css` en vez de inventar nuevas.
- Nunca romper el trinquete de cobertura: al final correr `node backend/scripts/cobertura-combinada.mjs <umbral>` con la variable `COBERTURA_UMBRAL` del repo.
- Los pagos Wompi no cambian; solo desaparece la edición manual de `VENTAS.ESTADO`.
- Trabajar en worktree/rama `feature/panel-admin` desde `Develop` (skill using-git-worktrees al ejecutar).
- Comandos de shell en PowerShell (Windows): usar comillas para rutas con espacios.

## Review Focus

1. **Venta `PENDIENTE_PAGO` y envío marcado `CANCELADO`** → la venta queda `CANCELADA` (sin reembolso de dinero) y el stock reingresa; respuesta 200 con mensaje. Test: Task 1 / Task 3.
2. **Excel/PDF con rango sin datos** (serie vacía, sin más vendidos, sin usuarios, sin vendedores) → Excel válido con dataBar y PDF de 1 página, cero hojas en blanco. Test: Task 5.
3. **Notificación vieja con RUTA `/admin/chats?chat=7`** (o `/chats`/`/vendedor/chats`) → click abre el widget flotante con ese chat; nunca navega a un 404. Test: Task 15.
4. **Panel de notificaciones ≤992px** → fijo dentro del viewport, ancho `min(360px, 100vw-24px)`, scroll interno; nada cortado. Test: Task 17 (visual + lint/build).
5. **Badge del sidebar de la sección actual** → siempre oculto aunque el conteo venga > 0; tras aprobar/rechazar se refresca por evento. Test: Task 16.
6. **`POST /api/productos/imagenes` con `tipo` inválido** → 400; solo `tipo: "banner"` o ausente. Test: Task 6.

---

### Task 1: Backend — transiciones automáticas del envío en admin

**Files:**
- Modify: `backend/controllers/adminController.js` (función `actualizarEstadoGenerico`, líneas ~105-165)
- Test: `tests/backend/unitarios/adminController.test.js`

**Interfaces:**
- Consumes: `cancelarVentaYReembolsar({ idVenta, canceladaPor })` de `backend/utils/cancelacionVenta.js` (ya requerido en el archivo), `notificarCambioEstado(id, tipo, estado)` (ya en el archivo), `db` (pool inyectable vía `exports._useDb`, patrón de la suite).
- Produces: `PUT /api/admin/compras/:id/envio` con `estado_envio: "ENTREGADO"` → respuesta `{ ok, msg, ventaEstado?: "COMPLETADA" }`; `estado_envio: "CANCELADO"` → `{ ok, msg?, reembolso?, pagoConfirmado? }` (misma forma que la cancelación de venta de hoy).

- [ ] **Step 1: Write the failing tests** en el `describe('actualizarEstadoEnvio')` existente (mantener los tests actuales que no choquen):

```js
// ENTREGADO sobre venta CONFIRMADA → VENTAS.ESTADO = COMPLETADA + notificación 'venta'
await adminController.actualizarEstadoEnvio(req({ body: { estado_envio: 'ENTREGADO' } }), res);
// assert: UPDATE VENTAS SET ESTADO='COMPLETADA' ejecutado + notificarCambioEstado(id,'venta','COMPLETADA') + res incluye ventaEstado:'COMPLETADA'

// ENTREGADO sobre venta PENDIENTE_PAGO → la venta NO cambia de estado
// CANCELADO sobre venta CONFIRMADA → cancelarVentaYReembolsar invocado con canceladaPor 'TIENDA',
//   respuesta con msg de reembolso cuando resultado.reembolso existe (copiar el mensaje del branch de VENTAS)
// CANCELADO sobre venta PENDIENTE_PAGO → también cancela la venta (reingreso de stock), sin reembolso
// CANCELADO con venta ya CANCELADA → sinCambios:true (idempotencia del util)
```

- [ ] **Step 2: Run test to verify it fails** — `corepack pnpm --prefix backend exec vitest run adminController` → FAIL.
- [ ] **Step 3: Implement** en `actualizarEstadoGenerico`: en la rama `tabla === 'ENVIOS'`, si `nuevoEstado === 'ENTREGADO'`: tras el `UPDATE ENVIOS` existente, leer `VENTAS.ESTADO` y si es `'CONFIRMADA'` ejecutar `UPDATE VENTAS SET ESTADO='COMPLETADA' WHERE ID_VENTA=?` + `notificarCambioEstado(id,'venta','COMPLETADA')` + añadir `ventaEstado:'COMPLETADA'` al response; si es `'CANCELADO'`: ejecutar el `UPDATE ENVIOS` normal y luego `cancelarVentaYReembolsar({ idVenta: id, canceladaPor: 'TIENDA' })` (404 si `!encontrada`, `sinCambios:true` si ya estaba), `notificarCambioEstado(id,'envio','CANCELADO')` y responder con el mismo cuerpo del branch de cancelación de VENTAS (líneas 123-140) reutilizando el mensaje de reembolso — extraer ese bloque a un helper local `responderCancelacion(res, id, resultado)` si evita duplicación.
- [ ] **Step 4: Run test to verify it passes** — mismo comando → PASS (suite completa verde).
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): estado de venta automático al entregar o cancelar envío"`.

### Task 2: Backend — eliminar `PUT /api/admin/compras/:id/estado`

**Files:**
- Modify: `backend/routes/adminRoutes.js` (quitar la línea `PUT /compras/:id/estado`), `backend/controllers/adminController.js` (quitar `actualizarEstadoCompra`, su JSDoc y su entrada en `module.exports`)
- Test: `tests/backend/unitarios/adminController.test.js` (eliminar los `describe('actualizarEstadoCompra…')` completos, líneas ~218-357)

- [ ] **Step 1: Remove the tests** de `actualizarEstadoCompra` (toda la funcionalidad muere; no se reemplaza).
- [ ] **Step 2: Implement**: borrar handler, export y ruta. `actualizarEstadoGenerico` se queda (la usa el envío).
- [ ] **Step 3: Run** — `corepack pnpm --prefix backend exec vitest run adminController` → PASS; `grep -r "actualizarEstadoCompra" backend/ tests/` → sin resultados.
- [ ] **Step 4: Commit** — `git commit -m "feat(admin): el estado de pago de la orden ya no es editable a mano"`.

### Task 3: Backend — transiciones automáticas del envío en vendedor + fin de su select de estado

**Files:**
- Modify: `backend/controllers/vendedorController.js` (`actualizarEnvioVenta` líneas 844-873; eliminar `actualizarEstadoVenta` líneas 876-943 y su export), `backend/routes/vendedorRoutes.js` (quitar `PUT /ventas/:id/estado`, línea 28)
- Test: `tests/backend/unitarios/vendedorController.test.js`

**Interfaces:**
- Produces: `PUT /api/vendedor/ventas/:id/envio` con `ENTREGADO` → `{ ok, msg, ventaEstado?: 'COMPLETADA' }`; con `CANCELADO` → `{ ok, msg?, reembolso?, pagoConfirmado? }`.

- [ ] **Step 1: Write the failing tests** (mismas 4 aserciones del Task 1, sobre `actualizarEnvioVenta` y la venta del propio vendedor vía `ventaDelVendedor`); además eliminar los tests de `actualizarEstadoVenta` (solo existen los de la suite; borrar los describes).
- [ ] **Step 2: Run** — `corepack pnpm --prefix backend exec vitest run vendedorController` → FAIL.
- [ ] **Step 3: Implement**: duplicar en `actualizarEnvioVenta` la lógica del Task 1 (después del `UPDATE ENVIOS`: ENTREGADO→COMPLETADA si venta CONFIRMADA con `notificarCambioEstado(id,'venta','COMPLETADA')`; CANCELADO→`cancelarVentaYReembolsar({ idVenta, canceladaPor: 'TIENDA' })` + respuesta de reembolso). Si el Task 1 extrajo un helper, extraerlo a `backend/utils/estadoPedido.js` (`aplicarTransicionPorEnvio(idVenta, estadoEnvio)`) y usarlo en ambos controllers — decisión del implementador, pero sin duplicar la lógica.
- [ ] **Step 4: Run** — suite completa backend `corepack pnpm --prefix backend test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(vendedor): estado de venta automático y fin del select manual"`.

### Task 4: Backend — granularidad en Excel/PDF y limpieza de `reporteDatos`

**Files:**
- Modify: `backend/utils/reporteDatos.js` (`obtenerDatosReporte(query)` acepta `granularidad`; reutilizar `granularidadValida`/agrupación de `backend/utils/agrupacionVentas.js`; corregir el bucle con cursor mutado — reasignar fecha como ya hace `adminController.js`)
- Modify: `backend/utils/reporteExcel.js`, `backend/utils/reportePdf.js` (etiquetas y serie respetan la granularidad recibida)
- Modify: `backend/controllers/adminController.js` (`descargarReporteExcel`/`descargarReportePdf` pasan `granularidad` del query a `obtenerDatosReporte`)
- Test: `tests/backend/unitarios/reportes-datos.test.js` (nuevo) + ajustar `tests/backend/unitarios/adminController.test.js:978` (`toHaveBeenCalledWith({})` → incluir `granularidad`)

**Interfaces:**
- Produces: `obtenerDatosReporte({ desde, hasta, granularidad = 'dia' })` — inválida → `'dia'` (misma regla que `reporteVentas`); `d.serie` con `{ dia, ingresos, ordenes, unidades }` agrupada según granularidad (semana = lunes).

- [ ] **Step 1: Write the failing tests**: `granularidad 'semana'` agrupa la serie por semana con etiqueta de lunes; `granularidad 'mes'`/`'anio'` ídem; inválida cae a día; el bucle de relleno de huecos no muta el cursor (probar con rango > 1 mes en día).
- [ ] **Step 2: Run** — `corepack pnpm --prefix backend exec vitest run reportes-datos` → FAIL.
- [ ] **Step 3: Implement**: importar la utilería de agrupación ya existente (la usada por `reporteVentas`) y eliminar cualquier duplicación de agrupación dentro de `reporteDatos.js`.
- [ ] **Step 4: Run** — suite backend completa → PASS (ajustar el test de adminController que pina `{}`).
- [ ] **Step 5: Commit** — `git commit -m "feat(reportes): Excel y PDF respetan la granularidad del panel"`.

### Task 5: Backend — Excel con dataBar limpio y PDF sin hojas en blanco

**Files:**
- Modify: `backend/utils/reporteExcel.js` (hoja `Graficas`, líneas ~196-271)
- Modify: `backend/utils/reportePdf.js` (refactor exportable + saltos de página condicionales)
- Test: `tests/backend/unitarios/reporteExcel.test.js` (nuevo), `tests/backend/unitarios/reportePdf.test.js` (nuevo)

**Interfaces:**
- Produces: `reportePdf.construirReportePdf(doc, datos)` (síncrono, dibuja todo; usado por `generarReportePdf` que sigue existiendo con la misma firma async → Buffer). Ambos archivos siguen excluidos de cobertura (presentación) — los tests existen para pincer el comportamiento, no para el ratchet.

- [ ] **Step 1: Write the failing tests**:

```js
// reporteExcel.test.js
// - la hoja 'Graficas' NO contiene fórmulas REPT (cell.formula incluye 'REPT' → falla)
// - la columna de ingresos SÍ tiene regla dataBar (conditionalFormattings del worksheet)
// - con serie vacía el workbook se genera sin lanzar

// reportePdf.test.js
// - datos vacíos (serie [], masVendidos [], usuarios [], vendedores []) → doc.pages.length === 1
// - datos normales → pages.length >= 1 y SIN página totalmente vacía:
//   después de construir, cada página tiene al menos un contenido (usar doc.pages y
//   comprobar que ninguna página nace de un addPage inmediatamente seguido de otro addPage)
```

- [ ] **Step 2: Run** — `corepack pnpm --prefix backend exec vitest run reporteExcel reportePdf` → FAIL.
- [ ] **Step 3: Implement**:
  - Excel: en `Graficas` eliminar las columnas de fórmulas `REPT("|"…)`/`REPT("▮"…)`; dejar la columna de valores con su `dataBar` (ya existen las reglas en líneas 230-233 y 264-266); ajustar anchos de columna y cabeceras para que la hoja se lea sola.
  - PDF: extraer el cuerpo a `construirReportePdf(doc, d)`; cada `doc.addPage()` se hace **solo si hay contenido que dibujar** en la sección siguiente (hoy la línea 195 añade página aunque `masVendidos` esté vacío; revisar también 202, 178 y los saltos del resto del archivo — auditoría completa de las secciones Resto: usuarios, vendedores, pie con numeración).
- [ ] **Step 4: Run** — PASS; revisión manual rápida: `node -e "require('./backend/utils/reportePdf').generarReportePdf({desde:'2026-01-01',hasta:'2026-01-07',granularidad:'dia'}).then(b=>console.log('bytes',b.length))"` con la BD local si está disponible (opcional, si falla la conexión no bloquea: los tests ya cubren).
- [ ] **Step 5: Commit** — `git commit -m "fix(reportes): gráficas del Excel con dataBar nativo y PDF sin hojas en blanco"`.

### Task 6: Backend — carpeta `jadda/banners` para imágenes nuevas

**Files:**
- Modify: `backend/controllers/imagenController.js` (`subirImagenes`, ramas de carpeta: línea 88 `carpetaCloud` y bloque local 50-85/126-133)
- Test: `tests/backend/unitarios/imagenController.test.js`

**Interfaces:**
- Consumes: `carpetaSegura(...partes)` de `backend/utils/cloudinary.js` (prefija `jadda/`), `subirBuffer(buffer, { folder, resource_type })`.
- Produces: `POST /api/productos/imagenes` acepta `tipo?: 'banner'` en el body; `tipo` ausente = productos (comportamiento de hoy intacto); `tipo: 'banner'` → Cloudinary folder `jadda/banners`, fallback local `uploads/Banners/<ts>-<hex>.<ext>` → URL `/images/productos/Banners/...`.

- [ ] **Step 1: Write the failing tests**: `tipo:'banner'` captura `folder === 'jadda/banners'` en el mock de `subirBuffer`; fallback local escribe en `Banners` y la URL devuelta empieza con `/images/productos/Banners/`; `tipo:'otro'` → 400 con mensaje claro.
- [ ] **Step 2: Run** — `corepack pnpm --prefix backend exec vitest run imagenController` → FAIL.
- [ ] **Step 3: Implement**: validar `tipo` al inicio (`if (tipo && tipo !== 'banner') return 400`); con `tipo==='banner'`: `carpetaCloud = carpetaSegura('banners')` y `dir = path.join(UPLOAD_DIR, '..', 'Banners')`, `prefijo = 'Banners'` (sin `idProducto`; banners nunca lo mandan).
- [ ] **Step 4: Run** — PASS + suite backend completa verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(imagenes): los banners suben a su propia carpeta en Cloudinary"`.

### Task 7: Frontend — `SubirImagenes` sin URL pegada

**Files:**
- Modify: `frontend/src/admin/SubirImagenes.tsx` (quitar estado `urlPegada`, función `agregarUrlPegada`, la fila del input con `FaLink` — líneas 57-73 y 158-172 — y el import de `FaLink`)
- Test: `tests/frontend/admin/SubirImagenes.test.tsx`

- [ ] **Step 1: Update the tests**: eliminar los tests del input de URL; conservar/añadir uno que confirme que ya NO se renderiza un input de texto ("Solo se aceptan URLs…" tampoco existe).
- [ ] **Step 2: Run** — `corepack pnpm --prefix frontend exec vitest run SubirImagenes` → FAIL (quedan tests de URL) → implementar → PASS.
- [ ] **Step 3: Implement**: borrar las piezas listadas; el componente queda con el botón de archivos, miniaturas, flechas y quitar.
- [ ] **Step 4: Run** — PASS + `corepack pnpm --prefix frontend test` verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): la subida de imágenes queda solo por archivos del PC"`.

### Task 8: Frontend — `ModalBanners` sube con `tipo: "banner"`

**Files:**
- Modify: `frontend/src/components/ModalBanners.tsx` (`subirArchivo`, línea 143-148: añadir `tipo: "banner"` al body)
- Test: `tests/frontend/components/ModalBanners.test.tsx` (nuevo, patrón MSW de `tests/frontend/msw-handlers.ts`)

- [ ] **Step 1: Write the failing test**: al subir un archivo, el `POST /api/productos/imagenes` recibe body con `tipo: "banner"` (capturar con handler MSW o mock de fetch).
- [ ] **Step 2: Run** — `corepack pnpm --prefix frontend exec vitest run ModalBanners` → FAIL.
- [ ] **Step 3: Implement** (una línea) → **Step 4: Run** PASS → **Step 5: Commit** — `git commit -m "feat(banners): la subida del banner va a la carpeta de banners"`.

### Task 9: Frontend — Órdenes: cards KPI activas + badge de estado de solo lectura

**Files:**
- Modify: `frontend/src/admin/AdminOrdenes.tsx` (función `filtrarOrdenes` líneas 57-76, `cambiarEstado` 191-215, `kpiCards` 261-267, select de estado 424-434, `cambiarEstadoEnvio` success handler 241-248)
- Test: `tests/frontend/admin/AdminOrdenes.test.tsx`

**Interfaces:**
- Consumes: backend del Task 1 (`/envio` puede responder `reembolso`/`msg`/`ventaEstado`).
- Produces: semántica de cards: **Pendientes** = `filtroVenta "PENDIENTE_PAGO,PENDIENTE"` · **En camino** = `filtroEnvio "EN_CAMINO"` · **Entregadas** = `filtroEnvio "ENTREGADO"` · **Canceladas** = `filtroVenta "CANCELADA"` · **Total** limpia ambos. `filtrarOrdenes` acepta lista separada por comas en `filtroVenta` (`filtroVenta.split(',').includes(o.ESTADO)`).

- [ ] **Step 1: Write the failing tests**:

```tsx
// - click en "Pendientes" marca la card con clase activa (aria-pressed o clase 'activa')
//   y la tabla muestra solo órdenes con ESTADO PENDIENTE_PAGO o PENDIENTE
// - click de nuevo desactiva y vuelve a mostrar todo
// - click en "Entregadas" deja ABIERTO el grupo que tiene resultados (Procesadas)
//   y cierra el otro
// - el detalle de la orden ya no tiene <select> de estado; muestra el estado como badge
// - "Cancelar envío" con respuesta { reembolso } muestra Swal con data.msg
```

- [ ] **Step 2: Run** — `corepack pnpm --prefix frontend exec vitest run AdminOrdenes` → FAIL.
- [ ] **Step 3: Implement**:
  - `filtrarOrdenes` con lista por comas; `kpiCards` obtienen `activo` derivado de `filtroVenta/filtroEnvio` y `aria-pressed` + clase `activa` (CSS ya tiene `:hover`; añadir `.ao-kpi.activa { border-color:#e73737; box-shadow:… }` en `frontend/src/css/adminDashboard.css` junto a `.ao-kpi`).
  - Al click en una card: aplicar filtro y fijar `grupos` para que el grupo con resultados quede abierto (`sinProcesar: sinProcesar.length>0, procesadas: procesadas.length>0`) — después del re-render.
  - Quitar `cambiarEstado` y el select; el estado se pinta `<span className={`ao-badge-venta ${claseVenta(orden.ESTADO)}`}>{orden.ESTADO}</span>` en el bloque `ao-detalle-acciones` (misma clase que la columna de la tabla).
  - En `cambiarEstadoEnvio`: si `data.reembolso` → Swal de éxito con `data.msg` (copiar el patrón que tenía `cambiarEstado`), si no el toast actual.
- [ ] **Step 4: Run** — PASS + suite frontend verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): cards de órdenes que filtran de verdad y estado de pago de solo lectura"`.

### Task 10: Frontend — `VendedorVentas` sin select (paridad visual con admin)

**Files:**
- Modify: `frontend/src/vendedor/VendedorVentas.tsx` (select de estado líneas 253-264 → badge de solo lectura; quitar `cambiarEstadoVenta` y `estadosVenta`)
- Test: `tests/frontend/vendedor/VendedorVentas.test.tsx` (nuevo)

- [ ] **Step 1: Write the failing test**: renderiza el detalle de una venta con `ESTADO: 'CONFIRMADA'` → existe `<span>` con la clase `ao-badge-venta` y el texto del estado; NO existe `select`; el botón "Cancelar envío" sigue presente.
- [ ] **Step 2: Run** — FAIL → **Step 3: Implement**: reemplazar el bloque `ao-accion-estado` por el badge (copiar las clases `ao-badge-venta` + helper `claseVenta` — duplicar el pequeño helper local, como ya reutiliza las clases `ao-*` del CSS compartido; conservar "Cancelar envío"). **Step 4: Run** PASS → **Step 5: Commit** — `git commit -m "feat(vendedor): estado de venta de solo lectura como en admin"`.

### Task 11: Frontend — página de usuario `/admin/usuarios/:id`

**Files:**
- Create: `frontend/src/admin/DetalleUsuarioAdmin.tsx`
- Modify: `frontend/src/admin/AdminUsuarios.tsx` (quitar modal + `verUsuario`; botón "Ver usuario" → `navigate('/admin/usuarios/' + id)`), `frontend/src/App.tsx` (lazy import + ruta `<Route path="/admin/usuarios/:id" …/>` después de `/admin/usuarios`)
- Create test: `tests/frontend/admin/DetalleUsuarioAdmin.test.tsx`; Modify: `tests/frontend/admin/AdminUsuarios.test.tsx`, `tests/frontend/msw-handlers-admin.ts`

**Interfaces:**
- Consumes: `GET /api/admin/usuarios/:id` → `{ usuario, direcciones, metodos, stats, vendedor, ventas, compras, retos }` (EXISTS ya; forma documentada en el spec). Patrón de header idéntico al resto: `admin-volver` + `Breadcrumb [Dashboard, Usuarios]` + `au-titulos`.

- [ ] **Step 1: Write the failing test** para la página nueva (portar las aserciones de contenido del modal de `AdminUsuarios.test.tsx`: hero con nombre/rol, stats según rol, secciones compras/retos/empresa/ventas/direcciones/métodos) + test en `AdminUsuarios.test.tsx`: click en "Ver usuario" navega a `/admin/usuarios/5` (assert con `memoryRouter`/location o mock).
- [ ] **Step 2: Run** — `corepack pnpm --prefix frontend exec vitest run DetalleUsuarioAdmin AdminUsuarios` → FAIL.
- [ ] **Step 3: Implement**: mover el JSX y la lógica de fetch del modal (AdminUsuarios líneas del modal de detalle) al componente página, envuelto en `admin-page` + `AdminNavbar` + `AdminFooter` + `container` + header estándar; en AdminUsuarios el botón pasa a navegación.
- [ ] **Step 4: Run** — PASS + suite frontend verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): ficha de usuario en página completa en vez de modal"`.

### Task 12: Frontend — página de evidencia `/admin/retos/:id`

**Files:**
- Create: `frontend/src/admin/DetalleEvidenciaAdmin.tsx`
- Modify: `frontend/src/admin/AdminRetos.tsx` (quitar modal `ver`; botón "Ver" → `navigate('/admin/retos/' + evidencia.ID_EVIDENCIA)`; tras aprobar/rechazar refrescar lista), `frontend/src/App.tsx`
- Tests: create `tests/frontend/admin/DetalleEvidenciaAdmin.test.tsx`; modify `tests/frontend/admin/AdminRetos.test.tsx`, `tests/frontend/msw-handlers-admin.ts` (añadir `GET /api/retos/admin/evidencias/:id`)

**Interfaces:**
- Consumes: `GET /api/retos/admin/evidencias/:id` (nuevo del backend — ver Step 0) → misma forma que un elemento de la lista (`ID_EVIDENCIA, TIPO, RUTA, RUTAS_EXTRA, CANTIDAD, ESTADO, OBSERVACION, FECHA_SUBIDA, ID_RETO_USUARIO, USUARIO_*, RETO_TITULO, RETO_DESCRIPCION, PROGRESO, META_VALOR, META_TIPO`); `POST /api/retos/admin/evidencias/:id/aprobar|rechazar` (existentes).
- Produces (Step 0, backend): route en `backend/routes/retoRoutes.js` `GET /admin/evidencias/:id` (tras `esAdmin`) + handler en `backend/controllers/retoController.js` (`obtenerEvidenciaPorId`, misma consulta que la lista con `WHERE ID_EVIDENCIA = ?`, 404 si no existe) + test en `tests/backend/unitarios/retoController.test.js`.

- [ ] **Step 0 (backend): Write failing test → implement → PASS → commit** `git commit -m "feat(retos): endpoint de evidencia individual para admin"` (mismo ciclo TDD en 3 pasos: test `obtenerEvidenciaPorId devuelve la evidencia 404 si no existe`).
- [ ] **Step 1: Write the failing tests** de la página: renderiza título del reto, usuario, estado, progreso/meta, grid de material (1 imagen / varias / video según extensión `.mp4|.webm|.mov`, portando la clasificación actual del modal), observación, y botones "Aprobar avance"/"Rechazar" SOLO si `ESTADO === 'pendiente'`; aprobar con observación opcional → vuelve al listado con toast (navega a `/admin/retos`). Test de AdminRetos: "Ver" navega a `/admin/retos/:id`.
- [ ] **Step 2: Run** — FAIL → **Step 3: Implement** (extraer el JSX del modal actual; header estándar; acciones reutilizan `revisar()` existente). **Step 4: Run** PASS → **Step 5: Commit** — `git commit -m "feat(admin): revisión de evidencia de reto en página completa"`.

### Task 13: Frontend — página de vendedor `/admin/vendedores/:id` ("Gestionar" → "Ver más")

**Files:**
- Create: `frontend/src/admin/DetalleVendedorAdmin.tsx`
- Modify: `frontend/src/admin/AdminVendedores.tsx` (quitar modal; botón "Gestionar" pasa a "Ver más" y navega), `frontend/src/App.tsx`
- Tests: create `tests/frontend/admin/DetalleVendedorAdmin.test.tsx`; modify `tests/frontend/admin/AdminVendedores.test.tsx`, `tests/frontend/msw-handlers-admin.ts`
- Backend Step 0 (igual que Task 12): create `GET /api/vendedor/admin/:id` en `backend/routes/vendedorRoutes.js` + `backend/controllers/vendedorController.js` (`obtenerSolicitudAdmin`) + test en `tests/backend/unitarios/vendedorController.test.js`

**Interfaces:**
- Produces (backend): `GET /api/vendedor/admin/:id` (esAdmin) → `{ solicitud, productos, resenas, metricas }`:
  - `solicitud`: la fila de `SOLICITUDES_VENDEDOR` + datos del solicitante (misma forma que un elemento de `GET /api/vendedor/admin`).
  - `productos`: `SELECT … FROM PRODUCTOS WHERE ID_VENDEDOR = ?` (imagen, nombre, categoría, ESTADO_PUBLICACION, stock, precio, marca) — filtrado EN SQL, no en cliente.
  - `resenas`: `SELECT r.ID_RESENA, r.CALIFICACION, r.COMENTARIO, r.FECHA_RESENA, p.NOMBRE AS PRODUCTO FROM RESENAS r JOIN PRODUCTOS p ON p.ID = r.ID_PRODUCTO WHERE p.ID_VENDEDOR = ? ORDER BY r.FECHA_RESENA DESC LIMIT 50` (ajustar nombres de columnas al schema real de RESENAS en `backend/database/setup.js`).
  - `metricas`: `{ publicados, pendientes, unidadesVendidas, totalIngresos }` del vendedor.
- Consumes (frontend): ese endpoint + `POST /api/vendedor/admin/:id/procesar` (existente; rechazo con observación obligatoria ≤500).

- [ ] **Step 0 (backend): TDD** — test: devuelve la solicitud 404 si no existe; productos del vendedor correcto; reseñas solo de SUS productos; commit `git commit -m "feat(vendedor): detalle de solicitud con productos y reseñas para admin"`.
- [ ] **Step 1: Write the failing tests** de la página: hero de la solicitud (empresa, representante, estado), sección empresa/ubicación, si `VENDEDOR_ID`: tabla de productos + lista de reseñas + métricas; si `ESTADO==='PENDIENTE'`: botones aprobar / rechazar (Swal con textarea obligatoria). Test en AdminVendedores: el botón dice "Ver más" y navega.
- [ ] **Step 2: Run** — FAIL → **Step 3: Implement** (header estándar; aprobar/rechazar reutiliza `procesar()`). **Step 4: Run** PASS → **Step 5: Commit** — `git commit -m "feat(admin): ficha de vendedor en página completa (Ver más)"`.

### Task 14: Eliminar la página de Categorías (conservar POST inline)

**Files:**
- Delete: `frontend/src/admin/AdminCategorias.tsx`, `tests/frontend/admin/AdminCategorias.test.tsx`
- Modify: `frontend/src/App.tsx` (quitar ruta + lazy import), `frontend/src/admin/AdminNavbar.tsx` (quitar el tab), `backend/routes/productoRoutes.js` (quitar SOLO `PUT /categorias/:id` y `DELETE /categorias/:id` — las líneas 58-59), `backend/controllers/productoController.js` (quitar `actualizarCategoria` y `eliminarCategoria` + exports; **conservar** `crearCategoria` y su `POST`)
- Test: `tests/backend/unitarios/productoController.test.js` (quitar los describes de actualizar/eliminar categoría; mantener el de crear)

- [ ] **Step 1: Quitar tests** de actualizar/eliminar categoría → **Step 2: Implement** las eliminaciones → **Step 3: Run** backend + frontend verdes; `grep -r "AdminCategorias" frontend/src` sin resultados; `grep "categorias" backend/routes/productoRoutes.js` muestra solo GET y POST.
- [ ] **Step 4: Commit** — `git commit -m "feat(admin): fuera la página de categorías (queda la creación inline en productos)"`.

### Task 15: Eliminar la página de Chats — el widget flotante lo cubre todo

**Files:**
- Delete: `frontend/src/pages/Chats.tsx`
- Modify: `frontend/src/App.tsx` (rutas `/chats`, `/admin/chats`, `/vendedor/chats` + lazy import + `esPaginaChats` línea 116 + condición del widget 146), `frontend/src/admin/AdminNavbar.tsx` (tab chats + campo `chats` del estado `pendientes`), `frontend/src/vendedor/VendedorNavbar.tsx` (entrada Chats), `frontend/src/components/Navbar.tsx` (badge de chats → abre widget con `useChatWidget` en vez de navegar a `/chats`), `frontend/src/context/ChatWidgetContext.tsx` (+ `abrirChatPorId`), `frontend/src/components/BellNotificaciones.tsx` (`alClic` intercepta rutas de chat), `frontend/src/admin/AdminDevoluciones.tsx` (línea ~338: `abrirChatPorId` en vez de `navigate('/admin/chats?chat=…')`), `backend/controllers/adminController.js` (`obtenerPendientes`: quitar el query de chats y el campo del response)
- Tests: modify `tests/frontend/{AdminNavbar,Navbar,BellNotificaciones,ChatWidgetContext,ChatWidgetContext.extra,FloatingChat}.test.tsx`, `tests/frontend/admin/AdminDevoluciones.test.tsx`, `tests/frontend/msw-handlers-admin.ts` (pendientes sin `chats`); add casos nuevos (abajo)

**Interfaces:**
- Consumes: `GET /api/chat/:id/mensajes` ya carga por `activeChatId` (ChatWidget línea 91-95) → `abrirChatPorId(id: number)` = `setActiveChatId(id); setIsOpen(true);` en el contexto.
- Produces: `useChatWidget().abrirChatPorId(idChat: number) => void` (nueva firma en `ChatWidgetContextType`).
- Regla de intercepción en `BellNotificaciones.alClic`: si `n.RUTA` matchea `/^\/(admin|vendedor)?\/?chats\?chat=(\d+)/` → `abrirChatPorId(Number(id))` y NO navegar (cubre datos viejos guardados con esas rutas; `rutaSegunDestinatario` del backend NO se cambia).

- [ ] **Step 1: Write the failing tests**: ChatWidgetContext — `abrirChatPorId(7)` deja `activeChatId=7` e `isOpen=true`; BellNotificaciones — notificación con `RUTA: '/admin/chats?chat=7'` al clic llama `abrirChatPorId(7)` y NO `navigate` (mock de useNavigate); AdminNavbar — la entrada "Chats" ya no existe y el badge de chats desapareció; Navbar — el badge de chats abre el widget.
- [ ] **Step 2: Run** — FAIL → **Step 3: Implement** todas las modificaciones (borrar página, rutas, entradas, `esPaginaChats`, chats de `pendientes`, añadir `abrirChatPorId` e intercepción).
- [ ] **Step 4: Run** — `corepack pnpm --prefix frontend test` + backend suite verdes; `grep -r "chats" frontend/src/App.tsx` sin rutas de página.
- [ ] **Step 5: Commit** — `git commit -m "feat(chats): solo widget flotante; fuera la página de chats"`.

### Task 16: Badges del sidebar veraces y que desaparecen al entrar

**Files:**
- Modify: `frontend/src/admin/AdminNavbar.tsx` (ocultar badge de la sección actual; refetch por evento + intervalo 60 s), `frontend/src/admin/AdminProductos.tsx` (auto-filtro "Por revisar" al entrar con pendientes; despachar evento tras aprobar/rechazar), `frontend/src/admin/AdminRetos.tsx`, `frontend/src/admin/AdminVendedores.tsx`, `frontend/src/admin/AdminDevoluciones.tsx` (despachar el evento tras sus acciones de moderación)
- Tests: modify `tests/frontend/admin/AdminNavbar.test.tsx`, `tests/frontend/admin/AdminProductos.test.tsx`

**Interfaces:**
- Produces: evento global `window.dispatchEvent(new Event("jadda:pendientes"))` (nombre fijo) tras cada acción de moderación; AdminNavbar escucha y refetch de `GET /api/admin/pendientes`.
- Regla de visualización: `seccionActual` derivada de `location.pathname` (productos/retos/devoluciones/vendedores); el badge de `seccionActual` se pinta como 0.

- [ ] **Step 1: Write the failing tests**:
  - AdminNavbar montado en `/admin/productos` con `pendientes.productos=2` (mock del fetch) → el link de Productos NO muestra badge; Retos sí muestra el suyo si >0.
  - AdminNavbar responde al evento `jadda:pendientes` refetchando (fetch spy con contador).
  - AdminProductos: carga con `porRevisar>0` → el filtro "Por revisar" queda activo automáticamente (el fetch de productos ya existe; activar tras la primera carga si `porRevisar > 0 && !filtroEstado`); tras aprobar un producto se despacha el evento (spy en `window.dispatchEvent`).
- [ ] **Step 2: Run** — FAIL → **Step 3: Implement**.
- [ ] **Step 4: Run** — PASS + suite verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): badges del sidebar solo con pendientes reales y ocultos en la sección actual"`.

### Task 17: Panel de notificaciones que cabe en la pantalla

**Files:**
- Modify: `frontend/src/css/Navbar.css` (bloques `.bell-container.oscuro .bell-panel` líneas 715-745)

- [ ] **Step 1: Implement** (CSS puro): en `≤992px` el panel oscuro pasa a `position: fixed; top: 64px; right: 12px; left: auto;` con `width: min(360px, calc(100vw - 24px));` y `max-height: calc(100dvh - 80px);` (fallback `100vh` en línea anterior); en desktop (≥993px) mantener el anclaje actual pero añadir `max-height: calc(100dvh - 90px);` al panel oscuro. El scroll interno ya existe (`bell-panel-body`).
- [ ] **Step 2: Run** — `corepack pnpm --prefix frontend lint && corepack pnpm --prefix frontend test` verdes (CSS no es testeable en jsdom: verificación visual en el paso 3).
- [ ] **Step 3: Verificación visual**: `docker compose up -d` (si no corre), entrar a `/admin`, abrir la campana con 5+ notificaciones a 768px y a 1280px de ancho: nada cortado, scroll interno funciona.
- [ ] **Step 4: Commit** — `git commit -m "fix(admin): panel de notificaciones siempre dentro de la pantalla"`.

### Task 18: AdminReportes con look del Dashboard + granularidad en descargas

**Files:**
- Modify: `frontend/src/admin/AdminReportes.tsx` (KPIs → clases `adm-kpi-row`/`adm-chart-card` de AdminDashboard; toolbar → `ap-toolbar`/`ap-search`/`ap-filtro`; tabs con el estilo del panel; paleta `#002244`/`#e73737` en vez de `#6f42c1`), `frontend/src/utils/reportes.tsx` (`descargarReporte` añade `granularidad`)
- Tests: modify `tests/frontend/admin/AdminReportes.test.tsx`, `tests/frontend/reportes.test.tsx`

**Interfaces:**
- Consumes: `obtenerDatosReporte({ desde, hasta, granularidad })` del Task 4; helper `descargarReporte()` existente en `frontend/src/utils/reportes.tsx` (extender su firma con `granularidad: string` y añadir `&granularidad=` a la URL).

- [ ] **Step 1: Write the failing tests**: reportes.test.tsx — `descargarReporte` incluye `granularidad=semana` en la URL del blob fetch; AdminReportes.test.tsx — al pulsar "Excel" se llama con la granularidad del estado; los KPIs renderizan con las clases del Dashboard (assert de clase `adm-kpi` presente) y no queda `#6f42c1` en el archivo.
- [ ] **Step 2: Run** — FAIL → **Step 3: Implement** (reemplazar estilos Bootstrap ad-hoc por las clases existentes; conservar filtros y botones Excel/PDF dentro de la `ap-toolbar`).
- [ ] **Step 4: Run** — PASS + suite verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): reportes con la identidad visual del dashboard"`.

### Task 19: Consistencia visual de todas las páginas admin

**Files:**
- Modify: `frontend/src/admin/{AdminOrdenes,AdminUsuarios,AdminRetos,AdminVendedores,AdminDevoluciones,AdminReportes,EditarProductoAdmin,DetalleUsuarioAdmin,DetalleEvidenciaAdmin,DetalleVendedorAdmin}.tsx` — normalizar: `<div className="admin-page"> <AdminNavbar/> <div className="admin-content"> <div className="container">` (SIN `maxWidth` inline; quitar los 1280/1200 actuales) y el header en el orden exacto: `admin-volver` → `Breadcrumb` → `au-titulos` (h1+p). Dashboard queda como está (referencia). `AdminProductos` conserva su dual view interna pero el contenedor/header se normalizan igual.

- [ ] **Step 1: Implement** la normalización (editar wrappers y quitar overrides).
- [ ] **Step 2: Verify**: `grep -rn "maxWidth" frontend/src/admin` → solo ocurrencias justificadas (documentar cada una en el commit si alguna queda); `corepack pnpm --prefix frontend test` verde; checklist visual recorriendo las 10 páginas (mismo header, mismo ancho, mismas posiciones de toolbar).
- [ ] **Step 3: Commit** — `git commit -m "feat(admin): estructura idéntica en todas las pantallas del panel"`.

### Task 20: Verificación final del branch

- [ ] **Step 1: Suite completa**: `corepack pnpm --prefix backend test` (unit) y `corepack pnpm --prefix frontend test`; `corepack pnpm --prefix frontend lint` y `corepack pnpm --prefix frontend build`; `corepack pnpm --prefix movil exec tsc --noEmit` (debe seguir pasando: móvil no se tocó). Si el entorno lo permite, correr el E2E smoke de `tests/e2e/smoke.spec.ts` (ver skill jadda-testing para el comando exacto).
- [ ] **Step 2: Cobertura**: `node backend/scripts/cobertura-combinada.mjs $env:COBERTURA_UMBRAL` (PowerShell: `$env:USE_CI_MYSQL='1'` para integración si se corre test:integration — NO correr integración contra producción).
- [ ] **Step 3: Fixups** de lo que quede rojo; commits individuales.
- [ ] **Step 4: Resumen** al humano: qué cambió por punto (1-14) y cómo probarlo.
