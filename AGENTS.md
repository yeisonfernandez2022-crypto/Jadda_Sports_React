## Goal
Polish UX, complete database portability with auto-setup, and align documentation to real stack.

## Constraints & Preferences
- No SQL changes by the assistant; user runs all database modifications manually.
- Build must pass TypeScript and Vite build inside Docker container (`pnpm build`).
- Docker Vite dev server may show stale parse errors; `docker restart jadda_frontend` resolves them.
- Database auto-creates tables + seeds reference data on startup via `setup.js`.
- User uses MySQL Workbench; password prompts remain unresolved.
- `.gitignore` has `mysql_data/` in root and `.env` in backend/ + frontend/.
- Class-based FontAwesome icons (`<i className="fas fa-...">`) used across ~10 files; CSS import kept.
- `.env.example` should contain placeholders, never real credentials.
- Docs structure kept unchanged: `docs/RFs/`, `docs/HUs/`, `docs/RNFs/`.

## Progress
### Done
- ResumenCompra: `limpiarFormDireccion()` clears all address fields when clicking "Agregar dirección".
- ResumenCompra: nested fragment `<>...</>` → `<div>` fix for OXC parser error.
- Catalogo variant selector modal: opens on cart icon click, fetches `GET /api/productos/:id/variantes`, color + attribute buttons filtered by color, stock display, quantity selector, confirm button, 80x80 thumbnail.
- Search improved: prefix matching `LIKE 'word%'` (was `%word%`), all query words must match.
- Related products improved: `ORDER BY RAND()`, fallback to other categories if fewer than 4.
- ProductDetailPage: `addToCart` now passes `ID_VARIANTE` (not `cantidad`); selecting attribute first then color no longer resets attribute.
- Review form in ProductDetailPage: star hover effect, comment textarea, logged-in gate, auto-name from AuthContext, avatar circle.
- Review form in CompraExitosa: product selector buttons, star hover, comment, submit, confirmation.
- Footer compact: reduced padding/margins, `margin-top: auto` via AppLayout flex column.
- FloatingCart draggable: mouse/touch drag, viewport clamped, navbar boundary, click vs drag detection.
- MiniCartMenu: position synced via `cartButtonX/Y` in CartContext, closes on click-outside.
- `backend/database/setup.js` created: 22 `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` for all reference data. Retries MySQL connection up to 10 times.
- `server.js` modified: added `require('./database/setup')` at line 9.
- `docker-compose.yml` modified: bind mount `./mysql_data` → named volume `mysql_data:`.
- READMEs created/updated: root, backend, frontend, movil.
- Mobile app reviewed: Inicio, Catalogo, Detalle Producto, Login, Registro functional. AuthContext lacks AsyncStorage persistence.
- Catalogo two carts bug fixed: removed duplicate FloatingCart/MiniCartMenu.
- Categorias slowness fixed: bg placeholder, fadeIn animation, reduced margin-top.
- Docs analyzed: 39 HUs, 39 RFs, 7 RNFs. Stack mismatches found.
- RNF-001.md: Module 1 only (Security) — separated from monolithic original.
- RNF-002.md through RNF-006.md: extracted from original RNF-001.md modules 2–6, each with proper format.
- RNF-007.md: extracted Module 7 (Documentation/Maintainability) from original.
- RNF-008.md through RNF-011.md: 4 new modules — DevOps, Mobile App, Internationalization, Error Handling.
- `docs/plan de trabajo.md` created.
- `docs/Restricciones del Proyecto.md` created.
- RF-001 through RF-012: stack/endpoints corrected (JWT → express-session, `/api/v1/...` → `/api/...`, table names to real DB schema).
- RF-013 through RF-029, RF-036, RF-039: status/endpoints aligned to real implementation; RF-027 "Parcial".
- HUs updated to match corrected RFs: statuses, acceptance criteria, endpoints, table names aligned.
- HU-002 fixed: was incorrectly containing RF-002 content; replaced with proper HU.
- HU-005 fixed: corrupted acceptance criteria content restored.
- HU-003 through HU-012, HU-013 through HU-029, HU-036, HU-039: statuses updated (Implementada/Parcial), acceptance criteria rewritten.
- Diagrams created: `docs/diagrams/arquitectura.md`, `docs/diagrams/base-de-datos.md`, `docs/diagrams/flujos.md`.
- `docs/README.md` created: index with links to all docs, state table, stack.
- `docs/plan de trabajo.md` fixed: auth stack corrected (JWT → express-session).
- `backend/README.md`: auth stack corrected (JWT removed), route table expanded to 40+ real endpoints, env vars aligned, Facebook route removed.
- `frontend/README.md`: auth stack corrected (jwt-decode → express-session cookie-based).
- `movil/README.md`: API URL reference updated to `EXPO_PUBLIC_API_URL`, status table corrections (added verificar-codigo as Funcional).
- HU-001.md: verification flow corrected — 24h link → 15min 6-digit code, removed "NN Auth" reference.
- RF-001.md: verification flow corrected — 24h → 15min, endpoint `/api/auth/verificar-codigo` → `/api/auth/confirmar`, added `/api/auth/reenviar-codigo`.
- `docs/README.md`: RNF count updated 7 → 11.
- AGENTS.md: comprehensive update with all changes from this session.
- AdminProductos: búsqueda (nombre/marca/categoría), paginación 10/pág, orden aleatorio, sticky header, scroll acotado.
- NotFound page (`frontend/src/pages/NotFound.tsx`): 404 con botón "Volver al inicio"; catch-all en App.tsx apunta a ella (antes Principal).
- ErrorBoundary (`frontend/src/components/ErrorBoundary.tsx`) + ErrorFallback (`frontend/src/pages/ErrorFallback.tsx`): página "¡Oops!" con botón Reintentar; envuelve todas las rutas.
- LoadingPage (`frontend/src/components/LoadingPage.tsx`): pantalla de carga reutilizable; usada como fallback de Suspense y en Catálogo (pantalla completa hasta que carguen productos).
- Catalogo: estado de error con botón "Reintentar" si falla el fetch de productos.
- `backend/database/setup.js`: `seedAdminUser()` crea cuenta admin en CADA arranque (incluso si las tablas ya existen). Credenciales: `ADMIN_EMAIL`/`ADMIN_PASSWORD` en .env; default `admin@jaddasports.com` / `AdminJadda2026!`, ID_ROL=1, CONFIRMADO=1.
- `backend/controllers/checkoutController.js`: total calculado 100% en servidor (ignora `totalFinal`/`descuentoAplicado` del cliente); valida cupón contra DESCUENTOS; transacción completa (BEGIN/COMMIT/ROLLBACK); rollback en catch; conexión liberada en finally. Decisión del usuario: decremento de stock + MOVIMIENTOS_STOCK REMOVIDOS temporalmente hasta que se hagan pruebas.
- `backend/middlewares/rateLimiter.js` (nuevo): limitador en memoria (ventana deslizante por IP, sin dependencias). Aplicado a login (10), registro (5), confirmar (10), recuperar-password (5), verificar-codigo (10), update-password (10), reenviar-codigo (5), contacto (5).
- `backend/controllers/authController.js`: registro valida email/nombre/password (min 8) antes de BD; login devuelve 400 si faltan campos y usa mensaje unificado "Correo o contraseña incorrectos" (anti-enumeración).
- Decisión diferida por el usuario: rutas `/api/admin/*` y CRUD de productos siguen SIN protección de rol (sin `esAdmin` middleware) hasta que exista cuenta admin funcional. `deserializeUser` en passport.js NO selecciona ID_ROL — pendiente.
- Batch UX (2026-08-02): checkout valida stock SIN decrementar (400 con mensaje por producto); envío real por departamento; rating promedio + badges de stock en cards; cancelar pedido; dirección de pedido en servidor; CompraExitosa recupera venta al refrescar; guía de tallas; recientemente vistos; newsletter; plan con días persistidos; fixes Navbar/AuthModal.
- Migración imágenes locales (2026-08-02): 44 carpetas `Producto_01..44` (3 archivos `img_1/2/3` c/u) copiadas de `Downloads\imagenes_productos` → `frontend/public/images/productos/`; URLs en BD pasan de externas a `/images/productos/Producto_NN/img_K.ext`. Producto 45 ('Balón basket oficial', duplicado del 6) ELIMINADO de seeds y de BD viva.
- `backend/database/schema.sql` (UNICO archivo SQL): esquema + seeds con 132 rutas locales (sin producto 45) + bloque final "MIGRACIÓN PARA BASES EXISTENTES" (132 UPDATEs de imágenes + 11 DELETEs del producto 45, orden FK-safe) — importable en Workbench para BD nuevas y existentes.
- `backend/database/setup.js` + `schema.sql`: bloque PRODUCTO_IMAGENES regenerado con 132 rutas locales; filas del producto 45 removidas de PRODUCTOS y PRODUCTO_VARIANTES.
- Subida de imágenes desde el PC en panel admin: `POST /api/productos/imagenes` (base64 JSON, `express.json({ limit: '25mb' })` global en server.js + límite 25mb en la ruta). Guarda en `backend/uploads/subidas/` que es bind-mount de `frontend/public/images/productos` (docker-compose: `./frontend/public/images/productos:/app/uploads`) → URL `/images/productos/subidas/<ts>-<rand>.<ext>`.
- `crearProducto` y `actualizarProducto` ahora aceptan `IMAGENES` (array de URLs, ORDEN secuencial 1..N); `URL_IMAGEN` individual sigue funcionando como fallback.
- `frontend/src/admin/SubirImagenes.tsx` (nuevo): componente reutilizable — botón "Subir imágenes del computador" (multi-archivo, accept jpg/png/webp/gif), previews con botón ✕, input "o pega una URL". Usado en AdminProductos (modal agregar) y EditarProductoAdmin (sidebar, modo edición); reemplaza el `<input type="url">`.
- Correo de checkout: helper `imagenParaCorreo()` antepone `FRONTEND_URL` (env, default `http://localhost:5173`) a rutas relativas para que las imágenes locales funcionen en el email.
- Móvil: `movil/constants/api.ts` exporta `resolverImagen(url)` (prefija `EXPO_PUBLIC_FRONT_URL`, default `http://10.2.178.124:5173`); aplicado en `movil/app/producto/[id].tsx` (imagen principal + miniaturas).
- Perfil + foto de perfil (2026-08-02): `POST /api/auth/foto` (base64 ≤10mb → `backend/uploads/perfiles/u{ID}/` → `/images/perfiles/u{id}/...`, mount nuevo en docker-compose); `Perfil.tsx` rediseñado (hero pegado al navbar, avatar con borde rojo + menú Ver foto/cargar desde navegador, modal fullscreen, dashboard de 7 tarjetas); `PerfilEditar.tsx` con botón "Subir foto desde el navegador" y sección "Información de tu cuenta" (correo, miembro desde con día, documento, botón cambiar contraseña).
- Migración automática de BD: `migrarTablasExistentes()` en setup.js aplica ALTERs idempotentes al arrancar cuando las tablas ya existen (lista `MIGRACIONES`; hoy: `ENVIOS.COSTO_ENVIO`, `DESCUENTOS.USADO`, `RETO_EVIDENCIAS`); schema.sql actualizado (la nota ya no pide ALTER manual).
- Lote UX grande (2026-08-02): navbar "Ver perfil" (antes "Miembro JADDA"); páginas de perfil pegadas al navbar (`padding-top: 0` — el offset lo da `body { padding-top: 65px }` global); foto por carpeta `u{ID_USUARIO}`; input file fuera del menú del avatar + `setTimeout 50ms`; PerfilEditar sin input URL (se mantiene FOTO_URL como almacenamiento); fecha con día; Seguridad/MisCompras/Direcciones/Favoritos pegadas; lápiz en DireccionesPerfil; favoritos con deshacer (barra 5s + POST restaurador); FloatingCart estático (sin drag, se eliminó estado de posición del contexto); MiniCartMenu calcula posición sobre el botón fijo.
- Retos completos (2026-08-02): retoController reescrito (evidencias + aprobación + cupón); retoRoutes con 9 rutas; checkout valida `DESCUENTOS.USADO` (cupones RETO- de un solo uso: no aplica si ya usado, marca USADO=1 en la transacción); docker-compose mount `./frontend/public/images/retos:/app/uploads/retos`; `Retos.tsx` con botón atrás + adjuntar imagen/video (base64 ≤10mb) + mensaje "nuestros asesores... 24 horas" + badge de avances en revisión; `AdminRetos.tsx` (`/admin/retos` + tab en AdminNavbar) con tabla, modal de vista (img/video) y Aprobar/Rechazar.
- Verificaciones: `node --check` OK (retoController, retoRoutes, checkoutController, setup.js) + `npx tsc -b` OK (frontend, tras quitar `pos` muerto en FloatingCart y `guardarFoto` muerta en PerfilEditar).

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Search uses prefix matching (`LIKE 'word%'`) so "za" only matches products starting with "za".
- FloatingCart draggable: touchAction: none + passive events; MiniCartMenu follows via CartContext shared position.
- Reviews only for logged-in users; name auto-fetched from AuthContext; avatar uses first letter.
- Database setup: `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` safe for every restart.
- Docker volume: named volume for portability (no `mysql_data/` dir needed on new clones).
- `.env.example` contains only placeholders; real credentials shared outside git.
- Docs corrections preserve existing structure and format.
- RF-027 "Parcial" because only GET categories exists without admin CRUD endpoints.

