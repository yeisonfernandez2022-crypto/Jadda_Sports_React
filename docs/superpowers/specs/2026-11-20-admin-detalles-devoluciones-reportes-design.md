# Diseño — Detalles admin, devoluciones y reportes con alcance

Fecha: 2026-11-20 · Estado: aprobado el 2026-11-22.
Documentos relacionados (se conservan sin modificar):

- `docs/superpowers/specs/2026-11-17-panel-admin-revamp-design.md`
- `docs/superpowers/plans/2026-11-17-panel-admin-revamp.md`

Esta iteración retoma y acota los puntos 4, 6, 7, 10 y 14 del diseño previo
(páginas de usuario/vendedor/reto, reportes y nombre del sidebar) y añade dos
necesidades nuevas: la visibilidad de devoluciones de tiendas y el alcance de
las descargas Excel/PDF. El resto del revamp del 2026-11-17 (órdenes, categorías,
chats, notificaciones, Cloudinary, consistencia global) queda fuera de este
alcance. Si más adelante se implementan ambos documentos, este diseño manda
para los puntos que solapa.

## Intención y por qué

Hoy el admin revisa usuarios, vendedores y evidencias de retos dentro de modales
que se quedan cortos: las compras no muestran sus líneas ni el envío, los
productos del vendedor se cargan trayendo todo el catálogo y filtrando en el
navegador, y la evidencia no tiene una URL propia para volver o compartir. En
devoluciones, el admin ve solicitudes de tiendas que el vendedor todavía está
gestionando, y el nombre de la sección no coincide con lo que contiene
(devoluciones y reembolsos). En reportes, Excel y PDF siempre descargan todo el
catálogo: no se puede pedir solo JADDA, una tienda concreta ni ver antes cuánto
entrará en la descarga.

La solución es acotada: tres páginas dedicadas con un encabezado claro
compartido, la devolución sigue siendo modal pero con mejor encabezado, y la
descarga de reportes gana un modal de alcance con conteo en vivo. No se cambian
reglas de negocio ni el esquema de la base de datos.

## Alcance

1. **Usuarios:** “Ver usuario” navega a `/admin/usuarios/:id`. La página muestra
   datos personales, direcciones, métodos de pago, retos y **cada compra
   expandible** con productos, cantidades, precios, pago, envío y estado.
2. **Vendedores:** “Gestionar” navega a `/admin/vendedores/:id`. La página muestra la solicitud completa y, si ya es
   vendedor, qué productos vende, cuántas unidades y cuánto ha vendido, más sus
   ventas recientes.
3. **Retos:** “Ver” navega a `/admin/retos/:id`. La página muestra la evidencia
   completa (imágenes/video), usuario, reto, progreso/meta, observación y estado,
   con aprobar/rechazar si sigue pendiente.
4. **Encabezado claro compartido:** las páginas nuevas y el modal de devoluciones
   usan un encabezado claro y atractivo, sin el banner azul oscuro
   (`.au-modal-hero`) ni el gradiente navy del dashboard.
5. **Devoluciones y reembolsos:** renombrar en sidebar, etiquetas, breadcrumb y
   KPI. Las devoluciones de productos de tiendas no se muestran mientras el
   vendedor las gestiona (`SOLICITADA`, `MAS_PRUEBAS`); se muestran al escalar
   (`ESCALADA`) o al cerrarse (`APROBADA`, `RECHAZADA`). Las cerradas sin escalar
   se ven como historial de solo lectura.
6. **Reportes:** los botones Excel/PDF abren un modal para elegir Todo, Solo
   JADDA o una tienda, más el rango de fechas. El modal muestra el conteo
   estimado y ese conteo cambia al cambiar el alcance. El alcance se refleja en
   el Excel, el PDF y el nombre del archivo.

## No-goals

- No se toca la página de órdenes, las cards KPI de órdenes, el estado automático
  de la venta, categorías, chats, notificaciones, Cloudinary ni el resto del
  revamp del 2026-11-17.
- No se añaden reseñas de productos del vendedor en esta iteración (el diseño
  previo las proponía; aquí el pedido es “simple”: productos, unidades e
  ingresos).
- No se crea una página por compra: la compra se expande dentro del detalle del
  usuario.
- El modal de devoluciones **no** se convierte en página.
- No se cambia el esquema de la base de datos ni se agregan migraciones.
- No se modifica la descarga de reportes del panel del vendedor
  (`reporteVendedorDatos/Excel/Pdf`); el alcance aplica solo al admin.

## Enfoques considerados

- **A (elegido):** páginas dedicadas con encabezado compartido y cambios
  acotados de API; devoluciones sigue en modal; alcance dentro del modal de
  descarga. Reutiliza los nombres de componentes y rutas que ya proponía el
  plan previo.
- **B (descartado):** agrandar los modales actuales. No resuelve la falta de URL
  propia, sigue cargando catálogo completo y empeora la lectura en móvil.
- **C (descartado):** páginas nuevas sin encabezado común. Repetiría estilos y
  dejaría el panel visualmente inconsistente, que es justo lo que se quiere
  corregir.

