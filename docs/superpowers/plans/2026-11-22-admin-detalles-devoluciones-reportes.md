# Detalles admin, devoluciones y reportes con alcance — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir usuarios, vendedores y evidencias de retos en páginas propias, completar el detalle de compras/ventas, aplicar la visibilidad de devoluciones de tienda y añadir alcance (Todo/JADDA/tienda) a los reportes Excel/PDF.

**Architecture:** Se amplían los endpoints existentes sin romper sus contratos y se añaden cuatro endpoints admin pequeños (detalle de solicitud, evidencia individual, tiendas y resumen de reporte). Toda la semántica de ventas por alcance vive en `reporteDatos.js`, que alimenta Excel, PDF y el conteo del modal. En frontend se añaden tres páginas lazy bajo `AdminRoute`, un encabezado claro compartido y un modal de descarga; devoluciones sigue siendo modal.

**Tech Stack:** Node.js + Express 5 (CommonJS), MySQL (`mysql2`), ExcelJS, PDFKit, Vitest + MSW + Testing Library, React 19 + TypeScript + Vite, Bootstrap, SweetAlert2.

**Spec:** `docs/superpowers/specs/2026-11-20-admin-detalles-devoluciones-reportes-design.md`

## Global Constraints

- No hay cambios de esquema ni migraciones de base de datos.
- Identificadores, comentarios y documentación en español; respetar CommonJS en backend.
- Todos los endpoints nuevos son `esAdmin`. Rate limits: detalles 60/min, tiendas/resumen 60/min, descargas 20/min.
- Conservar campos actuales de respuestas (`TOTAL`, `ventas`, `stats.totalCompras`, etc.).
- “Todo el catálogo” usa `VENTAS.TOTAL` (incluye envío). “Solo JADDA” y “una tienda” usan `SUM(DETALLE_VENTAS.SUBTOTAL)` de sus líneas y **no** incluyen envío.
- Las órdenes `CANCELADA` se listan si tienen líneas del alcance, pero no suman ingresos, unidades, serie, ticket ni métricas de vendedores.
- Una sola fila por pedido en reportes; nunca sumar `VENTAS.TOTAL` por cada línea.
- Devoluciones de tienda: ocultas en `SOLICITADA`/`MAS_PRUEBAS`; visibles en `ESCALADA`/`APROBADA`/`RECHAZADA`. Las cerradas son solo lectura.
- Las páginas nuevas no usan `.au-modal-hero` ni el gradiente navy del dashboard.
- No se modifica la descarga de reportes del vendedor.
- En commits usar rutas explícitas; **nunca** `git add -A`.
- No publicar, desplegar, borrar datos ni reescribir historia.

## Review Focus

1. **Pedido mixto JADDA + tienda:** al elegir “Solo JADDA” o una tienda, el importe debe ser el subtotal de esas líneas (sin envío) y el “Total pedido” debe seguir mostrando el total completo. Cubierto por Task 6.
2. **Pedido cancelado con líneas del alcance:** aparece en la lista pero no altera conteo, ingresos, unidades, serie, top de productos ni vendedores. Cubierto por Task 6.
3. **Devolución de tienda aún gestionada por el vendedor:** no aparece en el listado admin, badge ni KPI; al escalar o cerrar sí aparece, y una cerrada no ofrece acciones. Cubierto por Task 1 y Task 13.
4. **Usuario vendedor que también compra:** sus compras no se resetean a cero y la actividad de vendedor se muestra aparte. Cubierto por Task 2 y Task 10.
5. **Etiqueta larga del sidebar y estados vacíos/sin envío:** “Devoluciones y reembolsos” no desborda; compra sin envío, solicitud pendiente sin tienda y evidencia sin material muestran un mensaje claro. Cubierto por Task 9, Task 10, Task 11, Task 12 y Task 13.

## File Structure

**Backend — crear**

- `backend/utils/devolucionesVisibilidad.js`: regla única de visibilidad admin.
- `backend/utils/alcanceReporte.js`: parseo, SQL y etiquetas del alcance.
- `backend/utils/reporteDatos.js` (modificar): pedidos por alcance, serie sin doble conteo y resumen.
- `backend/utils/reporteExcel.js`, `backend/utils/reportePdf.js` (modificar): notas, columna H y metadatos.

**Backend — modificar**

- `backend/controllers/adminController.js`: visibilidad, detalle de usuario, endpoints y descargas.
- `backend/controllers/devolucionController.js`: filtro de visibilidad y origen.
- `backend/controllers/vendedorController.js`: `obtenerSolicitudAdmin`.
- `backend/controllers/retoController.js`: `adminEvidenciaDetalle`.
- `backend/routes/adminRoutes.js`, `backend/routes/vendedorRoutes.js`, `backend/routes/retoRoutes.js`.

**Frontend — crear**

- `frontend/src/admin/EncabezadoDetalle.tsx`
- `frontend/src/admin/DetalleUsuarioAdmin.tsx`
- `frontend/src/admin/DetalleVendedorAdmin.tsx`
- `frontend/src/admin/DetalleEvidenciaAdmin.tsx`
- `frontend/src/admin/ModalDescargaReporte.tsx`

**Frontend — modificar**

- `frontend/src/App.tsx`, `frontend/src/admin/AdminUsuarios.tsx`, `AdminVendedores.tsx`, `AdminRetos.tsx`, `AdminDevoluciones.tsx`, `AdminReportes.tsx`, `AdminNavbar.tsx`, `AdminDashboard.tsx`.
- `frontend/src/utils/reportes.tsx`, `frontend/src/css/adminDashboard.css`.

**Pruebas — crear/actualizar**

- Backend: `tests/backend/utils/devolucionesVisibilidad.test.js`, `alcanceReporte.test.js`, `reporteDatos.test.js`, `reporteExcel.test.js`, `reportePdf.test.js`; unitarios de `adminController`, `devolucionController`, `vendedorController`, `retoController`.
- Frontend: nuevas suites de las cuatro páginas/modales y actualización de listados, navbar, dashboard, reportes y `tests/frontend/admin/msw-handlers-admin.ts`.

---

### Task 1: Visibilidad de devoluciones de tienda

**Files:**
- Create: `backend/utils/devolucionesVisibilidad.js`
- Modify: `backend/controllers/devolucionController.js:307-335`
- Modify: `backend/controllers/adminController.js:584-589, 645-647`
- Test: `tests/backend/utils/devolucionesVisibilidad.test.js`
- Test: `tests/backend/unitarios/devolucionController.test.js`
- Test: `tests/backend/unitarios/adminController.test.js`

**Interfaces:**
- Consumes: tablas existentes `DEVOLUCIONES d` y `PRODUCTOS p`.
- Produces:
  - `SQL_DEVOLUCION_VISIBLE_ADMIN: string` = `"(p.ID_VENDEDOR IS NULL OR d.ESTADO IN ('ESCALADA', 'APROBADA', 'RECHAZADA'))"`.
  - `esVisibleParaAdmin({ idVendedor, estado }): boolean`.
  - `GET /api/devoluciones/admin` añade `VENDEDOR_NOMBRE`.

- [ ] **Step 1: Escribir las pruebas de la regla y de las consultas**

En `tests/backend/utils/devolucionesVisibilidad.test.js`:

```js
const { esVisibleParaAdmin, SQL_DEVOLUCION_VISIBLE_ADMIN } =
  require('../../../backend/utils/devolucionesVisibilidad');

test('JADDA es visible en cualquier estado', () => {
  expect(esVisibleParaAdmin({ idVendedor: null, estado: 'SOLICITADA' })).toBe(true);
});

test('tienda oculta mientras la gestiona el vendedor', () => {
  expect(esVisibleParaAdmin({ idVendedor: 4, estado: 'SOLICITADA' })).toBe(false);
  expect(esVisibleParaAdmin({ idVendedor: 4, estado: 'MAS_PRUEBAS' })).toBe(false);
});

test('tienda visible al escalar o cerrar', () => {
  for (const estado of ['ESCALADA', 'APROBADA', 'RECHAZADA']) {
    expect(esVisibleParaAdmin({ idVendedor: 4, estado })).toBe(true);
  }
});

test('el SQL centraliza la misma regla', () => {
  expect(SQL_DEVOLUCION_VISIBLE_ADMIN)
    .toBe("(p.ID_VENDEDOR IS NULL OR d.ESTADO IN ('ESCALADA', 'APROBADA', 'RECHAZADA'))");
});
```

