# Estado del proyecto — JADDA SPORTS

> **Corte:** 2026-10-20 · **Alcance:** código en `main` (`0a75bbcc`) + cambios locales de limpieza de esta sesión.
> Este documento refleja lo que **realmente hace el código**, no lo que estaba planificado.

---

## 1. Resumen ejecutivo

| Indicador | Valor |
|-----------|-------|
| Requisitos funcionales documentados | **61** (RF-001…RF-061) |
| Historias de usuario documentadas | **61** (HU-001…HU-061) |
| Requisitos no funcionales documentados | **17** (RNF-001…RNF-017) |
| Tablas en la base de datos | **35** |
| Pruebas backend | **28** (Vitest, MySQL mockeado) |
| Pruebas frontend | **51** (Vitest + Testing Library) |
| Pruebas E2E de humo | **23** checks (`tests/smoke.mjs`) |
| Cobertura backend | 100 % líneas · ~87 % ramas |
| Cobertura frontend | ~34 % (componentes y utilidades críticas) |

**Conclusión:** el producto web (tienda + panel admin + marketplace de vendedores + chat) está **funcionalmente completo** para el alcance del proyecto de grado. La app móvil está **parcial**: catálogo, cuenta, carrito, checkout, reseñas, favoritos, retos, panel de vendedor y chat de devolución están implementados; faltan la bandeja de soporte del cliente y las notificaciones push. La deuda principal es de calidad interna (tipos `any`, cobertura frontend) y de infraestructura de producción (HTTPS/CSRF, rate limit distribuido).

---

## 2. Stack real

| Capa | Tecnología |
|------|------------|
| Frontend web | React 19 + TypeScript 5.9 + Vite 8, React Router, SweetAlert2, react-icons |
| Backend | Node.js 22 + Express 5 (CommonJS), express-session + Passport.js, bcrypt, Nodemailer, PDFKit, ExcelJS, Multer |
| Base de datos | MySQL 8.0 (35 tablas, `utf8mb4`, migraciones idempotentes al arrancar) |
| Móvil | React Native 0.81 + Expo 54 (Expo Router) |
| Infraestructura | Docker Compose (`jadda_frontend`, `jadda_backend`, `jadda_mysql`) |
| Pruebas | Vitest, Testing Library, MSW, Playwright Core (solo humo) |
| CI | GitHub Actions (lint, typecheck, unitarias con cobertura, build y humo E2E) |

**Autenticación:** sesiones con cookie (`express-session`), no JWT. El código y la dependencia `jsonwebtoken` fueron eliminados.

---

## 3. Estado por módulo

### 3.1 Implementado y verificado

| Módulo | Evidencia principal |
|--------|---------------------|
| Registro, verificación por código, login, recuperación y cambio de contraseña | `authController`, rate limiting, pruebas E2E de humo |
| Login social Google/Facebook | Passport.js + `socialLogin` |
| Catálogo, búsqueda por prefijo, filtros, variantes y reseñas | `productoController`, `Catalogo.tsx`, `ProductDetailPage.tsx` |
| Carrito, minicarrito y checkout con total recalculado en servidor | `CartContext`, `checkoutController` |
| Envío por departamento con umbral de **envío gratis $800.000** | `backend/utils/envio.js`, `BarraEnvioGratis.tsx` |
| Pedidos: historial, detalle, factura PDF, cancelación con liberación de stock, edición de dirección | `comprasController`, `MisCompras.tsx`, `DetalleCompra.tsx` |
| Devoluciones y reembolsos con evidencias y reingreso de stock | `devolucionController`, `AdminDevoluciones.tsx` |
| Notificaciones in-app (campana) y por correo al cambiar estado | `notificacionController`, `estadoPedido.js` |
| Retos deportivos con evidencias, aprobación y cupones `RETO-` | `retoController`, `Retos.tsx`, `AdminRetos.tsx` |
| Cupones con compra mínima escalada y panel de cupones disponibles | `reglasCupones` (backend + `shared/` + frontend), `ResumenCompra.tsx` |
| Planes de entrenamiento con progreso persistido | `planesController`, `Planes.tsx` |
| Métodos de pago y direcciones guardadas en el perfil | `metodoPagoController`, `PerfilMetodosPago.tsx` |
| Favoritos, recientemente vistos y recomendaciones | `favoritosController`, `historialController`, `productoController` |
| Panel admin: dashboard, productos, órdenes, usuarios, categorías, retos, devoluciones, vendedores, reportes, configuración | `frontend/src/admin/*` |
| Reportes admin con Excel (fórmulas) y PDF (gráficas) | `reporteVentas`, `reporteExcel.js`, `reportePdf.js` |
| Marketplace: solicitud de vendedor, aprobación, productos con estados y ventas propias | `vendedorController`, `frontend/src/vendedor/*` |
| Reportes del vendedor descargables (Excel/PDF) | `reporteVendedorExcel.js`, `reporteVendedorPdf.js` |
| Chat cliente ↔ vendedor ↔ JADDA con escalación de devoluciones | `chatController`, `Chats.tsx`, `ChatWidget.tsx` |
| Newsletter automática + desuscripción + envío manual | `newsletterController`, scheduler en `server.js` |
| PQR y formulario de contacto | `pqrController`, `contactoController` |
| Respaldos y restauración probados | `scripts/backup.ps1`, `scripts/restaurar-backup.ps1` |
| Seguridad: RBAC (`esAdmin`, `esVendedor`), rate limiting, bcrypt, validaciones | middlewares y controladores |

### 3.2 Parcial (funciona con limitaciones)