## 1. Rutas, navegación y encabezado compartido

### Rutas

| Listado | Acción | Ruta nueva | Componente | Parámetro |
|---|---|---|---|---|
| `/admin/usuarios` | “Ver usuario” | `/admin/usuarios/:id` | `DetalleUsuarioAdmin.tsx` | `ID_USUARIO` |
| `/admin/vendedores` | “Gestionar” | `/admin/vendedores/:id` | `DetalleVendedorAdmin.tsx` | `ID_SOLICITUD` |
| `/admin/retos` | “Ver” | `/admin/retos/:id` | `DetalleEvidenciaAdmin.tsx` | `ID_EVIDENCIA` |

- Se registran como lazy imports en `frontend/src/App.tsx`, dentro de
  `<AdminRoute>`.
- El parámetro de vendedor es `ID_SOLICITUD` porque el listado es de solicitudes
  y una solicitud pendiente todavía no tiene `ID_VENDEDOR`. El endpoint de
  detalle devuelve ambos.
- Los listados dejan de abrir modales y de hacer el fetch de detalle al hacer
  clic. `AdminUsuarios` elimina `detalle`, `cargandoDetalle`, `verMas` y su JSX
  de modal; `AdminRetos` elimina `ver` y su modal; `AdminVendedores` elimina
  `ver`, `productosVendedor`, `cargandoProductos` y el fetch del catálogo
  completo.

### Encabezado compartido

Nuevo `frontend/src/admin/EncabezadoDetalle.tsx`:

```tsx
interface Props {
  icono: ReactNode;
  titulo: string;
  subtitulo?: string;
  volver?: { to: string; label: string };
  breadcrumb?: { label: string; to?: string }[];
  badges?: ReactNode;
  acciones?: ReactNode;
  compacto?: boolean; // variante para el modal de devoluciones
}
```

- Renderiza botón “Volver”, `Breadcrumb` (si se pasa), un icono en tile, título,
  subtítulo, badges y acciones a la derecha.
- Variante `compacto`: sin volver ni breadcrumb, pensada para el modal.
- Estilos nuevos con prefijo `adp-` en `adminDashboard.css`:
  - `.adp-header`: tarjeta blanca con borde `#e2e8f0`, barra/accento rojo
    `#e73737`, fondo suave `linear-gradient(135deg,#fff,#f8fafc)`.
  - `.adp-header-icon`, `.adp-header-info`, `.adp-header-badges`,
    `.adp-header-actions`.
  - Responsive: en pantallas angostas el header apila icono, texto y acciones.
- No se usa `.au-modal-hero` ni fondos azul oscuro en las páginas nuevas.

## 2. Detalle de usuario (`/admin/usuarios/:id`)

### Contenido de la página

1. **Encabezado:** avatar/iniciales, nombre completo, `@usuario · email`, badges
   de rol, confirmado y proveedor de autenticación; acción “Volver a usuarios”.
2. **Resumen:** pedidos realizados, total gastado, favoritos y retos. Si el
   usuario es vendedor, una sección aparte “Actividad como vendedor” con
   productos publicados, unidades vendidas, ventas e ingresos, y enlace a su
   detalle de vendedor.
3. **Datos personales:** documento, teléfono, fecha de registro, última conexión,
   última IP/ubicación y `AUTH_PROVIDER`.
4. **Direcciones:** cards con dirección, barrio, ciudad, departamento, código
   postal, teléfono y etiqueta de principal.
5. **Métodos de pago:** titular, banco, tipo, método y principal.
6. **Compras:** lista de compras expandibles. La cabecera de cada compra muestra
   `#pedido`, fecha, total, estado de la venta, método de pago y estado de envío.
   Al expandir:
   - Tabla de líneas: imagen, producto, variante (color/atributo), cantidad,
     precio unitario, subtotal y origen (`JADDA` o nombre de la tienda).
   - Bloque de pago: método, referencia, total del pedido.
   - Bloque de envío: dirección, barrio, ciudad, departamento, código postal,
     teléfono de contacto y costo de envío.
   - Si no hay envío registrado: “Sin datos de envío”.
   - Botón con `aria-expanded` y `aria-controls`; todas las compras empiezan
     colapsadas.
7. **Retos:** título, progreso/meta, completado, cupón generado y evidencias
   pendientes.
8. Filtros de compras (texto y estado) y de retos, conservando la funcionalidad
   que hoy tiene el modal.
9. Estados de carga, error con reintento y vacíos (“Este usuario aún no tiene
   compras”, etc.).

### API `GET /api/admin/usuarios/:id` (se amplía sin romper lo actual)

Se conservan `usuario`, `direcciones`, `metodos`, `stats`, `vendedor`, `ventas`,
`compras` y `retos`. Cambios:

- **Compras siempre visibles:** hoy, si el usuario es vendedor, se fuerzan
  `stats.totalCompras = 0` y `stats.totalGastado = 0`. Se elimina ese reseteo:
  un vendedor también puede comprar. Las métricas de vendedor se añaden aparte
  (`stats.productosPublicados`, `unidadesVendidas`, `totalVentas`,
  `totalIngresos`), sin pisar las de comprador.