## Next Steps
1. (User) Restart containers: `docker compose up -d` (aplica los mounts nuevos `./frontend/public/images/perfiles` y `./frontend/public/images/retos`) + `docker restart jadda_backend` (aplica `migrarTablasExistentes` → `ENVIOS.COSTO_ENVIO`, `DESCUENTOS.USADO`, tabla `RETO_EVIDENCIAS` + retos 5-16, rutas nuevas); `docker restart jadda_frontend` si hay parse errors stale.
2. (User) Probar: subir foto de perfil desde navegador (Perfil y PerfilEditar), menú del avatar, dropdown del navbar → /perfil, checkout con cupón de reto (aplicar, verificar que no se pueda reusar), retos (unirse, reportar con imagen/video → revisar en /admin/retos → aprobar → cupón RETO-XXXX-XXXX → usarlo en checkout).
3. (User) Once admin account works, protect admin routes: add `ID_ROL` to `deserializeUser` (passport.js), create `esAdmin` middleware, apply to `/api/admin/*` and product CRUD routes.
4. (User) Implement truly missing features: RF-025 (email notifications), RF-030 (admin orders), RF-031 (admin products CRUD), RF-032 (admin inventory), RF-033 (returns), RF-034 (admin coupons), RF-035 (admin users), RF-037 (admin dashboard), RF-038 (admin PQRS).
5. (User) Fix mobile app: persist AuthContext with AsyncStorage, replace hardcoded IP with `EXPO_PUBLIC_API_URL` (resolverImagen ya usa `EXPO_PUBLIC_FRONT_URL`).
6. (User) Create `backend/.env.example` with placeholder values for git sharing (add ADMIN_EMAIL/ADMIN_PASSWORD, FRONTEND_URL).
7. (User) Remove legacy `jsonwebtoken` dependency and unused `verificarToken` middleware.