En `devolucionController.test.js`, añadir un caso que inyecte una BD falsa, llame `todas` y compruebe que el SQL contiene el filtro y que la fila devuelta conserva `VENDEDOR_NOMBRE`. En `adminController.test.js`, añadir aserciones al SQL de dashboard y pendientes: debe contener `JOIN PRODUCTOS p ON p.ID = d.ID_PRODUCTO` y `SQL_DEVOLUCION_VISIBLE_ADMIN`.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/utils/devolucionesVisibilidad.test.js ../tests/backend/unitarios/devolucionController.test.js ../tests/backend/unitarios/adminController.test.js`

Expected: FAIL porque el helper no existe y las consultas no tienen la condición.

- [ ] **Step 3: Implementar el helper y aplicarlo en las tres consultas**

Crear `devolucionesVisibilidad.js`:

```js
const ESTADOS_CERRADOS = ['APROBADA', 'RECHAZADA'];
const SQL_DEVOLUCION_VISIBLE_ADMIN =
  "(p.ID_VENDEDOR IS NULL OR d.ESTADO IN ('ESCALADA', 'APROBADA', 'RECHAZADA'))";

function esVisibleParaAdmin({ idVendedor, estado }) {
  return idVendedor == null || estado === 'ESCALADA' || ESTADOS_CERRADOS.includes(estado);
}

module.exports = { ESTADOS_CERRADOS, SQL_DEVOLUCION_VISIBLE_ADMIN, esVisibleParaAdmin };
```

En `devolucionController.todas`, importar el helper, añadir:

```sql
LEFT JOIN VENDEDORES vd ON p.ID_VENDEDOR = vd.ID_VENDEDOR
```

seleccionar `vd.NOMBRE_EMPRESA AS VENDEDOR_NOMBRE` y, antes del `ORDER BY`, `WHERE ${SQL_DEVOLUCION_VISIBLE_ADMIN}`.

En `adminController`, reemplazar las dos consultas de `devolucionesPend` por:

```sql
SELECT COUNT(*) AS devolucionesPend
FROM DEVOLUCIONES d
JOIN PRODUCTOS p ON p.ID = d.ID_PRODUCTO
WHERE d.ESTADO IN ('SOLICITADA', 'MAS_PRUEBAS', 'ESCALADA')
  AND ${SQL_DEVOLUCION_VISIBLE_ADMIN}
```

Mantener intacto el contador `chats` (`ESTADO = 'ESCALADA'`).

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/devolucionesVisibilidad.js backend/controllers/devolucionController.js backend/controllers/adminController.js tests/backend/utils/devolucionesVisibilidad.test.js tests/backend/unitarios/devolucionController.test.js tests/backend/unitarios/adminController.test.js
git commit -m "feat(admin): ocultar devoluciones de tienda en gestion"
```

---

### Task 2: Backend del detalle de usuario

**Files:**
- Modify: `backend/controllers/adminController.js:281-440`
- Test: `tests/backend/unitarios/adminController.test.js:467-575`

**Interfaces:**
- Consumes: `GET /api/admin/usuarios/:id` existente.
- Produces: respuesta ampliada:
  - `compras[].items`: `{ ID_VENTA, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL, NOMBRE, ID_VENDEDOR, VENDEDOR_NOMBRE, IMAGEN, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO }[]`.
  - `compras[].ENVIO_DIRECCION|ENVIO_CIUDAD|ENVIO_BARRIO|ENVIO_DEPARTAMENTO|ENVIO_CODIGO_POSTAL|ENVIO_TELEFONO`, `COSTO_ENVIO`, `TOTAL_PEDIDO`.
  - `vendedor.ID_SOLICITUD`.
  - `stats.totalCompras` y `stats.totalGastado` ya no se fuerzan a 0 para vendedores.

- [ ] **Step 1: Escribir la prueba del vendedor comprador**

Añadir a `adminController.test.js` un caso con rol 6 que devuelva:

- compra `ID_VENTA: 9`, `TOTAL: '150000'`, `TOTAL_PEDIDO: '150000'`, `ENVIO_CIUDAD: 'Cali'`, `COSTO_ENVIO: '9000'`, `TOTAL_ARTICULOS: '2'`;
- línea `CANTIDAD: 2`, `PRECIO_UNITARIO: '50000'`, `SUBTOTAL: '100000'`, `NOMBRE: 'Guayos'`, `ID_VENDEDOR: 4`, `VENDEDOR_NOMBRE: 'DeporteX'`.

Aserciones:

```js
expect(res.cuerpo.stats.totalCompras).toBe('2');
expect(res.cuerpo.stats.totalGastado).toBe('100000');
expect(res.cuerpo.stats.productosPublicados).toBe(5);
expect(res.cuerpo.vendedor.ID_SOLICITUD).toBe(3);
expect(res.cuerpo.compras[0].items[0]).toEqual(expect.objectContaining({
  NOMBRE: 'Guayos', CANTIDAD: 2, VENDEDOR_NOMBRE: 'DeporteX',
}));
expect(res.cuerpo.compras[0].ENVIO_CIUDAD).toBe('Cali');
expect(res.cuerpo.compras[0].TOTAL_PEDIDO).toBe(150000);
expect(res.cuerpo.compras[0].TOTAL_ARTICULOS).toBe(2);
```

Añadir además un caso sin compras que devuelva `compras: []` y no ejecute la consulta de líneas.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/unitarios/adminController.test.js`

Expected: FAIL por `items` ausente, `ID_SOLICITUD` ausente y compras reseteadas.

- [ ] **Step 3: Implementar la ampliación**

1. En la consulta de vendedor añadir `ID_SOLICITUD`.
2. Eliminar las líneas `stats.totalCompras = 0;` y `stats.totalGastado = 0;`.
3. En la consulta de compras:
   - cambiar el subselect de `TOTAL_ARTICULOS` a `(SELECT COALESCE(SUM(dv.CANTIDAD), 0) FROM DETALLE_VENTAS dv WHERE dv.ID_VENTA = v.ID_VENTA)`;
   - añadir `v.TOTAL AS TOTAL_PEDIDO`, `e.DIRECCION_ENVIO AS ENVIO_DIRECCION`, `e.BARRIO AS ENVIO_BARRIO`, `e.CIUDAD AS ENVIO_CIUDAD`, `e.DEPARTAMENTO AS ENVIO_DEPARTAMENTO`, `e.CODIGO_POSTAL AS ENVIO_CODIGO_POSTAL`, `e.TELEFONO_CONTACTO AS ENVIO_TELEFONO`, `e.COSTO_ENVIO`.
4. Si hay compras, consultar todas sus líneas en una sola consulta con placeholders:

```sql
SELECT dv.ID_VENTA, dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL,
       p.NOMBRE, p.ID_VENDEDOR, vd.NOMBRE_EMPRESA AS VENDEDOR_NOMBRE,
       pi.URL_IMAGEN AS IMAGEN, pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO
FROM DETALLE_VENTAS dv
JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
LEFT JOIN VENDEDORES vd ON p.ID_VENDEDOR = vd.ID_VENDEDOR
LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
WHERE dv.ID_VENTA IN (...)
ORDER BY dv.ID_VENTA DESC
```

5. Agrupar en un mapa por `ID_VENTA`; cada compra recibe `items`. Normalizar a número `TOTAL`, `TOTAL_PEDIDO`, `TOTAL_ARTICULOS` y `COSTO_ENVIO`.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/adminController.js tests/backend/unitarios/adminController.test.js
git commit -m "feat(admin): ampliar detalle de usuario con compras y envio"
```

---

### Task 3: Backend del detalle de vendedor

**Files:**
- Modify: `backend/controllers/vendedorController.js:314-331, 1282`
- Modify: `backend/routes/vendedorRoutes.js:33-35`
- Test: `tests/backend/unitarios/vendedorController.test.js`
- Test: `tests/backend/routes/vendedorRoutes.gates.test.js` (si ya valida rutas admin)

**Interfaces:**
- Produces: `GET /api/vendedor/admin/:id` (admin, 60/min), `id = ID_SOLICITUD`.
- Respuesta:
  - `solicitud`: fila de `SOLICITUDES_VENDEDOR` + `SOLICITANTE_NOMBRE`, `SOLICITANTE_EMAIL`, `SOLICITANTE_USUARIO`, `SOLICITANTE_TELEFONO`.
  - `vendedor`: fila de `VENDEDORES` o `null`.
  - `resumen`: `{ productosPublicados, unidadesVendidas, totalVentas, totalIngresos, ticketPromedio }` o `null`.
  - `productos`: máximo 100, ordenados por `unidades` descendente.
  - `ventasRecientes`: máximo 10, `IMPORTE` = suma de subtotales de esa tienda.
  - 404 `{ ok: false, msg: 'Solicitud no encontrada' }`.

- [ ] **Step 1: Escribir las pruebas 404, pendiente y aprobada**

En `vendedorController.test.js`, usando la BD falsa existente:

```js
test('detalle: solicitud inexistente → 404', async () => {
  vendedorController._useDb(dbFalso({ 'SELECT S.*, U.NOMBRE_USUARIO': [[]] }));
  const res = resFalsa();
  await vendedorController.obtenerSolicitudAdmin(req({ params: { id: '99' } }), res);
  expect(res.codigo).toBe(404);
  expect(res.cuerpo.msg).toBe('Solicitud no encontrada');
});

test('detalle: pendiente sin vendedor devuelve arreglos vacíos', async () => {
  vendedorController._useDb(dbFalso({
    'SELECT S.*, U.NOMBRE_USUARIO': [[{ ID_SOLICITUD: 5, ESTADO: 'PENDIENTE' }]],
    'SELECT V.ID_VENDEDOR': [[]],
  }));
  const res = resFalsa();
  await vendedorController.obtenerSolicitudAdmin(req({ params: { id: '5' } }), res);
  expect(res.cuerpo).toEqual(expect.objectContaining({
    vendedor: null, resumen: null, productos: [], ventasRecientes: [],
  }));
});
```

Para el caso aprobado, devolver un resumen con `unidadesVendidas: '7'`, `totalVentas: '3'`, `totalIngresos: '210000'`; un producto con `unidades: '4'`, `ingresos: '120000'`, `pedidos: '2'`; y una venta con `IMPORTE: '80000'`. Aserciones: métricas numéricas, `ticketPromedio` = 70000, producto y venta presentes.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/unitarios/vendedorController.test.js`

Expected: FAIL porque `obtenerSolicitudAdmin` no existe.

- [ ] **Step 3: Implementar el controlador y la ruta**

1. Añadir `const obtenerSolicitudAdmin = async (req, res) => { ... }`.
2. Consultar la solicitud con `LEFT JOIN USUARIOS u ON s.ID_USUARIO = u.ID_USUARIO`; si no existe, 404.
3. Consultar `VENDEDORES v LEFT JOIN USUARIOS u ON v.ID_USUARIO = u.ID_USUARIO WHERE v.ID_SOLICITUD = ?`.
4. Si no hay vendedor, responder con `resumen: null`, `productos: []`, `ventasRecientes: []`.
5. Si hay vendedor, calcular el resumen con subselects que excluyan `CANCELADA`; `ticketPromedio = totalVentas ? Math.round(totalIngresos / totalVentas) : 0`.
6. Productos: usar subselects para `STOCK` e imagen y `LEFT JOIN DETALLE_VENTAS/VENTAS` con `SUM(CASE WHEN v.ID_VENTA IS NOT NULL THEN ... ELSE 0 END)`; **no unir `PRODUCTO_VARIANTES` junto a `DETALLE_VENTAS` en la misma agregación** (multiplicaría filas). Agrupar por `p.ID, p.NOMBRE, p.PRECIO, p.ESTADO_PUBLICACION`, limitar a 100.
7. Ventas recientes: agrupar por pedido, filtrar `v.ESTADO <> 'CANCELADA'`, `SUM(dv.SUBTOTAL) AS IMPORTE`, ordenar por fecha descendente y limitar a 10.
8. Exportar `obtenerSolicitudAdmin` en el `module.exports` final.
9. En `vendedorRoutes.js`, antes de las rutas `/admin` existentes:

```js
router.get('/admin/:id', esAdmin, rateLimit({ max: 60 }), vendedorController.obtenerSolicitudAdmin);
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/vendedorController.js backend/routes/vendedorRoutes.js tests/backend/unitarios/vendedorController.test.js
git commit -m "feat(admin): agregar detalle de solicitud de vendedor"
```

---

### Task 4: Backend del detalle de evidencia

**Files:**
- Modify: `backend/controllers/retoController.js:391-410`
- Modify: `backend/routes/retoRoutes.js:104-107`
- Test: `tests/backend/unitarios/retoController.test.js`

**Interfaces:**
- Produces: `GET /api/retos/admin/evidencias/:id` (admin).
- Devuelve el mismo objeto que un elemento de `adminEvidencias`, incluidos `TIPO`, `RUTA`, `RUTAS_EXTRA`, `CANTIDAD`, `ESTADO`, `OBSERVACION`, `FECHA_SUBIDA`, datos del usuario, reto, `PROGRESO`, `META_VALOR`, `META_TIPO`.
- 404 `{ ok: false, msg: 'Evidencia no encontrada' }`.

- [ ] **Step 1: Escribir pruebas 200 y 404**

```js
test('detalle de evidencia 200', async () => {
  retoController._useDb(dbFalso({
    'SELECT E.ID_EVIDENCIA': [[{ ID_EVIDENCIA: 7, ESTADO: 'pendiente', RETO_TITULO: 'Reto 10K' }]],
  }));
  const res = resFalsa();
  await retoController.adminEvidenciaDetalle(req({ params: { id: '7' } }), res);
  expect(res.codigo).toBeNull();
  expect(res.cuerpo.RETO_TITULO).toBe('Reto 10K');
});