- **Líneas por compra:** nueva consulta de `DETALLE_VENTAS` para los `ID_VENTA`
  de las compras (máximo 200 órdenes) y agrupación en JS:
  ```js
  compras[i].items = [{
    ID_VENTA, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL,
    NOMBRE, ID_VENDEDOR, VENDEDOR_NOMBRE, IMAGEN,
    COLOR, NOMBRE_ATRIBUTO, ATRIBUTO
  }]
  ```
  `VENDEDOR_NOMBRE` sale de `LEFT JOIN VENDEDORES`; `ID_VENDEDOR = NULL`
  significa JADDA.
- **Envío y totales:** cada compra añade `ENVIO_DIRECCION`, `ENVIO_CIUDAD`,
  `ENVIO_BARRIO`, `ENVIO_DEPARTAMENTO`, `ENVIO_CODIGO_POSTAL`,
  `ENVIO_TELEFONO`, `COSTO_ENVIO` y `TOTAL_PEDIDO` (= `VENTAS.TOTAL`, que ya
  incluye el envío). Se conserva `TOTAL`.
- **Corrección:** `TOTAL_ARTICULOS` pasa de `COUNT(*)` de líneas a
  `SUM(dv.CANTIDAD)`; el nombre actual dice “artículos”, no “líneas”.
- **Enlace al vendedor:** la consulta de `vendedor` añade `ID_SOLICITUD` para
  poder navegar a `/admin/vendedores/:idSolicitud`.
- `ventas` sigue siendo la lista de ventas del vendedor (compatibilidad); la
  página nueva la usa en “Actividad como vendedor”.

## 3. Detalle de vendedor (`/admin/vendedores/:id`)

### Contenido

1. **Encabezado:** nombre de la empresa (o del representante si aún no hay
   empresa), badge de estado, NIT; acciones “Ver usuario” (si hay `ID_USUARIO`)
   y volver a vendedores.
2. **Solicitud:** representante, email de empresa, teléfono, departamento,
   ciudad, dirección, categorías, descripción, fecha de creación, fecha de
   procesamiento y observación del admin.
3. **Cuenta de vendedor:** si existe, email, fecha de registro y estado; si no,
   mensaje “Solicitud pendiente: todavía no tiene tienda aprobada”.
4. **Resumen de ventas:** productos publicados, unidades vendidas, pedidos,
   ingresos y ticket promedio. Los ingresos son la suma de subtotales de sus
   líneas, sin envío.
5. **Productos que vende:** tabla con imagen, nombre, precio, stock, estado de
   publicación, unidades vendidas, pedidos e ingresos. Ordenada por unidades
   vendidas. Si no tiene productos: vacío explicativo.
6. **Ventas recientes:** últimas 10 órdenes con fecha, cliente, estado e
   `IMPORTE` de las líneas del vendedor (no el total del pedido si es mixto).
7. **Acciones:** si la solicitud está `PENDIENTE`, botones Aprobar/Rechazar con
   el mismo flujo actual (confirmación y observación obligatoria al rechazar).
   Tras procesar, se refresca la página y se muestra feedback. Si ya fue
   procesada, no se muestran acciones.

### API `GET /api/vendedor/admin/:id` (nueva, admin)

`id` = `ID_SOLICITUD`. Devuelve:

```json
{
  "solicitud": {},
  "vendedor": null,
  "resumen": null,
  "productos": [],
  "ventasRecientes": []
}
```

- `solicitud`: `SOLICITUDES_VENDEDOR.*` + datos del solicitante
  (`SOLICITANTE_NOMBRE`, `SOLICITANTE_EMAIL`, `SOLICITANTE_USUARIO`,
  `SOLICITANTE_TELEFONO`).
- `vendedor`: fila de `VENDEDORES` si la solicitud fue aprobada; incluye
  `ID_VENDEDOR`, `ESTADO`, `FECHA_REGISTRO`.
- `resumen`: `productosPublicados`, `unidadesVendidas`, `totalVentas`,
  `totalIngresos`, `ticketPromedio` (solo si hay vendedor).
- `productos`: por producto del vendedor (`ELIMINADO = 0`): `ID`, `NOMBRE`,
  `PRECIO`, `STOCK` (suma de variantes), `ESTADO_PUBLICACION`, `URL_IMAGEN`,
  `unidades`, `ingresos`, `pedidos`. Límite 100.
- `ventasRecientes`: últimas 10 órdenes con líneas del vendedor; `IMPORTE` es la
  suma de `dv.SUBTOTAL` de sus líneas.
- 404 si la solicitud no existe.
- Se registra en `backend/routes/vendedorRoutes.js` antes de las rutas del panel
  del vendedor, con `esAdmin` y rate limit de 60/min.
- Acciones: se reutiliza `POST /api/vendedor/admin/:id/procesar` con
  `{ estado: "APROBADA" | "RECHAZADA", observacion }`.

