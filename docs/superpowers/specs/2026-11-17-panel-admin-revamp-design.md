# Diseño — Rediseño del panel admin (14 puntos)

Fecha: 2026-11-17 · Estado: acordado en conversación, pendiente builder check.
Rama de trabajo: nueva feature branch desde `Develop` (a definir al planear).

## Intención y por qué

El panel admin creció por parches: hay modales que se quedan cortos para la
información que muestran, dos canales duplicados para chats (página + widget
flotante), badges del sidebar que cuentan cosas que no se corresponden con lo
que la página muestra y no se refrescan, pantallas con layouts distintos entre
sí, una página de categorías que sobra, reportes con detalles visuales feos
(gráficas de Excel como barras de texto, hojas en blanco en el PDF), un panel
de notificaciones que se sale de la pantalla, y una acción que rompe la regla
de negocio (el admin cambia a mano el estado de pago de una orden, que debe
derivar de Wompi).

Esta iteración corrige todo eso. El usuario pidió exactamente estos 14 puntos
(ver "Alcance"); nada más entra.

## Alcance

1. Creación de producto: quitar el input de URL pegada (Cloudinary) en `SubirImagenes`.
2. Órdenes: cards KPI (pendientes/en camino/entregadas/canceladas) que al click
   filtran de verdad y se ve el efecto.
3. Órdenes: el admin ya no puede cambiar el estado de la orden; se deriva del
   flujo de pago (Wompi) y del envío.
4. Usuarios: "ver usuario" pasa de modal a página dedicada con TODA la info.
5. Consistencia visual: todas las pantallas admin con la misma estructura y
   posiciones.
6. Retos: "ver" pasa de modal a página dedicada con la evidencia completa.
7. Vendedores: "gestionar" pasa a "ver más" y a página dedicada con toda la
   info (solicitud, empresa, productos del vendedor, reseñas).
8. Eliminar la página de Categorías del admin.
9. Reportes: mismo look visual del Dashboard.
10. Reportes: arreglar Excel y PDF (gráficas del Excel, hojas en blanco del
    PDF, revisión general).
11. Notificaciones: el panel debe caber completo en la pantalla.
12. Cloudinary: rutas correctas para imágenes nuevas (banners a carpeta propia).
13. Eliminar la página de chats; queda solo el widget flotante.
14. Sidebar: badges correctos (solo lo pendiente de revisar, desaparecen al
    entrar a la sección).

## No-goals

- **Móvil (Expo)** no se toca: su chat y sus pantallas quedan igual.
- **Reglas de pago Wompi**: no se cambia nada del flujo de pagos; solo se
  elimina la intervención manual del **admin y del vendedor** sobre
  `VENTAS.ESTADO` (queda la máquina automática descrita en el punto 3).
- **CRUD/acciones sobre usuarios** (cambiar rol, desactivar, reset password):
  fuera de alcance; el detalle de usuario sigue siendo lectura.
- **Migrar imágenes antiguas en Cloudinary**: solo las nuevas van a la carpeta
  nueva; nada se mueve retroactivamente.
- **Tienda pública**: solo cambia el badge de chats del navbar público (abre el
  widget en vez de navegar a /chats).

## Decisiones por punto

### 1. SubirImagenes sin URL pegada
Quitar la fila "pega una URL de Cloudinary" (input + botón Agregar) y el icono
FaLink. Queda solo el botón de archivos del PC. Actualizar
`tests/frontend/admin/SubirImagenes.test.tsx` (hay tests del input de URL).

### 2. Cards KPI de Órdenes
Hoy el click aplica el filtro pero "Entregadas/Canceladas" caen en el grupo
"Procesadas" que está colapsado por defecto → parece que no pasa nada.
Arreglo:
- Las cards filtran con estado visual **activo** (card marcada cuando su
  filtro está aplicado; click de nuevo desactiva y vuelve a "todas").
- Al filtrar, **abrir automáticamente el grupo** que contenga resultados y
  colapsar el otro, para que el efecto sea visible.
- La card "Total" limpia los filtros.
- **Semántica alineada a la máquina de estados** (CALL): hoy "Pendientes"
  cuenta `ESTADO='PENDIENTE'`, estado que las ventas nuevas jamás tienen
  (nacen `PENDIENTE_PAGO`), por eso la card queda en ~0. Queda: Pendientes =
  `PENDIENTE_PAGO` (+ `PENDIENTE` legacy), En camino = envío `EN_CAMINO`,
  Entregadas = envío `ENTREGADO`, Canceladas = venta `CANCELADA` **o** envío
  `CANCELADO`. Los números visibles cambian: es el arreglo mismo.