test('detalle de evidencia inexistente → 404', async () => {
  retoController._useDb(dbFalso({ 'SELECT E.ID_EVIDENCIA': [[]] }));
  const res = resFalsa();
  await retoController.adminEvidenciaDetalle(req({ params: { id: '404' } }), res);
  expect(res.codigo).toBe(404);
  expect(res.cuerpo).toEqual({ ok: false, msg: 'Evidencia no encontrada' });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/unitarios/retoController.test.js`

Expected: FAIL porque el handler no existe.

- [ ] **Step 3: Implementar el controlador y la ruta**

Extraer la lista de columnas y joins de `adminEvidencias` a una constante interna `SQL_EVIDENCIAS_ADMIN` (manteniendo el prefijo `SELECT e.ID_EVIDENCIA`) y reutilizarla:

```js
exports.adminEvidenciaDetalle = async (req, res) => {
  try {
    const [rows] = await db.query(
      `${SQL_EVIDENCIAS_ADMIN} WHERE e.ID_EVIDENCIA = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Evidencia no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) {
    logger.error('Error al obtener evidencia admin:', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener la evidencia' });
  }
};
```

En `retoRoutes.js`, después del listado admin y antes de los POST:

```js
router.get('/admin/evidencias/:id', esAdmin, rateLimit({ max: 60 }), retoController.adminEvidenciaDetalle);
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/retoController.js backend/routes/retoRoutes.js tests/backend/unitarios/retoController.test.js
git commit -m "feat(admin): agregar detalle de evidencia de reto"
```

---

### Task 5: Utilidad de alcance de reportes

**Files:**
- Create: `backend/utils/alcanceReporte.js`
- Test: `tests/backend/utils/alcanceReporte.test.js`

**Interfaces:**
- Produces:
  - `resolverAlcance(query = {})`: `{ tipo: 'todo'|'jadda'|'tienda', idVendedor: number|null, etiqueta: string, sufijo: string }` o `{ error: string, statusCode: 400 }`.
  - `condicionAlcance(alcance, alias = 'p')`: `{ sql: string, params: unknown[] }`.
  - `etiquetaAlcance(alcance, nombreTienda = null): string`.
  - `sufijoAlcance(alcance): string`.
- Default: `todo`, etiqueta `Todo el catálogo`, sufijo `todo`.
- `jadda`: `Solo JADDA`, sufijo `jadda`.
- `tienda`: `Tienda #<id>` hasta resolver el nombre; sufijo `tienda-<id>`.

- [ ] **Step 1: Escribir pruebas de parseo y SQL**

```js
const {
  resolverAlcance, condicionAlcance, etiquetaAlcance, sufijoAlcance,
} = require('../../../backend/utils/alcanceReporte');

test('default todo', () => {
  expect(resolverAlcance({})).toEqual({
    tipo: 'todo', idVendedor: null, etiqueta: 'Todo el catálogo', sufijo: 'todo',
  });
});

test('jadda y tienda válida', () => {
  expect(resolverAlcance({ alcance: 'jadda' }).sufijo).toBe('jadda');
  expect(resolverAlcance({ alcance: 'tienda', tienda: '7' })).toEqual({
    tipo: 'tienda', idVendedor: 7, etiqueta: 'Tienda #7', sufijo: 'tienda-7',
  });
});

test('alcance inválido o tienda sin id → 400', () => {
  expect(resolverAlcance({ alcance: 'otro' })).toEqual(expect.objectContaining({ statusCode: 400 }));
  expect(resolverAlcance({ alcance: 'tienda' })).toEqual(expect.objectContaining({ statusCode: 400 }));
  expect(resolverAlcance({ alcance: 'tienda', tienda: '0' })).toEqual(expect.objectContaining({ statusCode: 400 }));
  expect(resolverAlcance({ alcance: 'tienda', tienda: 'abc' })).toEqual(expect.objectContaining({ statusCode: 400 }));
});

test('fragmento SQL y etiquetas', () => {
  const todo = resolverAlcance({});
  expect(condicionAlcance(todo)).toEqual({ sql: '1=1', params: [] });
  expect(condicionAlcance(resolverAlcance({ alcance: 'jadda' }))).toEqual({
    sql: 'p.ID_VENDEDOR IS NULL', params: [],
  });
  const tienda = resolverAlcance({ alcance: 'tienda', tienda: '7' });
  expect(condicionAlcance(tienda, 'v')).toEqual({ sql: 'v.ID_VENDEDOR = ?', params: [7] });
  expect(etiquetaAlcance(tienda, 'DeporteX')).toBe('Tienda: DeporteX');
  expect(sufijoAlcance(tienda)).toBe('tienda-7');
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/utils/alcanceReporte.test.js`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar la utilidad**

Validar `alcance` contra `['todo', 'jadda', 'tienda']`. Para `tienda`, exigir `/^\d+$/` y entero mayor que 0. `condicionAlcance` solo acepta alias `p` o `v` y devuelve las tres variantes exactas. No interpolar valores de usuario en SQL.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/alcanceReporte.js tests/backend/utils/alcanceReporte.test.js
git commit -m "feat(reportes): agregar resolucion de alcance"
```

---

### Task 6: Datos de reporte por alcance y resumen

**Files:**
- Modify: `backend/utils/reporteDatos.js` (reemplazo del flujo de ventas/serie y nuevo resumen)
- Test: `tests/backend/utils/reporteDatos.test.js`

**Interfaces:**
- Consumes: `resolverAlcance`, `condicionAlcance`, `etiquetaAlcance` de Task 5.
- Produces:
  - `obtenerDatosReporte(query)` añade `alcance` y ventas por pedido con `IMPORTE`/`TOTAL`.
  - `obtenerResumenReporte(query)` → `{ desde, hasta, alcance, ordenes, unidades, importe }`.
  - Errores con `statusCode: 400` (alcance inválido) o `statusCode: 404` (tienda inexistente).

- [ ] **Step 1: Reescribir/ampliar las pruebas de `reporteDatos`**

Mantener los casos de rango y normalización, y añadir:

```js
test('todo: una fila por pedido e IMPORTE = TOTAL', async () => {
  montarBd({ ventas: [[
    { ID_VENTA: 1, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '3', IMPORTE: '150000', TOTAL: '150000' },
  ]] });
  const d = await obtenerDatosReporte(RANGO);
  expect(d.ventas).toHaveLength(1);
  expect(d.ventas[0]).toEqual(expect.objectContaining({ IMPORTE: 150000, TOTAL: 150000 }));
  expect(d.resumen.totalIngresos).toBe(150000);
});

test('jadda: pedido mixto conserva TOTAL completo e IMPORTE parcial', async () => {
  montarBd({ ventas: [[
    { ID_VENTA: 2, FECHA: '2026-06-02', ESTADO: 'PAGADA', ARTICULOS: '2', IMPORTE: '100000', TOTAL: '150000' },
  ]] });
  const d = await obtenerDatosReporte({ ...RANGO, alcance: 'jadda' });
  expect(d.alcance).toEqual(expect.objectContaining({ tipo: 'jadda', sufijo: 'jadda' }));
  expect(d.ventas[0].IMPORTE).toBe(100000);
  expect(d.ventas[0].TOTAL).toBe(150000);
});

test('serie sin doble conteo: un pedido con 3 líneas suma una vez', async () => {
  montarBd({ ventas: [[
    { ID_VENTA: 3, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '3', IMPORTE: '120000', TOTAL: '120000' },
  ]] });
  const d = await obtenerDatosReporte(RANGO);
  expect(d.serie.find((s) => s.dia === '2026-06-01')).toEqual(expect.objectContaining({
    ordenes: 1, ingresos: 120000, unidades: 3,
  }));
});

test('cancelada: listada, fuera de resumen y serie', async () => {
  montarBd({ ventas: [[
    { ID_VENTA: 4, FECHA: '2026-06-01', ESTADO: 'CANCELADA', ARTICULOS: '2', IMPORTE: '80000', TOTAL: '90000' },
  ]] });
  const d = await obtenerDatosReporte(RANGO);
  expect(d.ventas).toHaveLength(1);
  expect(d.resumen).toEqual(expect.objectContaining({ totalOrdenes: 0, totalIngresos: 0, totalUnidades: 0 }));
  expect(d.serie[0].ingresos).toBe(0);
});

test('tienda inexistente → 404; alcance inválido → 400', async () => {
  await expect(obtenerDatosReporte({ ...RANGO, alcance: 'tienda', tienda: '99' }))
    .rejects.toMatchObject({ statusCode: 404 });
  await expect(obtenerDatosReporte({ ...RANGO, alcance: 'otro' }))
    .rejects.toMatchObject({ statusCode: 400 });
});

test('resumen no consulta usuarios, vendedores ni serie', async () => {
  montarBd({ ventas: [[
    { ID_VENTA: 5, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '2', IMPORTE: '50000', TOTAL: '59000' },
  ]] });
  const r = await obtenerResumenReporte({ ...RANGO, alcance: 'todo' });
  expect(r).toEqual(expect.objectContaining({ ordenes: 1, unidades: 2, importe: 50000 }));
  const sqls = db.query.mock.calls.map(([sql]) => sql.toUpperCase());
  expect(sqls.some((s) => s.includes('FROM USUARIOS'))).toBe(false);
  expect(sqls.some((s) => s.includes('FROM VENDEDORES'))).toBe(false);
  expect(sqls.some((s) => s.includes('DATE_FORMAT(V.FECHA_VENTA'))).toBe(false);
});
```

Actualizar los mocks por prefijo: la consulta de pedidos empieza por `SELECT V.ID_VENTA` y ya no existe la consulta separada de serie. Añadir un caso de más vendidos filtrado y otro de vendedores con canceladas que no suman.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/utils/reporteDatos.test.js`

Expected: FAIL porque `IMPORTE`/`alcance`/`obtenerResumenReporte` aún no existen.

- [ ] **Step 3: Implementar la consulta única de pedidos y la agregación**

1. Añadir helper interno `resolverAlcanceReporte(query)` que llame `resolverAlcance`; si hay error, lance `Object.assign(new Error(error), { statusCode: 400 })`. Para `tienda`, consultar `NOMBRE_EMPRESA`; si no existe, lanzar `{ statusCode: 404 }`; actualizar la etiqueta con `etiquetaAlcance(alcance, nombre)`.
2. Crear helper `consultarPedidos(desde, hasta, alcance)`:
   - `importeSql = alcance.tipo === 'todo' ? 'v.TOTAL' : 'SUM(dv.SUBTOTAL)'`;
   - `JOIN DETALLE_VENTAS dv`, `JOIN PRODUCTOS p`, `LEFT JOIN USUARIOS/METODOS_PAGO`;
   - `WHERE v.FECHA_VENTA BETWEEN ? AND ? AND ${condicion.sql}`;
   - `SUM(dv.CANTIDAD) AS ARTICULOS`, `${importeSql} AS IMPORTE`, `v.TOTAL AS TOTAL`;
   - agrupar por `v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, u.NOMBRE_USUARIO, mp.NOMBRE_METODO`;
   - ordenar por fecha descendente.
3. `obtenerDatosReporte`: usar `consultarPedidos`, normalizar `ARTICULOS`, `IMPORTE` y `TOTAL`; calcular resumen solo con `ESTADO !== 'CANCELADA'`; construir la serie diaria desde esas filas (sumar `IMPORTE` y `ARTICULOS` una vez por pedido) y cruzarla con usuarios nuevos.
4. Mantener la consulta de usuarios sin filtro de alcance. Añadir `AND ${condicion}` a Más Vendidos y usar `SUM(dv.SUBTOTAL)`.
5. Vendedores: para `jadda`, `[]`; para `tienda`, filtrar `ve.ID_VENDEDOR = ?`; para `todo`, todos. Usar `SUM(CASE WHEN v.ID_VENTA IS NOT NULL THEN dv.CANTIDAD ELSE 0 END)` y lo mismo con `SUBTOTAL` para excluir canceladas.
6. Devolver `alcance` en el objeto final.
7. `obtenerResumenReporte`: resolver rango/alcance, llamar solo `consultarPedidos`, filtrar canceladas y devolver conteos/importe. No consultar usuarios, vendedores ni serie.
8. Exportar `obtenerResumenReporte`.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/reporteDatos.js tests/backend/utils/reporteDatos.test.js
git commit -m "feat(reportes): calcular ventas y resumen por alcance"
```

---

### Task 7: Endpoints de tiendas, resumen y descargas con sufijo

**Files:**
- Modify: `backend/controllers/adminController.js:880-910, 1119`
- Modify: `backend/routes/adminRoutes.js:17-20`
- Test: `tests/backend/unitarios/adminController.test.js:951-991`

**Interfaces:**
- Produces:
  - `GET /api/admin/reportes/tiendas` → filas `{ ID_VENDEDOR, NOMBRE_EMPRESA, ESTADO }`, activas primero.
  - `GET /api/admin/reportes/resumen?desde&hasta&alcance&tienda` → salida de `obtenerResumenReporte`.
  - Descargas aceptan `alcance` y `tienda`; nombre `reporte-jadda_<desde>_a_<hasta>_<sufijo>.xlsx|pdf`.
- Consumes: `resolverAlcance` (Task 5), `obtenerResumenReporte` (Task 6).

- [ ] **Step 1: Escribir las pruebas de controlador**

- `reporteTiendas` devuelve las filas y ejecuta el `ORDER BY (ESTADO = 'ACTIVO') DESC, NOMBRE_EMPRESA ASC`.
- `reporteResumen` delega en `obtenerResumenReporte` y responde 400 si el helper lanza `statusCode: 400`.
- `descargarReporteExcel` con `{ alcance: 'tienda', tienda: '3' }` produce `Content-Disposition: attachment; filename="reporte-jadda_2026-01-01_a_2026-01-31_tienda-3.xlsx"`.
- Sin alcance produce `..._todo.xlsx`.
- Generador que lanza `{ statusCode: 400 }` responde 400 con `{ ok: false, msg: 'Alcance de reporte inválido' }`; error normal sigue en 500.
- Mismo par de casos para PDF.

Actualizar el mock de `reporteDatos.resolverRango` y añadir un mock de `alcanceReporte.resolverAlcance` **antes** del `require` de `adminController`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/unitarios/adminController.test.js`

Expected: FAIL por endpoints ausentes y nombres sin sufijo.

- [ ] **Step 3: Implementar controladores y rutas**

1. Importar `resolverAlcance` y `obtenerResumenReporte`.
2. `reporteTiendas`:

```js
const [rows] = await db.query(
  `SELECT ID_VENDEDOR, NOMBRE_EMPRESA, ESTADO
   FROM VENDEDORES
   ORDER BY (ESTADO = 'ACTIVO') DESC, NOMBRE_EMPRESA ASC`
);
res.json(rows);
```

3. `reporteResumen` devuelve `res.json(await obtenerResumenReporte(req.query))`; en catch responder `err.statusCode || 500` y mensaje público.
4. En las dos descargas, resolver `alcance` antes de generar; si `alcance.error`, responder 400. Armar el nombre con `alcance.sufijo`. En catch, si `err.statusCode` es 400/404 responder ese código con `{ ok: false, msg: err.statusCode === 404 ? 'Tienda no encontrada' : 'Alcance de reporte inválido' }`; en otro caso conservar el 500 actual.
5. Exportar `reporteTiendas` y `reporteResumen`.
6. Rutas, antes de `/reportes/excel`:

```js
router.get('/reportes/tiendas', rateLimit({ max: 60 }), adminController.reporteTiendas);
router.get('/reportes/resumen', rateLimit({ max: 60 }), adminController.reporteResumen);
router.get('/reportes/excel', rateLimit({ max: 20 }), adminController.descargarReporteExcel);
router.get('/reportes/pdf', rateLimit({ max: 20 }), adminController.descargarReportePdf);
```

Importar `rateLimit` en `adminRoutes.js`.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/adminController.js backend/routes/adminRoutes.js tests/backend/unitarios/adminController.test.js
git commit -m "feat(reportes): exponer tiendas resumen y descargas por alcance"
```

---

### Task 8: Presentación del alcance en Excel y PDF

**Files:**
- Modify: `backend/utils/reporteExcel.js:24-203`
- Modify: `backend/utils/reportePdf.js:118-269`
- Test: `tests/backend/utils/reporteExcel.test.js`
- Test: `tests/backend/utils/reportePdf.test.js`

**Interfaces:**
- Consumes: `obtenerDatosReporte()` con `alcance` (Task 6).
- Produces: Excel con columna H “Total pedido COP”; PDF con alcance en encabezado, nota y metadatos.

- [ ] **Step 1: Escribir las pruebas de presentación**

En `reporteExcel.test.js`, mutar `reporteDatos.obtenerDatosReporte` antes de requerir `reporteExcel`, generar el buffer y cargarlo con `new ExcelJS.Workbook().xlsx.load(buffer)`:

```js
expect(hojaVentas.getCell('G1').value).toBe('Importe del alcance COP');
expect(hojaVentas.getCell('H1').value).toBe('Total pedido COP');
expect(hojaVentas.getCell('G2').value).toBe(100000);
expect(hojaVentas.getCell('H2').value).toBe(150000);
expect(hojaResumen.getCell('B3').value).toContain('Alcance: Solo JADDA');
expect(hojaResumen.getCell('B4').value).toContain('incluye envío');
```

En `reportePdf.test.js`, interceptar `PDFDocument.prototype.text` para recoger los strings y afirmar que incluyen `Del 2026-06-01 al 2026-06-03 · Solo JADDA`, la nota de envío y `Sin tiendas en este alcance` con `vendedores: []`.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `corepack pnpm --prefix backend exec vitest run ../tests/backend/utils/reporteExcel.test.js ../tests/backend/utils/reportePdf.test.js`

Expected: FAIL por columnas/notas ausentes.

- [ ] **Step 3: Implementar Excel y PDF**

Excel:
- Columnas: G `Importe del alcance COP` con `v.IMPORTE`; H `Total pedido COP` con `v.TOTAL`; `estiloHeader(..., [1..8])`; moneda en G y H.
- Mantener las fórmulas de Resumen y Gráficas apuntando a `Ventas!G`.
- `B3`: añadir ` · Alcance: ${d.alcance.etiqueta}`.
- `B4`: nota exacta `Todo el catálogo usa el total del pedido (incluye envío). Solo JADDA o una tienda suman únicamente sus líneas y no incluyen envío.`
- Hoja Vendedores: si `d.alcance.tipo === 'jadda'`, nota `El alcance Solo JADDA no incluye tiendas de vendedores`; si `tienda`, solo la fila ya filtrada.
- Hoja Usuarios: nota `Registros nuevos del rango; no depende del alcance`.
- Metadatos: `wb.title = \`Reporte de ventas — ${d.alcance.etiqueta}\`` y descripción con el rango.

PDF:
- `info.Title` = `Reporte de ventas ${d.desde} a ${d.hasta} — ${d.alcance.etiqueta}`.
- Encabezado: `Del ${d.desde} al ${d.hasta} · ${d.alcance.etiqueta}`.
- Después de canceladas: `Todo el catálogo usa el total del pedido (incluye envío). Solo JADDA o una tienda suman únicamente sus líneas y no incluyen envío.`
- Vendedores vacíos: `Sin tiendas en este alcance`.
- Usuarios: título/nota que aclare que no depende del alcance.

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/reporteExcel.js backend/utils/reportePdf.js tests/backend/utils/reporteExcel.test.js tests/backend/utils/reportePdf.test.js
git commit -m "feat(reportes): mostrar alcance en excel y pdf"
```

---

### Task 9: Encabezado compartido y estilos `adp-`

**Files:**
- Create: `frontend/src/admin/EncabezadoDetalle.tsx`
- Modify: `frontend/src/css/adminDashboard.css`
- Test: `tests/frontend/admin/EncabezadoDetalle.test.tsx`

**Interfaces:**
- Consumes: `Breadcrumb` y React Router.
- Produces: `EncabezadoDetalle` con props:
  - `icono: ReactNode`, `titulo: string`, `subtitulo?: string`
  - `volver?: { to: string; label: string }`
  - `breadcrumb?: { label: string; to?: string }[]`
  - `badges?: ReactNode`, `acciones?: ReactNode`, `compacto?: boolean`.

- [ ] **Step 1: Escribir la prueba del encabezado**

```tsx
render(
  <MemoryRouter>
    <EncabezadoDetalle
      icono={<span>icono</span>}
      titulo="Detalle de usuario"
      subtitulo="Ana Pérez"
      volver={{ to: "/admin/usuarios", label: "Volver a usuarios" }}
      breadcrumb={[{ label: "Usuarios", to: "/admin/usuarios" }, { label: "Detalle" }]}
      badges={<span>Admin</span>}
      acciones={<button>Acción</button>}
    />
  </MemoryRouter>
);
expect(screen.getByRole('heading', { level: 1, name: 'Detalle de usuario' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /volver a usuarios/i })).toHaveAttribute('href', '/admin/usuarios');
expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
expect(document.querySelector('.au-modal-hero')).toBeNull();
```

Añadir un segundo render con `compacto` y comprobar que no hay “Volver” ni breadcrumb, que el título es `h2` y que existe `.adp-header--compacto`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix frontend exec vitest run ../tests/frontend/admin/EncabezadoDetalle.test.tsx`

Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar componente y CSS**

- Renderizar `<header className={`adp-header${compacto ? ' adp-header--compacto' : ''}`}>`; si no es compacto, `<Link>` de volver y `<Breadcrumb>`.
- Título `h1` normal y `h2` compacto.
- Estructura: icono, info, badges y acciones.
- En `adminDashboard.css`, añadir el bloque `/* ===== Páginas de detalle admin (adp-) ===== */` con `.adp-header`, `.adp-header--compacto`, `.adp-header-icon`, `.adp-header-info`, `.adp-header-badges`, `.adp-header-actions`, `.adp-card`, `.adp-section`, `.adp-grid`, `.adp-kpi`, `.adp-tabla`, `.adp-compra`, `.adp-compra-head`, `.adp-compra-body`, `.adp-items`, `.adp-envio`, `.adp-pago`, `.adp-evidencia-grid`, `.adp-evidencia-media`, `.adp-readonly`, `.adp-empty`, `.adp-modal-head`.
- Header blanco, borde `#e2e8f0`, acento rojo `#e73737`, fondo `linear-gradient(135deg,#fff,#f8fafc)`; responsive con apilado y acciones a ancho completo.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/admin/EncabezadoDetalle.tsx frontend/src/css/adminDashboard.css tests/frontend/admin/EncabezadoDetalle.test.tsx
git commit -m "feat(admin): crear encabezado compartido de detalle"
```

---

### Task 10: Página de detalle de usuario

**Files:**
- Create: `frontend/src/admin/DetalleUsuarioAdmin.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminUsuarios.tsx`
- Modify: `tests/frontend/admin/msw-handlers-admin.ts`
- Test: `tests/frontend/admin/DetalleUsuarioAdmin.test.tsx`
- Test: `tests/frontend/admin/AdminUsuarios.test.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/usuarios/:id` (Task 2) y `EncabezadoDetalle`.
- Produces: ruta `/admin/usuarios/:id`, parámetro `ID_USUARIO`.
- El listado deja de abrir modal y usa `<Link to={`/admin/usuarios/${u.ID_USUARIO}`}>Ver usuario</Link>`.

- [ ] **Step 1: Ampliar el fixture MSW del usuario**

El detalle debe incluir `compras[0]` con `items`, `ENVIO_*`, `COSTO_ENVIO`, `TOTAL_PEDIDO`, `ESTADO_ENVIO`, `METODO_PAGO`; `stats` con métricas de comprador y de vendedor; `vendedor.ID_SOLICITUD`; retos. Mantener el handler de lista y ampliar el handler de detalle existente.

- [ ] **Step 2: Escribir las pruebas de la página y de la navegación**

En `DetalleUsuarioAdmin.test.tsx`:

```tsx
renderAdmin(
  <Routes>
    <Route path="/admin/usuarios/:id" element={<DetalleUsuarioAdmin />} />
    <Route path="/admin/usuarios" element={<p>lista-usuarios</p>} />
    <Route path="/admin/vendedores/:id" element={<p>detalle-vendedor</p>} />
  </Routes>,
  { ruta: "/admin/usuarios/7" }
);
expect(await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i })).toBeInTheDocument();
const toggle = screen.getByRole('button', { name: /ver detalle de la compra 9/i });
expect(toggle).toHaveAttribute('aria-expanded', 'false');
expect(screen.queryByText('Guayos ADMIN-TEST')).not.toBeInTheDocument();
fireEvent.click(toggle);
expect(toggle).toHaveAttribute('aria-expanded', 'true');
expect(screen.getByText('Guayos ADMIN-TEST')).toBeInTheDocument();
expect(screen.getByText('DeporteX ADMIN-TEST')).toBeInTheDocument();
expect(screen.getByText(/Cali/)).toBeInTheDocument();
expect(screen.getByText(/Deportes Andinos/)).toBeInTheDocument();
```

Añadir: compras visibles aunque el usuario sea vendedor; “Sin datos de envío” para una compra sin envío; filtro de compras por texto; estado vacío; error con reintento. En `AdminUsuarios.test.tsx`, reemplazar el caso de modal por una sonda de ruta: clic en “Ver usuario” debe mostrar `detalle-usuario`.

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix frontend exec vitest run ../tests/frontend/admin/DetalleUsuarioAdmin.test.tsx ../tests/frontend/admin/AdminUsuarios.test.tsx`

Expected: FAIL porque la página y la ruta no existen.

- [ ] **Step 4: Implementar la página, la ruta y la navegación**

- `DetalleUsuarioAdmin`: `useParams`, fetch con `credentials: "include"`, estados `cargando/error/datos`.
- `EncabezadoDetalle` con avatar de iniciales, nombre, `@usuario · email`, badges de rol/confirmado/proveedor, volver y breadcrumb.
- Resumen de KPIs; sección “Actividad como vendedor” con enlace a `/admin/vendedores/${vendedor.ID_SOLICITUD}`; datos personales, direcciones, métodos, compras y retos.
- Compras: filtros texto/estado; todas colapsadas; botón con `aria-expanded` y `aria-controls`; al abrir, tabla de ítems con imagen, producto, variante, cantidad, precio unitario, subtotal y origen (`JADDA` si `ID_VENDEDOR == null`), bloque de pago y bloque de envío. Si no hay `ENVIO_DIRECCION`, mostrar “Sin datos de envío”.
- Formatear moneda con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.
- En `App.tsx`, lazy import y ruta bajo `<AdminRoute>`.
- En `AdminUsuarios.tsx`, eliminar el estado/fetch del modal y convertir “Ver usuario” en `Link`.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 3, más `corepack pnpm --prefix frontend lint`.

Expected: PASS y lint sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/admin/DetalleUsuarioAdmin.tsx frontend/src/App.tsx frontend/src/admin/AdminUsuarios.tsx tests/frontend/admin/DetalleUsuarioAdmin.test.tsx tests/frontend/admin/AdminUsuarios.test.tsx tests/frontend/admin/msw-handlers-admin.ts
git commit -m "feat(admin): agregar pagina de detalle de usuario"
```

---

### Task 11: Página de detalle de vendedor

**Files:**
- Create: `frontend/src/admin/DetalleVendedorAdmin.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminVendedores.tsx`
- Modify: `tests/frontend/admin/msw-handlers-admin.ts`
- Test: `tests/frontend/admin/DetalleVendedorAdmin.test.tsx`
- Test: `tests/frontend/admin/AdminVendedores.test.tsx`

**Interfaces:**
- Consumes: `GET /api/vendedor/admin/:id` (Task 3), `POST /api/vendedor/admin/:id/procesar`, `EncabezadoDetalle`.
- Produces: ruta `/admin/vendedores/:id`, parámetro `ID_SOLICITUD`; listado con `<Link>Gestionar</Link>`.

- [ ] **Step 1: Añadir handlers/fixtures de detalle de solicitud**

Handler `GET */api/vendedor/admin/:id` con una solicitud aprobada: `solicitud`, `vendedor`, `resumen` (`productosPublicados`, `unidadesVendidas`, `totalVentas`, `totalIngresos`, `ticketPromedio`), `productos` y `ventasRecientes`. Añadir una variante pendiente sin vendedor para el test de acciones.

- [ ] **Step 2: Escribir las pruebas de página y navegación**

```tsx
renderAdmin(
  <Routes>
    <Route path="/admin/vendedores/:id" element={<DetalleVendedorAdmin />} />
    <Route path="/admin/vendedores" element={<p>lista-vendedores</p>} />
  </Routes>,
  { ruta: "/admin/vendedores/1" }
);
expect(await screen.findByRole('heading', { level: 1, name: /Deportes Andinos/i })).toBeInTheDocument();
expect(screen.getByText('Guayos ADMIN-TEST')).toBeInTheDocument();
expect(screen.getByText('7')).toBeInTheDocument(); // unidades
expect(screen.getByText(/\$210\.000/)).toBeInTheDocument();
expect(screen.getByText(/Cliente Reciente/)).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
```

Añadir: pendiente sin tienda muestra “Solicitud pendiente: todavía no tiene tienda aprobada” y botones Aprobar/Rechazar; rechazar exige observación (mock de `Swal.fire`); tras procesar se vuelve a cargar; 404 muestra error y enlace de vuelta. En `AdminVendedores.test.tsx`, “Gestionar” navega y **no** se llama al catálogo `/api/admin/productos`.

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix frontend exec vitest run ../tests/frontend/admin/DetalleVendedorAdmin.test.tsx ../tests/frontend/admin/AdminVendedores.test.tsx`

Expected: FAIL porque la página no existe.

- [ ] **Step 4: Implementar página, ruta y navegación**

- Fetch del detalle; render de solicitud, cuenta de vendedor, KPIs, tabla de productos (imagen, nombre, precio, stock, estado, unidades, pedidos, ingresos), ventas recientes y acciones.
- Si `vendedor == null`, mensaje exacto “Solicitud pendiente: todavía no tiene tienda aprobada” y acciones solo si `solicitud.ESTADO === 'PENDIENTE'`.
- Aprobar con confirmación; rechazar con `Swal.fire` `input: 'textarea'` y observación obligatoria. POST JSON `{ estado, observacion }`; refrescar tras éxito; mantener feedback.
- Enlace “Ver usuario” si `solicitud.ID_USUARIO` existe.
- En `App.tsx`, lazy import/ruta. En `AdminVendedores.tsx`, eliminar `productosVendedor`, `cargandoProductos`, fetch del catálogo y modal; “Gestionar” pasa a `Link`.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 3, más `corepack pnpm --prefix frontend lint`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/admin/DetalleVendedorAdmin.tsx frontend/src/App.tsx frontend/src/admin/AdminVendedores.tsx tests/frontend/admin/DetalleVendedorAdmin.test.tsx tests/frontend/admin/AdminVendedores.test.tsx tests/frontend/admin/msw-handlers-admin.ts
git commit -m "feat(admin): agregar pagina de detalle de vendedor"
```

---

### Task 12: Página de detalle de evidencia

**Files:**
- Create: `frontend/src/admin/DetalleEvidenciaAdmin.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminRetos.tsx`
- Modify: `tests/frontend/admin/msw-handlers-admin.ts`
- Test: `tests/frontend/admin/DetalleEvidenciaAdmin.test.tsx`
- Test: `tests/frontend/admin/AdminRetos.test.tsx`

**Interfaces:**
- Consumes: `GET /api/retos/admin/evidencias/:id` (Task 4), endpoints `aprobar|rechazar`, `EncabezadoDetalle`.
- Produces: ruta `/admin/retos/:id`, parámetro `ID_EVIDENCIA`; listado con `<Link>Ver</Link>`.

- [ ] **Step 1: Añadir fixture de evidencia individual**

El handler devuelve `TIPO`, `RUTA`, `RUTAS_EXTRA` JSON, `CANTIDAD`, `ESTADO`, `OBSERVACION`, `FECHA_SUBIDA`, datos de usuario y reto, `PROGRESO`, `META_VALOR`, `META_TIPO`. Añadir un caso con dos imágenes y otro con video.

- [ ] **Step 2: Escribir las pruebas de la página**

```tsx
renderAdmin(
  <Routes>
    <Route path="/admin/retos/:id" element={<DetalleEvidenciaAdmin />} />
    <Route path="/admin/retos" element={<p>lista-retos</p>} />
    <Route path="/admin/usuarios/:id" element={<p>detalle-usuario</p>} />
  </Routes>,
  { ruta: "/admin/retos/7" }
);
expect(await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i })).toBeInTheDocument();
expect(screen.getByText('Reto 10K ADMIN-TEST')).toBeInTheDocument();
expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
expect(screen.getByText('3/10')).toBeInTheDocument();
const imagen = screen.getByAltText(/evidencia 1/i);
fireEvent.click(imagen);
expect(screen.getByRole('dialog', { name: /evidencia ampliada/i })).toBeInTheDocument();
```

Añadir: enlace al usuario navega a `/admin/usuarios/:id`; multiples imágenes/video con `controls`; aprobar/rechazar solo en pendiente; tras aprobar se actualiza el estado y desaparecen los botones; 404.

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix frontend exec vitest run ../tests/frontend/admin/DetalleEvidenciaAdmin.test.tsx ../tests/frontend/admin/AdminRetos.test.tsx`

Expected: FAIL porque la página no existe.

- [ ] **Step 4: Implementar página, ruta y navegación**

- Fetch; header “Evidencia de reto” con estado, usuario y fecha.
- Sección usuario con enlace; sección reto con descripción, progreso/meta y barra; evidencia con tipo, cantidad, fecha, observación y material.
- Parsear `RUTAS_EXTRA` con `JSON.parse(e.RUTAS_EXTRA || '[]')` e ignorar JSON inválido. Si hay una ruta, mostrarla grande; si varias, grid; video con `controls`.
- Imágenes con `ImageZoom` o grid; clic abre overlay local `role="dialog" aria-modal="true" aria-label="Evidencia ampliada"`, cerrable con Escape y click.
- Si no hay rutas, mensaje “Sin material adjunto”.
- Acciones pendientes con las mismas confirmaciones/observaciones del listado actual; actualizar estado local y mostrar feedback.
- `App.tsx` lazy import/ruta. En `AdminRetos.tsx`, eliminar `ver`, `todasLasRutas`, el modal y el fetch asociado; “Ver” pasa a `Link`.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 3, más `corepack pnpm --prefix frontend lint`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/admin/DetalleEvidenciaAdmin.tsx frontend/src/App.tsx frontend/src/admin/AdminRetos.tsx tests/frontend/admin/DetalleEvidenciaAdmin.test.tsx tests/frontend/admin/AdminRetos.test.tsx tests/frontend/admin/msw-handlers-admin.ts
git commit -m "feat(admin): agregar pagina de detalle de evidencia"
```

---

### Task 13: Devoluciones y reembolsos: renombre, encabezado y solo lectura

**Files:**
- Modify: `frontend/src/admin/AdminNavbar.tsx:18`
- Modify: `frontend/src/admin/AdminDashboard.tsx:60`
- Modify: `frontend/src/admin/AdminDevoluciones.tsx:204-479`
- Modify: `frontend/src/css/adminDashboard.css:345`
- Modify: `tests/frontend/admin/msw-handlers-admin.ts`
- Test: `tests/frontend/admin/AdminDevoluciones.test.tsx`
- Test: `tests/frontend/admin/AdminNavbar.test.tsx`
- Test: `tests/frontend/admin/AdminDashboard.test.tsx`

**Interfaces:**
- Consumes: `EncabezadoDetalle` compacto y campos `VENDEDOR_NOMBRE`, `ID_VENDEDOR`, `FECHA_PROCESADA`, `OBSERVACION`.
- Produces: etiqueta “Devoluciones y reembolsos” en sidebar/KPI; modal con encabezado claro; cerrada sin acciones.

- [ ] **Step 1: Ampliar fixtures y escribir pruebas**

En el fixture de devoluciones añadir:
- una devolución JADDA (`ID_VENDEDOR: null`) en `SOLICITADA`;
- una de tienda en `ESCALADA` con `VENDEDOR_NOMBRE: 'DeporteX ADMIN-TEST'`;
- una de tienda en `APROBADA` con `FECHA_PROCESADA` y `OBSERVACION`.

Pruebas:
- el listado muestra la nota “Las devoluciones de tiendas aparecen cuando el vendedor las escala o las cierra.”;
- al abrir la escalada, existe `.adp-header--compacto`, no `.au-modal-hero`, badge “Escalada a JADDA” y origen “DeporteX ADMIN-TEST”;
- la cerrada muestra banner de solo lectura, fecha/observación y **no** muestra botones “Aprobar”, “Rechazar” ni “Pedir más pruebas”;
- `AdminNavbar` contiene el label largo; `AdminDashboard` contiene el KPI “Devoluciones y reembolsos”.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix frontend exec vitest run ../tests/frontend/admin/AdminDevoluciones.test.tsx ../tests/frontend/admin/AdminNavbar.test.tsx ../tests/frontend/admin/AdminDashboard.test.tsx`

Expected: FAIL por textos y encabezado.

- [ ] **Step 3: Implementar**

- Cambiar label del sidebar a “Devoluciones y reembolsos”; KPI a “Devoluciones y reembolsos” conservando `pendientes.devolucionesPend`.
- En el modal, sustituir `.au-modal-hero` por `<div className="adp-modal-head"><EncabezadoDetalle compacto ... /></div>`.
- Título: nombre del usuario; subtítulo `@usuario · email`; badges: tipo (`Devolución`/`Reembolso`), estado, `Escalada a JADDA` si aplica, y origen (`JADDA` o `Tienda: VENDEDOR_NOMBRE`).
- Calcular `esCerrada = ['APROBADA','RECHAZADA'].includes(ver.ESTADO)`.
- Mostrar `<div className="adp-readonly" role="status">Historial de solo lectura · Procesada el ... · Observación: ...</div>` y no renderizar el footer de acciones para cerradas.
- Mantener las acciones actuales para `SOLICITADA`, `MAS_PRUEBAS`, `ESCALADA`.
- CSS `.admin-sidebar-label { white-space: normal; line-height: 1.15; }` y revisar que badge/icono sigan alineados en móvil.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 2, más `corepack pnpm --prefix frontend lint`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/admin/AdminNavbar.tsx frontend/src/admin/AdminDashboard.tsx frontend/src/admin/AdminDevoluciones.tsx frontend/src/css/adminDashboard.css tests/frontend/admin/AdminDevoluciones.test.tsx tests/frontend/admin/AdminNavbar.test.tsx tests/frontend/admin/AdminDashboard.test.tsx tests/frontend/admin/msw-handlers-admin.ts
git commit -m "feat(admin): renombrar devoluciones y marcar historial como solo lectura"
```

---

### Task 14: Modal de descarga de reportes con alcance

**Files:**
- Create: `frontend/src/admin/ModalDescargaReporte.tsx`
- Modify: `frontend/src/utils/reportes.tsx:41-77`
- Modify: `frontend/src/admin/AdminReportes.tsx:1-44, 116-260`
- Modify: `tests/frontend/admin/msw-handlers-admin.ts`
- Test: `tests/frontend/admin/ModalDescargaReporte.test.tsx`
- Test: `tests/frontend/admin/AdminReportes.test.tsx`
- Test: `tests/frontend/utils/reportes.test.tsx`

**Interfaces:**
- `descargarReporte({ formato, url, desde, hasta, prefijoArchivo, setDescargando, sufijo?, detalle? }): Promise<boolean>`.
- `ModalDescargaReporte` props:
  - `formato: 'excel' | 'pdf'`
  - `desdeInicial: string`, `hastaInicial: string`
  - `onCerrar: () => void`.
- Endpoints consumidos: `GET /api/admin/reportes/tiendas`, `GET /api/admin/reportes/resumen`, `GET /api/admin/reportes/excel|pdf`.

- [ ] **Step 1: Actualizar las pruebas del util**

En `reportes.test.tsx`:
- la descarga exitosa retorna `true`;
- el fallo retorna `false` y muestra Swal de error;
- con `sufijo: 'tienda-3'` el anchor descarga `ventas_2026-11-01_a_2026-11-16_tienda-3.pdf`;
- con `detalle: 'Solo JADDA'` el texto de éxito incluye `Solo JADDA`.

- [ ] **Step 2: Añadir handlers de tiendas/resumen**

En `msw-handlers-admin.ts`:

```ts
http.get('*/api/admin/reportes/tiendas', () => HttpResponse.json([
  { ID_VENDEDOR: 1, NOMBRE_EMPRESA: 'DeporteX ADMIN-TEST', ESTADO: 'ACTIVO' },
  { ID_VENDEDOR: 2, NOMBRE_EMPRESA: 'Fitness Lumen ADMIN-TEST', ESTADO: 'INACTIVO' },
])),
```

`GET */api/admin/reportes/resumen` registra la petición y devuelve conteos distintos según `alcance`: todo `{ ordenes: 6, unidades: 12, importe: 900000 }`, jadda `{ ordenes: 4, unidades: 7, importe: 500000 }`, tienda `{ ordenes: 2, unidades: 5, importe: 320000 }`.

- [ ] **Step 3: Escribir las pruebas del modal y de la página**

`ModalDescargaReporte.test.tsx`:

```tsx
render(
  <MemoryRouter>
    <ModalDescargaReporte formato="excel" desdeInicial="2026-11-01" hastaInicial="2026-11-16" onCerrar={onCerrar} />
  </MemoryRouter>
);
expect(await screen.findByRole('dialog')).toBeInTheDocument();
expect(await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/)).toBeInTheDocument();
fireEvent.click(screen.getByLabelText('Solo JADDA'));
expect(await screen.findByText(/Se incluirán: 4 órdenes · 7 unidades/)).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: /descargar excel/i }));
await waitFor(() => expect(onCerrar).toHaveBeenCalled());
```

Añadir: seleccionar tienda envía `alcance=tienda&tienda=1`; descarga exitosa usa `..._jadda.xlsx`; fallo de descarga deja el modal abierto; Escape/overlay cierran; mientras descarga no cierran. En `AdminReportes.test.tsx`, los botones Excel/PDF abren el modal y ya no descargan directo.

- [ ] **Step 4: Ejecutar y verificar que falla**

Run: `corepack pnpm --prefix frontend exec vitest run ../tests/frontend/admin/ModalDescargaReporte.test.tsx ../tests/frontend/admin/AdminReportes.test.tsx ../tests/frontend/utils/reportes.test.tsx`

Expected: FAIL porque el modal y los parámetros no existen.

- [ ] **Step 5: Implementar util, modal y página**

- `descargarReporte`: aceptar `sufijo`/`detalle`; construir `${prefijoArchivo}_${desde}_a_${hasta}${sufijo ? `_${sufijo}` : ''}.${ext}`; retorno booleano; `finally` siempre limpia.
- `ModalDescargaReporte`:
  - fetch de tiendas al montar;
  - estados de fechas, alcance (`todo` por defecto), tienda, resumen, carga/error, descarga;
  - `useEffect` con debounce de 250 ms y `AbortController` para `/resumen?desde&hasta&alcance&tienda`; ignorar `AbortError` y respuestas viejas; si `alcance=tienda` sin tienda, no consultar;
  - texto exacto `Se incluirán: N órdenes · M unidades · $X`;
  - radios “Todo el catálogo”, “Solo JADDA”, “Una tienda”; select deshabilitado si no hay tiendas;
  - validar `desde <= hasta`; descargar con `prefijoArchivo: 'reporte-jadda'`, `sufijo` (`todo`/`jadda`/`tienda-<id>`) y `detalle` (`Todo el catálogo`/`Solo JADDA`/`Tienda: nombre`); URL con `URLSearchParams`;
  - cerrar solo si el retorno es `true`;
  - `role="dialog" aria-modal="true"`, foco inicial, Escape y overlay (bloqueados mientras descarga).
- `AdminReportes`: reemplazar `descargando` y `descargar()` por estado `modal: 'excel'|'pdf'|null`; los botones abren el modal con fechas actuales; renderizar `<ModalDescargaReporte ... onCerrar={() => setModal(null)} />`.

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: el mismo comando del Step 4, más `corepack pnpm --prefix frontend lint` y `corepack pnpm --prefix frontend build`.

Expected: PASS, lint y build sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/admin/ModalDescargaReporte.tsx frontend/src/utils/reportes.tsx frontend/src/admin/AdminReportes.tsx tests/frontend/admin/ModalDescargaReporte.test.tsx tests/frontend/admin/AdminReportes.test.tsx tests/frontend/utils/reportes.test.tsx tests/frontend/admin/msw-handlers-admin.ts
git commit -m "feat(reportes): elegir alcance antes de descargar"
```