## 4. Detalle de evidencia (`/admin/retos/:id`)

### Contenido

1. **Encabezado:** “Evidencia de reto”, badge de estado, usuario y fecha; volver
   a retos.
2. **Usuario:** nombre, email y enlace a `/admin/usuarios/:idUsuario`.
3. **Reto:** título, descripción, progreso/meta con barra, recompensa y estado
   de completado.
4. **Evidencia:** tipo, cantidad, fecha de subida, observación y **todo el
   material**: una imagen grande si hay una; grid si hay varias; video con
   controles si es video. Las imágenes se pueden abrir a tamaño completo en un
   visor/overlay (reutilizar `ImageZoom` si encaja; si no, overlay local).
   Se parsea `RUTAS_EXTRA` igual que en el listado actual.
5. **Acciones:** si `ESTADO === 'pendiente'`, Aprobar (con observación opcional)
   y Rechazar (observación obligatoria). Se reutilizan
   `POST /api/retos/admin/evidencias/:id_evidencia/aprobar|rechazar`. Tras la
   acción se actualiza el estado local y se muestra feedback; el listado se
   refresca al volver.

### API `GET /api/retos/admin/evidencias/:id` (nueva, admin)

- Misma consulta y forma que un elemento de `adminEvidencias`, con
  `WHERE e.ID_EVIDENCIA = ?`: `ID_EVIDENCIA`, `TIPO`, `RUTA`, `RUTAS_EXTRA`,
  `CANTIDAD`, `ESTADO`, `OBSERVACION`, `FECHA_SUBIDA`, `ID_RETO_USUARIO`,
  `ID_USUARIO`, `USUARIO_NOMBRE`, `USUARIO_APELLIDO`, `USUARIO_EMAIL`,
  `RETO_TITULO`, `RETO_DESCRIPCION`, `PROGRESO`, `META_VALOR`, `META_TIPO`.
- 404 `{ ok: false, msg: "Evidencia no encontrada" }` si no existe.
- Ruta en `backend/routes/retoRoutes.js` con `esAdmin`, antes de las rutas POST
  de aprobar/rechazar.

## 5. Devoluciones y reembolsos

### Renombre

- `frontend/src/admin/AdminNavbar.tsx`: label del sidebar
  “Devoluciones” → “Devoluciones y reembolsos”.
- `frontend/src/admin/AdminDashboard.tsx`: KPI “Devoluciones por procesar” →
  “Devoluciones y reembolsos” (el valor sigue siendo el contador de pendientes).
- `frontend/src/admin/AdminDevoluciones.tsx`: título, breadcrumb y textos
  alineados a “Devoluciones y reembolsos” (el `<h1>` ya usa ese nombre).
- CSS: permitir que el label largo del sidebar envuelva en dos líneas sin
  desbordar (`white-space: normal; line-height: 1.15`) y revisar el modo móvil.
- Actualizar pruebas y cualquier etiqueta accesible que diga “Devoluciones”.

### Regla de visibilidad para el admin

Una devolución de producto de tienda (`PRODUCTOS.ID_VENDEDOR IS NOT NULL`) solo
es visible para el admin cuando:

- está `ESCALADA` (el vendedor la escaló a JADDA), o
- está cerrada (`APROBADA` o `RECHAZADA`), como historial de solo lectura.

Las de producto JADDA (`ID_VENDEDOR IS NULL`) se ven siempre. Las de tienda en
`SOLICITADA` o `MAS_PRUEBAS` quedan ocultas mientras el vendedor las gestiona.

Helper nuevo `backend/utils/devolucionesVisibilidad.js`:

```js
const ESTADOS_CERRADOS = ['APROBADA', 'RECHAZADA'];
const SQL_DEVOLUCION_VISIBLE_ADMIN =
  "(p.ID_VENDEDOR IS NULL OR d.ESTADO IN ('ESCALADA', 'APROBADA', 'RECHAZADA'))";

function esVisibleParaAdmin({ idVendedor, estado }) {
  return idVendedor == null || estado === 'ESCALADA' || ESTADOS_CERRADOS.includes(estado);
}
```

Se aplica en los tres lugares que deben coincidir:

1. `GET /api/devoluciones/admin` (`devolucionController.todas`): añadir
   `WHERE ${SQL_DEVOLUCION_VISIBLE_ADMIN}`.
2. Badge `devoluciones` de `GET /api/admin/pendientes`: contar con
   `JOIN PRODUCTOS p ON p.ID = d.ID_PRODUCTO` y la misma condición, además del
   filtro de estados pendientes (`SOLICITADA`, `MAS_PRUEBAS`, `ESCALADA`).
3. KPI `devolucionesPend` del dashboard: misma consulta y condición.

El badge `chats` (`devoluciones ESTADO = 'ESCALADA'`) no cambia: ya cuenta solo
lo escalado.

En `devolucionController.todas` se añade también
`LEFT JOIN VENDEDORES vd ON p.ID_VENDEDOR = vd.ID_VENDEDOR` y
`vd.NOMBRE_EMPRESA AS VENDEDOR_NOMBRE`, para mostrar el origen en el modal.