### 3. Estado de la orden automático
- Frontend: el select "Estado de la orden" se reemplaza por un badge de solo
  lectura (mismo estilo `ao-badge-venta`).
- Backend: **eliminar** `PUT /api/admin/compras/:id/estado` (route + handler
  `actualizarEstadoCompra`). Actualizar `tests/backend/unitarios/adminController.test.js`.
- Máquina de estados de `VENTAS.ESTADO` (solo transiciones automáticas):
  - `PENDIENTE_PAGO → CONFIRMADA`: webhook/confirmación Wompi (ya existe).
  - `PENDIENTE_PAGO → CANCELADA`: vencimiento del job de pagos (ya existe).
  - `CONFIRMADA → COMPLETADA`: cuando el envío se marca `ENTREGADO`
    (nuevo: en `actualizarEstadoEnvio` de adminController y el equivalente del
    vendedor; disparar la notificación/correo ya existente de estadoPedido).
- **"Cancelar envío" pasa a cancelar la venta**: al marcar envío `CANCELADO`
  sobre una venta pagada se invoca el flujo existente
  `cancelarVentaYReembolsar` (hoy solo llegaba desde el endpoint de estado que
  se elimina). Sin ese cable, el admin perdería toda vía de cancelar un
  pedido no-vendedor. El botón "Cancelar envío" de la UI se queda igual; solo
  cambia lo que dispara. Detalle sensible de dinero: CALL documentado abajo.
- El admin sigue controlando el **estado de envío** (stepper) como hoy.
- **También el panel vendedor (confirmado por el cliente)**: se elimina el
  select manual de estado de `VendedorVentas.tsx` y el endpoint
  `PUT /api/vendedor/ventas/:id/estado`. La misma máquina automática aplica a
  las ventas del vendedor; el vendedor sigue controlando su **estado de
  envío**. Afecta `vendedorController.test.js` además de los tests de admin.
- **Rider del cliente**: las superficies del vendedor que toque esta
  iteración deben **quedar parecidas al admin** (mismo patrón visual: badge de
  estado de solo lectura en vez de select, misma estructura de pantalla),
  "obviamente con sus limitaciones" — el vendedor solo ve sus ventas y sus
  datos. No entra una renovación visual completa del panel vendedor: solo las
  pantallas que esta iteración toca (VendedorVentas, y lo que corresponda en
  el menú).

### 4. Página de usuario (`/admin/usuarios/:id`)
- Nueva página con el mismo header estándar (Volver + Breadcrumb + títulos).
- Reusa `GET /api/admin/usuarios/:id` (ya trae usuario, direcciones, métodos,
  stats, vendedor, ventas, compras, retos) — el contenido del modal actual pasa
  tal cual a secciones de página completa (hero + info personal + compras +
  retos + empresa si vendedor + ventas del vendedor + direcciones + métodos).
- La fila de la lista de usuarios pasa de "Ver usuario" (modal) a navegar a la
  página.
- La página vive en `frontend/src/admin/` (p. ej. `DetalleUsuarioAdmin.tsx`) y
  el contenido del modal se reutiliza extrayéndolo del componente actual.

### 5. Consistencia visual admin
Auditoría y normalización de TODAS las páginas admin:
- Mismo contenedor y ancho (un solo patrón; hoy mezclan `container` Bootstrap,
  `maxWidth: 1280`, `maxWidth: 1200`, y Vendedores no tiene contenedor).
- Mismo bloque header en la misma posición: botón "Volver al inicio" +
  `Breadcrumb` + títulos (h1/p).
- Mismas posiciones para toolbar/filtros/tabla.
- Esto se verifica visualmente página por página al final (checklist en el plan).

### 6. Página de evidencia de reto (`/admin/retos/:id`)
- La acción "ver" navega a la página; el modal se elimina.
- Contenido: título del reto, usuario, estado, progreso/meta, observación,
  descripción, y el material completo (grid de imágenes/videos como hoy).
- Acciones aprobar/rechazar solo si está pendiente (mismo flujo actual; tras
  la acción, volver al listado con feedback).
- Backend: añadir `GET /api/retos/admin/evidencias/:id` (hoy solo existe la
  lista; el detalle por id evita traer 200 registros para mostrar uno).

