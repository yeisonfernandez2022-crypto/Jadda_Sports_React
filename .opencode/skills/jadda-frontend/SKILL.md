---
name: jadda-frontend
description: "Use when editing anything under frontend/src of JADDA SPORTS (React 19 SPA with Vite 8, TypeScript, Bootstrap, SweetAlert2) — adding a page or admin panel, working with AuthContext/CartContext, the Wompi checkout, SweetAlert dialogs, CSS conventions, or before building/verifying with npx tsc -b."
---

# Frontend web de JADDA SPORTS (React 19 + Vite 8)

Hechos verificados en `frontend/` (package.json, vite.config.ts, src). No supuestos.

## Stack y comandos

- React **19.2.4**, TypeScript **5.9.3**, Vite **8.0.1**, Bootstrap **5.3.8**, SweetAlert2, react-router-dom **7.13.2**, react-icons, FontAwesome 7, axios, msw (solo tests). `type: module`.
- Scripts: `pnpm dev` (Vite dev, port 5173 strictPort), `pnpm build` = **`tsc -b && vite build`**, `pnpm preview` (sirve dist con proxy), `pnpm test` = `vitest run`, `pnpm lint`.
- La verificación de tipos es **`npx tsc -b`** (NO `tsc --noEmit`: el tsconfig raíz solo tiene referencias). El build dentro de Docker debe pasar `pnpm build`.
- Docker: si Vite muestra errores de parseo "stale", `docker restart jadda_frontend` los resuelve (cache del watcher); tras editar CSS/archivos nuevos espera el log `✓ built in Xs` del preview.

## Proxy y variables

- `frontend/vite.config.ts`: proxy en `server` **y** `preview` de `/api`, `/images/perfiles`, `/images/usuarios`, `/images/devoluciones`, `/images/productos` → `http://backend:5000` (`VITE_PROXY_TARGET` lo overridea; en local usa `http://127.0.0.1:5000`). El preview lo necesita porque el link de desuscripción apunta a `/api/newsletter/desuscribir`.
- `allowedHosts` ya incluye `jaddasports.com/www/api` (sin esto el preview da 403 host not allowed con dominio real).
- El API se consume con axios y **`credentials` (cookies de sesión)** — no hay tokens.

## Estructura real de src/ (contados en el código)

- `src/pages/` — 34 páginas: Principal (home), Catalogo, ProductDetailPage, ResumenCompra (checkout de 4 pasos: envío→pago→confirmación), CompraExitosa, MisCompras, DetalleCompra, DevolverPedido, DevolucionEstado, ReembolsoDetalle, Chats, Retos, MisRetos, Planes, Perfil + perfil/*, SerVendedor, políticas legales, NotFound, ErrorFallback, OAuthPopupCallback…
- `src/admin/` — 16 componentes del panel: AdminDashboard, AdminProductos, AdminOrdenes, AdminUsuarios, AdminDevoluciones, AdminVendedores, AdminRetos, AdminCategorias, AdminReportes, AdminConfiguracion, EditarProductoAdmin, SubirImagenes, VistaPreviaProducto, AdminNavbar/Footer/ProductoCaracteristicas. No existe `AdminPublicarProducto.tsx`: el formulario "Publicar" vive dentro de `AdminProductos.tsx`.
- `src/components/` — Navbar, Footer, FloatingCart + MiniCartMenu (carrito flotante), ChatWidget, AuthModal (login/registro/verify), ProductCard, SelectorVarianteModal, BellNotificaciones, ImageZoom, LoadingPage, ErrorBoundary, AvisoCookies…
- `src/context/` — 4 contexts: **AuthContext** (`usuarioLogueado`, `esAdmin` (ID_ROL 1), `esVendedor` (ID_ROL 6), refreshPerfil), **CartContext** (clase firma: `addToCart(idProducto, idVariante, cantidad)` — el 2º parámetro SIEMPRE es id de variante), AuthModalContext, ChatWidgetContext.
- `src/utils/` — helpers espejo del backend: `estadoCompra.ts` (estadoVisible, puedeDevolver, devolucionVencida, DIAS_DEVOLUCION=3, DEVOLUCION_ACTIVA), `reglasCupon.ts` (espejo exacto de backend/utils/reglasCupones.js), `numeroPedido.ts` (mismo hash de Knuth del backend), `wompiWindow.ts` (gestión de la pestaña del checkout Wompi), `escapeHtml.ts` (anti-XSS para SweetAlert), `navigationGuard.ts`, `volverAtras.ts`, `retosAvances.tsx`.
- `src/css/` — 36 hojas; cada página moderna tiene la suya con **prefijo de clase propio**: `.mc-` (MisCompras), `.dc-` (DetalleCompra), `.sv-` (SerVendedor), `.ao-`/`.ap-`/`.au-` (admin en adminDashboard.css), `.rr-` (ReembolsoDetalle), `.de-` (DevolucionEstado). Al crear una página nueva, crea CSS propio con prefijo nuevo y no toques `principal.css`/`adminDashboard.css` salvo clases compartidas.

## Convenciones de rutas y UI

- Rutas en `App.tsx` con lazy imports: públicas, `ProtectedRoute` (`/perfil*`), `AdminRoute` (`/admin*`), `VendedorRoute` (`/vendedor*`). NotFound como catch-all.
- Navbar global lo renderiza el layout de `App.tsx`; las páginas NO importan Navbar (historial: doble navbar interceptaba clicks).
- FloatingCart/MiniCartMenu/BellNotificaciones son globales — no montarlos por página.
- Diálogos: **SweetAlert2 siempre**: `Swal.fire` con `confirmButtonColor`, `reverseButtons: true` y texto del servidor interpolaado con `escapeHtml()` (los campos html/title de Swal interpretan HTML — XSS almacenado si no escapas). No uses `alert()` ni `window.confirm`.
- Iconos: `react-icons/fa` (imports nombrados) y clases `fa-` de FontAwesome en textos.

## Checkout y pagos (contexto real)

- El checkout de 4 pasos vive en `ResumenCompra.tsx` con estado en sessionStorage (`jadda_checkout_paso/envio/metodo`) — el refresh conserva el paso.
- Pago: métodos de la app (credito/debito con tokenización real: el backend guarda QUÉ DATOS se envía — sin CVV) o **Wompi** (`POST /api/pagos/pagar` devuelve `urlCheckout`; se abre pestaña nueva con `wompiWindow.ts`, la pantalla espera con polling `GET /api/pagos/estado/:id`).
- Estados de venta que el UI debe tratar: `PENDIENTE_PAGO, COMPLETADA, CONFIRMADA, PENDIENTE, CANCELADA, ENVIADA` y estados de envío `PENDIENTE, POR_EMPAQUETAR, EMPACADO, EN_CAMINO, ENVIADA, ENTREGADO, CANCELADO` — usa siempre `estadoVisible()` de utils/estadoCompra.ts en vez de mostrar el ESTADO crudo.

## Checklist antes de decir "listo"

- `npx tsc -b` (en frontend/) sin errores.
- Si tocaste algo del build/proxy bajo Docker, `docker restart jadda_frontend` y confirma `✓ built in` en los logs.
- Metodología de tests y flujo completo: ver skill `jadda-testing`; esta capa se cubre con vitest + RTL y Playwright E2E.