### Modal de devoluciones (sigue siendo modal)

- Reemplazar el bloque `.au-modal-hero` por `EncabezadoDetalle` en variante
  `compacto`: avatar/iniciales, nombre, `@usuario · email`, badges de tipo
  (devolución/reembolso), estado y origen (`JADDA` o tienda).
- Mantener el cuerpo actual: producto, motivo, descripción, evidencias, venta,
  pago, envío y chat.
- **Cerrada (`APROBADA`/`RECHAZADA`):** banner de historial de solo lectura con
  fecha de procesamiento y observación. No se muestran botones de aprobar,
  rechazar ni pedir más pruebas.
- **Escalada:** badge “Escalada a JADDA” y se conservan las acciones de revisión.
- **JADDA pendiente:** acciones normales.
- Nota breve en el listado: “Las devoluciones de tiendas aparecen cuando el
  vendedor las escala o las cierra.”
- El filtro de estado existente permite ver el historial cerrado.

## 6. Reportes con alcance (Excel/PDF)

### Modal de descarga

Los botones Excel/PDF de `AdminReportes.tsx` dejan de descargar directo y abren
`frontend/src/admin/ModalDescargaReporte.tsx`:

- Formato según el botón pulsado (Excel o PDF).
- Rango desde/hasta precargado con el rango actual de la página; validación
  `desde <= hasta`.
- Alcance con radios:
  - **Todo el catálogo** (por defecto): pedidos completos; el importe usa el
    total del pedido, que incluye envío.
  - **Solo JADDA:** solo líneas de productos JADDA (`ID_VENDEDOR IS NULL`); el
    importe suma subtotales de esas líneas y **no** incluye envío.
  - **Una tienda:** select de tiendas; solo líneas de esa tienda; importe sin
    envío.
- El select se llena con `GET /api/admin/reportes/tiendas`
  (`ID_VENDEDOR`, `NOMBRE_EMPRESA`, `ESTADO`; todas las tiendas, activas
  primero). Si no hay tiendas, la opción queda deshabilitada.
- **Conteo en vivo:** al abrir y cada vez que cambian fechas, alcance o tienda,
  el modal consulta `GET /api/admin/reportes/resumen` y muestra:
  “Se incluirán: N órdenes · M unidades · $X”. Debe invalidar respuestas viejas
  (AbortController o id de petición) y mostrar carga/error sin bloquear el modal.
- Botones “Cancelar” y “Descargar Excel/PDF”. El modal se cierra **solo** si la
  descarga fue exitosa; si falla, queda abierto para reintentar.
- Accesibilidad: `role="dialog"`, `aria-modal`, foco inicial, cierre con Escape
  y click en overlay (salvo mientras descarga).

`frontend/src/utils/reportes.tsx`:

- `descargarReporte` devuelve `Promise<boolean>` (`true` éxito, `false` error).
- Nuevo parámetro opcional `sufijo?: string` para el nombre del archivo:
  `${prefijo}_${desde}_a_${hasta}_${sufijo}.xlsx|pdf`.
- Nuevo parámetro opcional `detalle?: string` para el texto de éxito
  (por ejemplo “Solo JADDA”).
- Los usos actuales del vendedor siguen funcionando sin cambios.

### Endpoints

- `GET /api/admin/reportes/tiendas` (admin, rate limit 60):
  ```sql
  SELECT ID_VENDEDOR, NOMBRE_EMPRESA, ESTADO
  FROM VENDEDORES
  ORDER BY (ESTADO = 'ACTIVO') DESC, NOMBRE_EMPRESA ASC
  ```
- `GET /api/admin/reportes/resumen?desde&hasta&alcance&tienda` (admin, rate
  limit 60): devuelve `{ desde, hasta, alcance: { tipo, idVendedor, etiqueta,
  sufijo }, ordenes, unidades, importe }` para el conteo del modal. Solo
  órdenes no canceladas.
- `GET /api/admin/reportes/excel|pdf` aceptan `alcance` (`todo` por defecto,
  `jadda`, `tienda`) y `tienda` (obligatorio si `alcance=tienda`).
  - Alcance inválido o tienda inexistente → 400 con
    `{ ok: false, msg: "Alcance de reporte inválido" }`.
  - `Content-Disposition` incluye el sufijo: `reporte-jadda_<desde>_a_<hasta>_<sufijo>.xlsx|pdf`
    (`todo`, `jadda`, `tienda-<id>`).

### Semántica del alcance

| Alcance | Órdenes incluidas | Unidades | Importe | Envío |
|---|---|---|---|---|
| `todo` | todas las del rango con líneas | todas | `VENTAS.TOTAL` | incluido |
| `jadda` | las que tengan al menos una línea JADDA | solo JADDA | suma de `DETALLE_VENTAS.SUBTOTAL` JADDA | no |
| `tienda` | las que tengan al menos una línea de la tienda | solo tienda | suma de `DETALLE_VENTAS.SUBTOTAL` de la tienda | no |