### 7. Página de vendedor (`/admin/vendedores/:id`)
- El botón "Gestionar" pasa a "Ver más" y navega a la página (adiós modal).
- Contenido: solicitud completa (solicitante, empresa, ubicación,
  observación del admin), y si ya es vendedor (VENDEDOR_ID): productos a la
  venta (imagen, nombre, categoría, estado publicación, stock, precio) +
  **reseñas de sus productos** + stats del vendedor.
- Acciones aprobar/rechazar solo si PENDIENTE (observación obligatoria al
  rechazar, igual que hoy).
- Backend: añadir `GET /api/vendedor/admin/:id` con solicitud + productos
  filtrados por `ID_VENDEDOR` en SQL + reseñas de sus productos + métricas.
  (Hoy la página de vendedor trae el catálogo completo y filtra en cliente:
  se corrige con el endpoint nuevo.)

### 8. Eliminar página de Categorías
- Borrar `AdminCategorias.tsx`, la ruta `/admin/categorias`, el lazy import y
  la entrada del sidebar.
- Backend: eliminar los 2 endpoints admin de edición/borrado (`PUT/DELETE
  /api/productos/categorias/:id` en productoRoutes + handlers en
  productoController). El `GET /api/productos/categorias` público se queda
  (catálogo, formularios de producto y vendedor lo usan).
- **CALL**: el `POST /api/productos/categorias` SE CONSERVA — lo usa
  `AdminProductos.tsx` para crear una categoría inline al asignarla a un
  producto (flujo distinto a la página que se elimina). Solo se van la página
  y la edición/borrado de categorías.