## Critical Context
- `MYSQL_ROOT_PASSWORD: tu_password_secreto` in `docker-compose.yml` and `.env` — must match between backend and database container.
- `docker compose down -v` deletes the named `mysql_data` volume; on next `up`, setup.js recreates tables + seeds.
- Docker Vite dev server may show stale parse errors; `docker restart jadda_frontend` resolves.
- **Verificación frontend**: usar `npx tsc -b` (NO `tsc --noEmit` — el tsconfig raíz solo tiene referencias y no revisa nada). El Docker corre `pnpm build` = `tsc -b && vite build`.
- `addToCart(idProducto, idVariante, cantidad)` — second param is always a variant ID, never a quantity.
- FloatingCart and MiniCartMenu are rendered globally by `App.tsx`; individual pages should NOT import them.
- 27 RFs corrected: RF-001 through RF-012 (stack/endpoints), RF-013 through RF-019, RF-022, RF-024, RF-026, RF-028, RF-029, RF-036, RF-039 (status/endpoints). RF-027 "Parcial". 26 HUs updated to match (HU-001 through HU-029, HU-036, HU-039). 12 remaining "Por implementar" are genuinely missing.
- Real stack: Express sessions + Passport.js (not JWT), `USUARIOS` table, `CONFIRMADO` field, `POST /api/auth/login`, Spanish error messages.
- Admin seed: `seedAdminUser()` corre en cada arranque (setup.js); si borras al admin en Workbench, se recrea al reiniciar el backend.
- Checkout seguro: el servidor recalcula subtotal/descuento/total; el decremento de stock por variante queda pendiente de habilitar tras pruebas (ver checkoutController.js).
- Checkout 2026-08-02: VALIDA stock por variante SIN decrementar (400 con mensaje por producto); costo envío calculado en servidor (`utils/envio.js`, gratis ≥ $200.000) y sumado al total; `ENVIOS.COSTO_ENVIO` se migra AUTOMÁTICAMENTE vía `migrarTablasExistentes()` en setup.js (ALTER idempotente al arrancar, verifica INFORMATION_SCHEMA) — ya no es necesario correr el ALTER a mano en Workbench.
- Foto de perfil: `POST /api/auth/foto` (base64, límite 10mb) guarda en `backend/uploads/perfiles/u{ID_USUARIO}/` → mount Docker `./frontend/public/images/perfiles:/app/uploads/perfiles` → URL `/images/perfiles/u{id}/...`; después se guarda la URL con `PUT /api/auth/perfil` (`foto_url`) y `refreshPerfil()` del AuthContext. Funciona SOLO en Docker (como la subida de imágenes de productos).
- Foto de perfil UX: el input file está FUERA del menú del avatar (el menú se desmontaba y el diálogo nunca abría) y se hace click con `setTimeout(() => fileInputRef.current?.click(), 50)`; PerfilEditar ya NO tiene input de URL (solo subida desde navegador) — la columna `FOTO_URL` se mantiene como almacenamiento de la ruta.
- Perfil (frontend): `Perfil.tsx` con hero pegado al navbar (padding-top 0 + body global), avatar con borde rojo clickeable → menú "Ver foto" (modal fullscreen) y "Cargar foto desde el navegador"; fecha con día (`{ weekday: "long" }`); PerfilEditar con sección "Información de tu cuenta" (correo, miembro desde con día, documento, botón "Cambiar contraseña" → `/perfil/seguridad`). Fallback avatar: ui-avatars.com.
- Carrito estático (2026-08-02): FloatingCart es un botón fijo `right:25px; bottom:25px` SIN drag (se eliminó todo el estado de posición `cartButtonX/Y/setCartButtonPos` de CartContext); MiniCartMenu posiciona sobre el botón fijo (`botonX = innerWidth - 65 - 25`, abre hacia la izquierda).
- Favoritos con deshacer (2026-08-02): al eliminar aparece barra fija bottom 90px right 20px con countdown de 5s (`fav-undo-bar`/`fav-undo-btn` en Favoritos.css); deshacer hace `POST /api/favoritos { id_producto }` + recarga. Icono de editar en DireccionesPerfil: `FaPencilAlt` (antes FaStar).
- Retos completos (2026-08-02): tabla `RETO_EVIDENCIAS` (ID_EVIDENCIA, ID_RETO_USUARIO, ID_USUARIO, TIPO imagen|video, RUTA, CANTIDAD, ESTADO pendiente|aprobado|rechazado, FECHA_SUBIDA); 16 retos seed (5-16 nuevos); `DESCUENTOS.USADO` (cupones de un solo uso). Flujo: reportar avance SIN material suma directo; CON material (imagen/video base64 ≤10mb → `backend/uploads/retos/r{id_reto_usuario}/`, mount `./frontend/public/images/retos:/app/uploads/retos`) queda PENDIENTE → admin aprueba/rechaza (`GET/POST /api/retos/admin/evidencias*`) → al aprobar suma CANTIDAD y si llega a META genera cupón `RETO-XXXX-XXXX` con 30 días de vigencia y USADO=0. Checkout: cupones `RETO-` ya usados (USADO=1) no aplican descuento y al aplicarse se marcan USADO=1 dentro de la transacción.
- Retos UI (2026-08-02): `Retos.tsx` con botón atrás, Swal de adjuntar material (file input, preConfirm base64, validación 10MB), mensaje "Deja que nuestros asesores revisen el material... hasta 24 horas", badge de avances en revisión, cupón mostrado con "un solo uso"; panel `AdminRetos.tsx` (`/admin/retos`, tab en AdminNavbar) con tabla de evidencias, modal para ver imagen/video, botones Aprobar/Rechazar.
- Navbar dropdown (2026-08-02): header del menú de usuario es `<Link to="/perfil">` con avatar (foto o ui-avatars), nombre y "Ver perfil" (antes "Miembro JADDA"); se quitaron "Mi Perfil" y "Mi Historial" (ruta `/historial` sigue existiendo).
- Páginas de perfil pegadas al navbar (2026-08-02): `body { padding-top: 65px }` es global (principal.css importado en main.tsx), así que las páginas ya no usan padding-top propio: Perfil/PerfilEditar/Seguridad/MisCompras/DireccionesPerfil/Favoritos con `padding-top: 0`.
- Mega-menú Catálogo compacto (2026-08-02): dropdown de 560px centrado bajo CATÁLOGO (antes full-width, tapaba la pantalla); izquierda = lista de categorías con hover activo (rojo), derecha = panel con hasta 4 productos de la categoría activa (categorías de productosMenu se filtran por `p.CATEGORIA === cat.NOMBRE_CATEGORIA`); pie "Ver todo el catálogo →".
- Footer reestructurado (2026-08-02): reescrito con grid CSS propio (sin Bootstrap cols), 4 columnas (Marca, Navegación, Atención al cliente, Síguenos con iconos react-icons), línea inferior de copyright. CSS `footer.css` reescrito completo.
- Newsletter del footer (2026-08-02): movida de barra roja superior a franja compacta abajo (antes de copyright), sin fondo rojo (borde sutil, input oscuro redondeado, botón outline).
- Recientemente vistos con descuento/stock (2026-08-02): `historialController.obtenerHistorial` ahora trae `ID_DESCUENTO`, `STOCK` (SUM de PRODUCTO_VARIANTES) e `ID_VARIANTE_POR_DEFECTO` (MIN) vía subqueries; entrada de localStorage en ProductDetailPage guarda los 3 campos nuevos; Principal enriquece cada item del historial con datos completos de `productos` y pasa `descuentoPorcentaje` + `onAgregarCarrito` a ProductCard (antes ni descuento ni badge de stock se mostraban).
- Envío: `GET /api/envio/calcular?departamento=&subtotal=` (tarifas por departamento, normaliza tildes); frontend ResumenCompra lo consulta al cambiar departamento (debounce 400ms).
- Checkout resumen (2026-08-02): el panel derecho muestra desglose completo — Precio base, Descuento de productos (si hay ID_DESCUENTO), Descuento cupón (si aplica), Envío y Total; `subtotalBase/descuentoProductos/subtotal` calculados por separado; row del checkout con `align-items: flex-start` (fix: la columna derecha ya no salta al cambiar método de pago — antes se estiraba con la izquierda).
- Estado de envío admin (2026-08-02): `PUT /api/admin/compras/:id/envio` actualiza `ENVIOS.ESTADO_ENVIO` (PENDIENTE, POR_EMPAQUETAR, EMPACADO, EN_CAMINO, ENTREGADO, CANCELADO); AdminOrdenes tiene columna "Envío" con select + badge de estado (colSpan del detalle: 9).
- MiniCartMenu: botón del footer dice "Comprar" (antes "Ver carrito").
- Cancelar pedido: `POST /api/compras/:id/cancelar` (solo COMPLETADA/PENDIENTE → CANCELADA + ESTADO_ENVIO CANCELADO); botón en MisCompras.
- Dirección de pedido: `PUT /api/compras/:id/direccion` actualiza ENVIOS en servidor; MisCompras ya NO usa sessionStorage (`jadda_direcciones_edit` eliminado).
- CompraExitosa: si se refresca (sin location.state) recupera `GET /api/compras/:id` (trae TOTAL, REFERENCIA_PAGO, productos, planGenerado).
- Rating en cards: `GET /api/productos` incluye RATING (AVG RESENAS) y RESENA_COUNT vía subconsultas (no rompen SUM de stock); ProductCard y Catalogo muestran estrellas; badges "AGOTADO"/"¡Solo quedan X!" (umbral 10) según STOCK.
- Planes: `dias_completados` persistidos en `backend/data/planes-progreso.json` (id_plan → array); `misPlanes` devuelve DIAS_COMPLETADOS; archivo `backend/data/` se crea automáticamente (mkdirSync recursive).
- Newsletter: `POST /api/newsletter` persiste en `backend/data/newsletter.json`; input en Footer.
- Otros fixes: Navbar mega-menú usa `?cat=` (antes `?categoria=`); AuthModal sin delay artificial de 2s; guía de tallas modal (zapatos + ropa) en ProductDetailPage si el atributo parece talla; sección "Recientemente vistos" en Principal (API si hay sesión, localStorage si no); ResumenCompra muestra "Solo quedan X" por item y errores de checkout con Swal (antes alert); bug `selectClass(numeroDocumento)` → `selectClass(tipoDocumento)` corregido.
- Fixes 2026-08-02 tarde: (1) `actualizarPerfil` (authController) ahora actualiza SOLO los campos presentes en el body (antes ponía NULL en todos, rompiendo al subir foto — "Column 'NOMBRE_USUARIO' cannot be null"); (2) ResumenCompra: `descuentosMap/costoEnvio/envioCargando` movidos ANTES del reduce de `subtotal` (TDZ → "Cannot access before initialization"); (3) Navbar: timers separados `megaTimer`/`ofertasTimer` + cada menú cierra al otro al abrir (antes al pasar de CATÁLOGO a OFERTAS se cancelaba el timer y el menú de catálogo quedaba abierto).
- Rate limiting en memoria (rateLimiter.js): se reinicia si el contenedor backend se reinicia; suficiente para dev, no para multi-instancia en producción.
- Remaining unimplemented RFs: RF-025 (email notifications), RF-030 (admin orders), RF-031 (admin products CRUD), RF-032 (admin inventory), RF-033 (returns), RF-034 (admin coupons), RF-035 (admin users), RF-037 (admin dashboard), RF-038 (admin PQRS). RF-023 (cancel order) AHORA ESTÁ IMPLEMENTADO (endpoint + UI).
- Imágenes de producto: 44 carpetas `Producto_01..44` en `frontend/public/images/productos/` (3 imágenes c/u, `img_K.ext`, K = ORDEN en BD); subidas del admin van a `frontend/public/images/productos/subidas/`. Mapeo: carpeta `Producto_NN` ↔ `ID_PRODUCTO NN`. Producto 45 no existe (eliminado).
- Subida de imágenes: el backend escribe en `/app/uploads/subidas` (mount de `./frontend/public/images/productos`) — funciona SOLO en Docker (fuera de Docker esa carpeta no existe). Body JSON ≤ 25mb.
- FRONTEND_URL (backend env, default `http://localhost:5173`) se usa en el correo de checkout para rutas de imagen relativas; la app móvil usa `EXPO_PUBLIC_FRONT_URL` (default `http://10.2.178.124:5173`).
- Verificación final frontend tras este cambio: `npx tsc -b` + `npx vite build` OK; backend con `node --check` OK en todos los archivos tocados.