Reglas:

- `totalOrdenes` = órdenes distintas no canceladas del alcance.
- `totalIngresos` = suma de `IMPORTE` de esas órdenes.
- `totalUnidades` = suma de cantidades de las líneas del alcance.
- `ticketPromedio` = ingresos / órdenes.
- Las órdenes `CANCELADA` no suman ingresos, unidades, serie ni ticket, pero
  siguen apareciendo como fila marcada para el conteo de canceladas (solo si
  tienen líneas del alcance).
- Los alcances por origen **no son sumables contra “Todo”**: JADDA + tiendas
  da el subtotal de productos; “Todo” además incluye el envío.
- `GET /api/admin/reportes/resumen` usa exactamente la misma regla; el conteo
  del modal y la descarga deben coincidir.

### `backend/utils/reporteDatos.js`

- Nuevo `backend/utils/alcanceReporte.js`:
  - `resolverAlcance(query)` → `{ tipo, idVendedor, etiqueta, sufijo }` o
    `{ error }`. Default `todo`; `alcance` inválido o `tienda` sin id válido →
    error 400.
  - `condicionAlcance(alcance, alias = 'p')` → fragmento SQL y params
    (`1=1`, `p.ID_VENDEDOR IS NULL`, `p.ID_VENDEDOR = ?`).
  - `etiquetaAlcance` / `sufijoAlcance` para Excel, PDF y nombre de archivo.
- `obtenerDatosReporte(query)`:
  - Resuelve rango y alcance; si `tienda`, consulta `NOMBRE_EMPRESA` y arma la
    etiqueta `Tienda: <nombre>`; si no existe, error 404.
  - **Ventas a nivel de pedido** (una fila por `ID_VENTA`):
    ```sql
    SELECT v.ID_VENTA, DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d') AS FECHA,
           COALESCE(u.NOMBRE_USUARIO, '(sin cuenta)') AS CLIENTE,
           COALESCE(mp.NOMBRE_METODO, '—') AS METODO,
           v.ESTADO,
           SUM(dv.CANTIDAD) AS ARTICULOS,
           <importe> AS IMPORTE,
           v.TOTAL AS TOTAL
    FROM VENTAS v
    JOIN DETALLE_VENTAS dv ON dv.ID_VENTA = v.ID_VENTA
    JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
    LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
    LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
    WHERE v.FECHA_VENTA BETWEEN ? AND ? AND <condición de alcance>
    GROUP BY v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO,
             u.NOMBRE_USUARIO, mp.NOMBRE_METODO
    ORDER BY v.FECHA_VENTA DESC
    ```
    `<importe>` = `v.TOTAL` para `todo`; `SUM(dv.SUBTOTAL)` para `jadda`/`tienda`.
    Se conserva `TOTAL` con el total completo del pedido para no romper
    consumidores y para la columna “Total pedido”.
  - **Resumen:** se calcula en JS desde las filas no canceladas; `totalIngresos`
    suma `IMPORTE`, no `TOTAL`.
  - **Serie:** se construye en JS agrupando las filas no canceladas por `FECHA`
    (órdenes, `IMPORTE`, unidades) y se cruza con los usuarios nuevos. Se
    elimina el JOIN actual con `DETALLE_VENTAS` que multiplica `v.TOTAL` por
    cada línea y sobrecuenta ingresos.
  - **Más vendidos:** misma consulta actual + condición de alcance; ingresos
    por `SUM(dv.SUBTOTAL)`. Para `jadda`, `p.ID_VENDEDOR IS NULL`; para tienda,
    `p.ID_VENDEDOR = ?`.
  - **Vendedores:** para `todo`, la consulta actual corregida; para `tienda`,
    solo esa tienda; para `jadda`, arreglo vacío (no aplica). Corregir el
    `LEFT JOIN VENTAS` actual para que unidades/ingresos de ventas canceladas
    no se cuelen: usar `SUM(CASE WHEN v.ID_VENTA IS NOT NULL THEN dv.CANTIDAD ELSE 0 END)`
    y lo mismo con `dv.SUBTOTAL`.
  - **Usuarios:** se mantiene como registros nuevos del rango y **no depende del
    alcance** (es un reporte de registros, no de ventas). El Excel/PDF lo
    etiqueta como “Usuarios registrados (no depende del alcance)”.
  - Devuelve `alcance: { tipo, idVendedor, etiqueta, sufijo }`.
- `obtenerResumenReporte(query)`:
  - Usa la misma resolución y la misma subconsulta de pedidos, agregando
    `COUNT(*)`, `SUM(IMPORTE)`, `SUM(ARTICULOS)` para el modal.
  - No ejecuta las consultas de usuarios/vendedores/serie.

### Excel (`backend/utils/reporteExcel.js`)

- Hoja “Ventas”:
  - Columna G pasa a “Importe del alcance COP” y usa `v.IMPORTE`.
  - Nueva columna H “Total pedido COP” con `v.TOTAL`.
  - `estiloHeader` cubre 8 columnas; `numFmt` de moneda en G y H.
  - Las fórmulas de Resumen y Gráficas siguen apuntando a G: no se reordena la
    columna de ingresos.