| Módulo | Qué falta / limitación |
|--------|------------------------|
| Pagos | Se registra método y referencia; **no hay pasarela de pago real** (Nequi/tarjeta son datos declarativos) |
| App móvil | Catálogo, login/registro, cuenta, carrito, checkout, reseñas, favoritos, retos, panel de vendedor y chat de devolución implementados; **faltan bandeja de soporte del cliente y push**; pendiente validación E2E en dispositivo |
| RNF-002 (seguridad) | Falta HTTPS y protección CSRF explícita; en LAN se acepta HTTP |
| RNF-003 (rendimiento) | Sin pruebas de carga formales (k6/Artillery planificados) |
| RNF-004 (disponibilidad) | Backups resueltos; falta monitoreo/uptime y alta disponibilidad |
| Correo | Depende de SMTP configurado; en CI no se configura SMTP y los envíos se omiten de forma controlada |
| Búsqueda y filtros del catálogo | Filtros de precio/orden son client-side; el backend solo filtra por prefijo |
| Chat | Web completo (página + widget); en móvil hay hilo de devolución y bandeja del vendedor, falta bandeja de soporte del cliente |

### 3.3 Pendiente / fuera de alcance

| Tema | Nota |
|------|------|
| Publicación en Internet | El despliegue documentado es local/LAN; requiere reverse proxy y HTTPS |
| Pasarela de pagos | Integración real con proveedor (PSE, tarjeta, Nequi API) |
| Notificaciones push móviles | No implementadas |
| Multi-instancia | El rate limiting es en memoria; requeriría Redis para escalar |
| Firma del acta UAT | Documento listo; falta ejecución y firma con el cliente |

---

## 4. Deuda técnica conocida

1. **Tipos `any`:** ~181 usos en frontend (configurados como *warning* en ESLint, no rompen CI).
2. **Dependencias de hooks:** ~16 advertencias `react-hooks/exhaustive-deps` en cargas asíncronas heredadas.
3. **Cobertura frontend:** ~34 %; el umbral configurado (28–37 %) evita regresiones, pero no mide toda la UI.
4. **Rate limiting en memoria:** suficiente para una instancia; se reinicia con el contenedor.
5. **`setup.js`:** conserva lógica de reparación de textos con U+FFFD **a propósito** (datos legacy corruptos).
6. **Tests E2E:** el humo requiere la app levantada y un navegador; no cubre todos los flujos (los unitarios cubren lógica).
7. **Imágenes en CI:** el backend sirve `/images` desde volúmenes Docker; en CI algunas imágenes pueden faltar sin afectar los checks.

---

## 5. Validación reproducible

```bash
# Backend (sin base de datos: MySQL está mockeado)
pnpm --prefix backend test

# Frontend
pnpm --prefix frontend test
pnpm --prefix frontend exec tsc -b
pnpm --prefix frontend lint

# Cobertura
pnpm test:coverage

# Build de producción
pnpm build

# E2E de humo (requiere contenedores arriba)
pnpm test:e2e
```

Resultados de la última ejecución local (2026-10-20):

| Comando | Resultado |
|---------|-----------|
| `backend test` | 28/28 ✅ |
| `frontend test` | 51/51 ✅ |
| `frontend exec tsc -b` | 0 errores ✅ |
| `frontend lint` | 0 errores (205 warnings) ✅ |
| `smoke.mjs` | 23/23 ✅ |
| `pnpm build` (Docker) | ✅ |

---

## 6. Limpieza aplicada en esta sesión

- **Archivos muertos eliminados:** `frontend/src/index.js`, `AdminRoute.tsx` duplicado, `resenaController.js`, `checkImagenes.js`, `reinicio.tmp`, `cookies.txt`, 9 CSS sin referencias y artefactos de pruebas.
- **Suite Playwright obsoleta eliminada:** `tests/e2e/*.spec.ts`, `playwright.config.ts`, scripts `test:playwright*` y dependencia `@playwright/test`. Se mantiene `tests/smoke.mjs` como E2E oficial (23 checks).
- **Dependencias sin uso eliminadas:** `axios`, `jsonwebtoken`, `supertest`, `@types/*`, `typescript` (backend); `@react-oauth/google`, `jwt-decode`, `react-bootstrap-icons`, `@testing-library/user-event`, `@types/jsdom` (frontend); 3 paquetes en móvil. Lockfiles regenerados.
- **JWT eliminado del backend:** se quitó `verificarToken` y su dependencia; la autenticación es 100 % por sesión.
- **Rutas de chat restauradas:** `/chats`, `/admin/chats`, `/vendedor/chats` (los enlaces y notificaciones apuntaban a 404).
- **CI reescrito:** pnpm setup, sin `tsc` inexistente en backend, tests sin Docker interno, cobertura real y humo E2E con MySQL efímero.
- **Proxy configurable:** `VITE_PROXY_TARGET` permite ejecutar Vite fuera de Docker/CI apuntando a `127.0.0.1:5000`.
- **Texto corrupto (mojibake) corregido** en mensajes de usuario, correos y comentarios; `setup.js` se mantiene intacto por diseño.
- **Documentación actualizada:** umbral de envío real ($800.000), conteos 61/61/17, comandos de prueba y este documento.

---

## 7. Archivos clave

| Ruta | Propósito |
|------|-----------|
| `docker-compose.yml` | Orquestación de los 3 servicios |
| `backend/database/setup.js` | Esquema idempotente + migraciones + seeds |
| `backend/database/schema.sql` | Esquema completo para BD nuevas |
| `backend/server.js` | API, sesiones, estáticos y scheduler de newsletter |
| `tests/smoke.mjs` | Suite E2E de humo |
| `.github/workflows/ci.yml` | Integración continua |
| `frontend/src/App.tsx` | Rutas y layouts |
| `docs/` | Requisitos, calidad, implantación, manuales y aceptación |