## Relevant Files
- `backend/database/setup.js`: full DB schema (22 tables) + seed data (imágenes locales, sin producto 45).
- `backend/database/schema.sql`: único archivo SQL — schema + seeds (imágenes locales, sin producto 45) + bloque de migración para BD existentes (importable en MySQL Workbench; generado desde setup.js).
- `backend/controllers/imagenController.js` + `POST /api/productos/imagenes`: subida de imágenes base64 desde el panel admin.
- `frontend/src/admin/SubirImagenes.tsx`: componente de subida de imágenes reutilizable (admin).
- `docs/README.md`: docs index with state table and stack.
- `docs/plan de trabajo.md`: project phases, module status, cronograma.
- `docs/Restricciones del Proyecto.md`: stack, security, dev workflow constraints.
- `docs/diagrams/arquitectura.md`: system architecture + auth/checkout sequence diagrams.
- `docs/diagrams/base-de-datos.md`: ERD + full table structure.
- `docs/diagrams/flujos.md`: registration, purchase, admin, and navigation flow diagrams.
- `docs/RFs/RF-001.md` through `docs/RFs/RF-039.md`: 27 corrected RFs + 1 Parcial.
- `docs/HUs/HU-001.md` through `docs/HUs/HU-039.md`: 26 HUs updated to match corrected RFs.
- `docs/RNFs/RNF-001.md` through `docs/RNFs/RNF-011.md`: 11 RNFs restructured (7 original modules extracted + 4 new).
- `backend/utils/envio.js`: tarifas de envío por departamento (envío gratis ≥ $200.000).
- `backend/controllers/envioController.js` + `backend/routes/envioRoutes.js`: `GET /api/envio/calcular`.
- `backend/controllers/newsletterController.js` + `backend/routes/newsletterRoutes.js`: `POST /api/newsletter` (persiste en `backend/data/newsletter.json`).
- `backend/controllers/comprasController.js`: `obtenerCompras`, `obtenerCompraPorId`, `cancelarCompra`, `actualizarDireccionCompra`.