- Hoja “Resumen”:
  - B3 añade `· Alcance: <etiqueta>`.
  - B4 (libre antes de los KPIs) lleva la nota: “Todo el catálogo usa el total
    del pedido (incluye envío). Solo JADDA o una tienda suman únicamente sus
    líneas y no incluyen envío.”
- Hoja “Más Vendidos”: refleja el alcance.
- Hoja “Vendedores”: para `jadda`, nota “El alcance Solo JADDA no incluye
  tiendas de vendedores”; para `tienda`, solo esa tienda.
- Hoja “Usuarios”: nota “Registros nuevos del rango; no depende del alcance”.
- Metadatos del workbook: título/descripción con el alcance.

### PDF (`backend/utils/reportePdf.js`)

- Encabezado: `Del <desde> al <hasta> · <etiqueta de alcance>`.
- Bajo las canceladas, nota sobre el envío y el alcance.
- Resumen, serie, más vendidos, usuarios y vendedores usan los datos ya
  filtrados de `obtenerDatosReporte`; si no hay vendedores en el alcance, se
  muestra “Sin tiendas en este alcance”.
- `info.Title` incluye el alcance.
- El controlador arma el nombre del archivo con el sufijo.

## 7. Estilos

- Nuevo bloque en `frontend/src/css/adminDashboard.css`:
  `/* ===== Páginas de detalle admin (adp-) ===== */`.
- Clases: `adp-header`, `adp-header--compacto`, `adp-header-icon`,
  `adp-header-info`, `adp-header-badges`, `adp-header-actions`, `adp-card`,
  `adp-section`, `adp-grid`, `adp-kpi`, `adp-tabla`, `adp-compra`,
  `adp-compra-head`, `adp-compra-body`, `adp-items`, `adp-envio`, `adp-pago`,
  `adp-evidencia-grid`, `adp-evidencia-media`, `adp-readonly`, `adp-empty`,
  `adp-modal-head`.
- Reutilizar Bootstrap y las clases existentes (`au-header-col`, `ad-badge-*`,
  `ap-tabla`, `evidencia-overlay`, `au-modal`) donde encajen; no duplicar.
- Las páginas nuevas no usan `.au-modal-hero`. El modal de devoluciones usa
  `.adp-modal-head` dentro de su shell actual.
- Responsive: grids de 1 columna en móvil, tablas con scroll horizontal,
  header apilado y botones a ancho completo cuando haga falta.

## 8. Pruebas

### Backend

- `tests/backend/utils/alcanceReporte.test.js` (nuevo): default `todo`,
  `jadda`, `tienda` válida, alcance inválido, tienda sin id, etiquetas y
  sufijos.
- `tests/backend/utils/reporteDatos.test.js` (actualizar):
  - `todo`: `IMPORTE = TOTAL`, todas las unidades.
  - `jadda`: solo líneas JADDA; pedido mixto conserva `TOTAL` completo pero
    `IMPORTE` parcial.
  - `tienda`: solo líneas de esa tienda; pedidos sin líneas de la tienda no
    aparecen.
  - Serie sin doble conteo: un pedido con 3 líneas suma su importe una vez.
  - Canceladas fuera de resumen/serie, presentes en `ventas`.
  - Más vendidos y vendedores filtrados por alcance; canceladas no suman en
    vendedores.
  - Alcance inválido/tienda inexistente → error con `statusCode` 400/404.
- `tests/backend/unitarios/devolucionController.test.js` (nuevo o ampliado):
  `todas` incluye la condición de visibilidad y `VENDEDOR_NOMBRE`; una
  devolución de tienda en `SOLICITADA`/`MAS_PRUEBAS` no aparece; `ESCALADA`,
  `APROBADA` y `RECHAZADA` sí.
- `tests/backend/unitarios/adminController.test.js` (ampliar): dashboard y
  pendientes aplican la misma condición; detalle de usuario devuelve `items`,
  datos de envío y no resetea compras del vendedor.
- `tests/backend/unitarios/vendedorController.test.js` (ampliar): detalle de
  solicitud 404, pendiente sin vendedor y aprobada con productos/métricas.
- `tests/backend/unitarios/retoController.test.js` (ampliar): evidencia por id
  200 y 404.
- Pruebas de controladores de descarga: 400 por alcance inválido y nombre de
  archivo con sufijo.

### Frontend

- `AdminUsuarios.test.tsx`: el clic en “Ver usuario” navega a
  `/admin/usuarios/:id` (sonda de ruta), ya no abre modal.
- `DetalleUsuarioAdmin.test.tsx` (nuevo): encabezado, compras colapsadas,
  expansión con líneas/precios/cantidades, pago, envío, estado y métricas de
  vendedor sin ocultar compras.
- `AdminVendedores.test.tsx`: “Gestionar” navega; ya no carga el catálogo completo
  desde el listado.