---

### Task 15: Verificación final y revisión de regresión

**Files:**
- Verify: todos los archivos modificados.
- Update only if needed: pruebas y documentación estrictamente afectada.

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: evidencia de que backend, frontend y build están verdes.

- [ ] **Step 1: Ejecutar la suite backend completa**

Run: `corepack pnpm --prefix backend test`

Expected: todos los tests pasan, incluidos los nuevos de utilidades y controladores.

- [ ] **Step 2: Ejecutar la suite frontend completa**

Run: `corepack pnpm --prefix frontend test`

Expected: todos los tests pasan.

- [ ] **Step 3: Ejecutar lint y build**

Run: `corepack pnpm --prefix frontend lint`

Expected: sin errores.

Run: `corepack pnpm --prefix frontend build`

Expected: build de Vite y typecheck sin errores.

- [ ] **Step 4: Revisar el diff completo**

Run: `git diff --stat` y `git diff --check`.

Comprobar manualmente:
- no quedó ningún `au-modal-hero` en las páginas nuevas;
- no quedó ningún fetch de catálogo completo en `AdminVendedores`;
- no quedaron modales de detalle en usuarios/vendedores/retos;
- todos los endpoints nuevos tienen `esAdmin`;
- no se tocaron reportes del vendedor ni migraciones;
- no se añadieron secretos.

- [ ] **Step 5: Commit final de ajustes (solo si hubo cambios)**

```bash
git add <rutas explícitas>
git commit -m "test: cerrar verificacion de detalles admin y reportes"
```

No usar `git add -A` ni `git commit -a`.

---

## Self-Review

- **Cobertura del spec:** usuarios (Tasks 2/10), vendedores (3/11), evidencias (4/12), encabezado (9), devoluciones (1/13), reportes por alcance (5/6/7/8/14), pruebas y verificación (15).
- **Consistencia de interfaces:** `obtenerResumenReporte` se define en Task 6 y se consume en Task 7; `EncabezadoDetalle` en Task 9 y se usa en 10–13; `descargarReporte` cambia en Task 14 junto con sus consumidores.
- **Review Focus:** los cinco riesgos tienen prueba en la tarea dueña de la lógica.
- **Sin migraciones:** ninguna tarea modifica `setup.js` ni genera SQL de esquema.