### 9. Reportes con look del Dashboard
- Quitar los estilos Bootstrap ad-hoc (bg-white/btn-danger/inline styles) y
  re-usar las clases del Dashboard en `adminDashboard.css` (identidad navy
  #002244 / rojo #e73737): tarjetas KPI, toolbar, tabs y barras con el mismo
  lenguaje visual que el resto del panel.

### 10. Excel y PDF de reportes
- **Excel — gráficas (decisión del cliente: Opción 1)**: en la hoja "Graficas"
  eliminar las columnas de fórmulas `REPT("|"…)`/`REPT("▮"…)`; quedan las
  barras nativas **dataBar** de Excel sobre los valores, con ancho de columnas
  y cabeceras arregladas. Sin dependencias nuevas.
- **PDF**: re-auditar la paginación para eliminar las hojas en blanco (cálculo
  de saltos) y revisión general del documento (secciones vacías con datos
  vacíos, márgenes, pie de página).
- **Granularidad**: pasar `granularidad` del panel a Excel y PDF (hoy la
  ignoran y siempre salen por día) — inconsistencia detectada en la revisión;
  el builder la alinea con la serie del panel.
- Revisión general de `reporteExcel.js`, `reportePdf.js` y `reporteDatos.js`
  (incluye el bucle con cursor mutado en `reporteDatos.js`, patrón que ya se
  corrigió en `adminController.js`).

### 11. Panel de notificaciones cabe en pantalla
- `.bell-panel` (tema oscuro del sidebar): reposicionar responsive —
  `position: fixed` anclado al viewport en pantallas chicas, ancho
  `min(360px, 100vw - 24px)`, altura `max-height` con margen de seguridad y
  scroll interno (ya lo tiene `bell-panel-body`); nunca debe quedar cortado
  por el borde derecho/inferior.
- Verificar también el tema claro del navbar público.

### 12. Carpetas de Cloudinary para imágenes nuevas
- Hoy los banners suben a `jadda/productos/nuevos` mezclados con imágenes de
  productos nuevos (ModalBanners reusa `POST /api/productos/imagenes`).
- Cambio: `POST /api/productos/imagenes` acepta `tipo: "banner"` (validado)
  y sube a **`jadda/banners`** (fallback local `uploads/banners/` → URL
  `/images/productos/banners/...`). Productos nuevos siguen en
  `jadda/productos/nuevos`.
- ModalBanners envía `tipo: "banner"`. Sin migración de imágenes existentes.

### 13. Eliminar página de chats (queda el widget flotante)
- Borrar `frontend/src/pages/Chats.tsx`, las rutas `/chats`, `/admin/chats`,
  `/vendedor/chats`, la exclusión `esPaginaChats` en App.tsx y las entradas
  "Chats" del **AdminNavbar y del VendedorNavbar** (CALL: el menú del
  vendedor también llevaba a la página que se borra — quedaría un 404; el
  widget flotante cubre los 3 roles), con su badge `chats` de
  `/api/admin/pendientes`.
- El widget flotante (FloatingChat + ChatWidget) ya se muestra en todas las
  páginas; gana la capacidad de **abrir un chat específico** por id (contexto
  ChatWidget: `abrirChat(id)`).
- **Notificaciones antiguas guardadas con RUTA `/admin/chats?chat=X` (y
  variantes)**: el click en la campana intercepta esas rutas y abre el widget
  con ese chat en la página actual. Sin migración de datos en BD.
- `AdminDevoluciones` (hoy navega a `/admin/chats?chat=…` para abrir el chat
  escalado) pasa a abrir el widget.
- Navbar público: el badge de chats deja de navegar a `/chats` y abre el
  widget (o desaparece; decide el builder por consistencia — el widget ya
  muestra su propio badge).
- Backend: `rutaSegunDestinatario` sigue generando las rutas viejas (los
  registros viejos de NOTIFICACIONES las usan); el frontend es quien
  intercepta. `/api/chat/*` no cambia.
- El campo `chats` de `/api/admin/pendientes` queda sin consumidor: se elimina
  del response y del estado del AdminNavbar.

### 14. Sidebar (badges correctos)
Síntoma reportado: badge de "2" en Productos sin nada nuevo, y el número no
desaparece al entrar. Acordado:
- **Desaparecer al instante** cuando el admin entra a la sección (ocultar
  localmente ese badge al cambiar de ruta, sin esperar al fetch).
- **Refrescar** los conteos: al montar, al cambiar de ruta, cada 60 s y tras
  cada acción de moderación (aprobar/rechazar producto/evidencia/solicitud/
  devolución) — las páginas avisan con un evento ligero (custom event o
  callback; decide el builder, preferir lo más simple que respete los
  patrones del repo).
- **Conteos veraces**: cada badge debe contar exactamente lo que la página
  muestra como "por revisar" (productos: `ESTADO_PUBLICACION='PENDIENTE'`;
  evidencias: `ESTADO='pendiente'`; devoluciones:
  `SOLICITADA/MAS_PRUEBAS/ESCALADA`; vendedores: solicitud `PENDIENTE`).
- **CALL**: al entrar a Productos con pendientes, se auto-aplica el filtro
  "Revisar" que ya existe en `AdminProductos` (el badge dice 2 → ves 2);
  desactivarlo es un click. Así badge y visible siempre coinciden.

## Enfoques considerados (decisiones reales)

- **Gráficas del Excel**: (1) solo dataBar nativo — ELEGIDA, limpia y sin
  dependencias; (2) quitar la hoja Graficas (el PDF ya dibuja gráficas); (3)
  imágenes incrustadas vía canvas (dependencia nueva, descartada por peso).
- **Badges**: (1) ocultar en cliente al entrar + refrescar tras acciones —
  ELEGIDA, simple y fiel al pedido; (2) marcar "visto" en backend — descartada
  por añadir estado y migración para el mismo efecto.
- El resto de los puntos no tenía alternativa razonable distinta a la
  descrita (reutilizar endpoints existentes, un solo look, eliminar lo que
  sobra).

## Riesgos / notas para el builder

- Eliminar `PUT /compras/:id/estado` rompe tests unitarios existentes:
  actualizarlos (o eliminarlos si el endpoint era su único sujeto).
- El contenido de los modales a convertir ya existe y funciona: extraer los
  bloques a componentes de página, no reescribir la lógica de fetch/acciones.
- El módulo `imagenController` valida tipo/tamaño: el nuevo `tipo: "banner"`
  pasa por la misma validación; solo cambia la carpeta.
- La maquetación de la página de usuario/reto/vendedor debe respetar el
  patrón de CSS por página con prefijo propio (CODING_STANDARDS).
- Verificar que las páginas nuevas no rompan los tests E2E
  (`tests/e2e/smoke.spec.ts`) ni los de frontend que tocan esas pantallas.
- Todo lo nuevo va con pruebas unitarias en el estilo del repo (vitest).

## Abierto al builder

- Nombres exactos de archivos/componentes/clases CSS nuevas (respetando
  prefijos por página).
- Mecanismo exacto de aviso "pendientes cambiaron" (evento vs contexto).
- Detalles de reparto visual dentro de las páginas nuevas (mientras el header
  y las posiciones sean idénticos al resto del panel).
- Si el badge de chats del navbar público se elimina o abre el widget.