- `DetalleVendedorAdmin.test.tsx` (nuevo): productos, unidades e ingresos;
  ventas recientes; aprobar/rechazar solo si pendiente; 404.
- `AdminRetos.test.tsx`: “Ver” navega; se elimina el modal.
- `DetalleEvidenciaAdmin.test.tsx` (nuevo): evidencia completa (1 imagen,
  varias, video), progreso/meta, aprobar/rechazar y estado.
- `AdminDevoluciones.test.tsx`: encabezado claro del modal, devolución cerrada
  sin acciones y con banner de solo lectura, escalada con acciones, origen
  visible.
- `AdminReportes.test.tsx`: abre modal, selecciona alcance, consulta el resumen,
  descarga con `alcance`/`tienda` en la URL, nombre con sufijo, cierra solo al
  éxito y permanece abierto al fallar.
- `tests/frontend/utils/reportes.test.tsx`: retorno booleano y sufijo del
  archivo.
- `AdminNavbar.test.tsx` y `AdminDashboard.test.tsx`: nuevo nombre
  “Devoluciones y reembolsos”.
- `tests/frontend/admin/msw-handlers-admin.ts`: añadir handlers de tiendas,
  resumen, detalle de solicitud, evidencia individual y ampliar el detalle de
  usuario con `items`/envío.

## 9. Riesgos y notas para el builder

- **Envío:** la semántica propuesta (Todo incluye envío; JADDA/tienda no) debe
  quedar aprobada antes de implementar. Está documentada en la UI, el Excel y el
  PDF para que no se interprete como un error de suma.
- **Fórmulas del Excel:** la columna G debe seguir siendo la de ingresos para no
  romper `SUMIF`/`COUNTIFS` de Resumen y Gráficas. La columna nueva va al final.
- **MySQL `ONLY_FULL_GROUP_BY`:** agrupar por todas las columnas no agregadas
  seleccionadas (o confiar en la dependencia funcional de la PK, pero ser
  explícito es más seguro).
- **Canceladas:** se conservan como filas para el conteo, pero nunca suman.
- **Pedidos mixtos:** una fila por pedido; `IMPORTE` puede ser menor que
  `TOTAL`. No volver a sumar `v.TOTAL` por línea.
- **Vendedores:** corregir el `LEFT JOIN VENTAS` para que las canceladas no
  aporten unidades/ingresos.
- **Pruebas de `reporteDatos`:** los mocks seleccionan consultas por prefijo SQL;
  al cambiar la consulta de ventas y la serie, actualizar los prefijos y los
  casos.
- **Límite de compras:** el detalle de usuario trae hasta 200 órdenes; la
  consulta de líneas usa placeholders. Si el número de ids crece, dividir en
  lotes.
- **Rendimiento del modal:** el resumen se consulta con debounce y se descartan
  respuestas viejas; no bloquear la descarga mientras se calcula.
- **Visibilidad de devoluciones:** es una regla de producto, no un fallo. El
  vendedor sigue siendo responsable hasta escalar o cerrar. El admin no puede
  intervenir antes de la escalada.
- **Rutas:** el detalle de vendedor se keyea por `ID_SOLICITUD`; no cambiarlo a
  `ID_VENDEDOR` sin ajustar el listado y los enlaces.
- **Renombre largo:** verificar el sidebar en escritorio y móvil; permitir dos
  líneas sin romper la alineación de iconos/badges.
- **Compatibilidad:** conservar los campos actuales de las respuestas
  (`TOTAL`, `ventas`, `stats.totalCompras`, etc.) para no romper otras pantallas.
- **Seguridad:** todos los endpoints nuevos son `esAdmin`; rate limit en
  descargas, resumen, tiendas y detalles. No exponer rutas absolutas del disco
  ni datos de otras tiendas.
- **Sin migraciones:** no hay cambios de esquema.

## 10. Decisiones aprobadas

1. **Envío:** “Todo” usa el total del pedido (incluye envío); “Solo JADDA” y
   “una tienda” suman solo subtotales de sus líneas (sin envío).
2. **Filas del reporte:** una fila por pedido con `IMPORTE` del alcance y
   `TOTAL`/`TOTAL_PEDIDO` completo; las canceladas se listan pero no suman.
3. **Usuarios en el reporte:** la hoja/sección de usuarios sigue siendo los
   registros nuevos del rango y no depende del alcance.
4. **Detalle de vendedor:** la ruta usa `ID_SOLICITUD` y muestra la solicitud
   aunque todavía no haya tienda aprobada.
5. **Devoluciones de tienda:** ocultas al admin en `SOLICITADA`/`MAS_PRUEBAS`;
   visibles al escalar o cerrar; las cerradas son historial de solo lectura.
6. **Conteo del modal:** se obtiene de un endpoint de resumen dedicado, con la
   misma regla que la descarga.

Estas decisiones quedaron aprobadas el 2026-11-22. El plan de implementación
por tareas (TDD, una tarea por página/endpoint) vive en
`docs/superpowers/plans/2026-11-22-admin-detalles-devoluciones-reportes.md`.
