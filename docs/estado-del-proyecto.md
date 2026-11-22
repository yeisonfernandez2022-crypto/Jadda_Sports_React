# Estado del proyecto — JADDA SPORTS

> **Corte de calidad:** 2026-11-20 · **Alcance funcional:** el documento conserva abajo los snapshots históricos por corte; las cifras vigentes de pruebas y cobertura viven en §1.1.
> Este documento refleja lo que **realmente hace el código**, no lo que estaba planificado.

---

## 1. Resumen ejecutivo

| Indicador | Valor |
|-----------|-------|
| Requisitos funcionales documentados | **61** (RF-001…RF-061) |
| Historias de usuario documentadas | **61** (HU-001…HU-061) |
| Requisitos no funcionales documentados | **17** (RNF-001…RNF-017) |
| Tablas en la base de datos | **39** (38 de negocio + `sessions`; incluye `PAGOS_EVENTOS`, `BANNERS` y las tablas de newsletter) |
| Pruebas backend unitarias | **1072** (75 archivos; ejecución local 2026-11-20) |
| Pruebas backend de integración | **132** (14 archivos; MySQL real, puerto 3307) |
| Pruebas frontend | **581** (59 archivos; ejecución local 2026-11-20) |
| Pruebas E2E Playwright | **20 specs × Chromium en CI** (MS Edge se ejecuta localmente donde está instalado) |
| Cobertura backend | **FUSIONADA unitarias + integración: 93.99 % statements · 84.13 % branches · 98.49 % funciones · 99.85 % líneas** (reportes 2026-11-15; script re-ejecutado 2026-11-20 con umbral 80: aprobado). |
| Cobertura frontend | **51.01 % statements · 45.57 % branches · 47.30 % funciones · 54.94 % líneas** (medición que fijó los umbrales 51/45/47/54 en `frontend/vitest.config.ts`) |

**Conclusión:** el producto web (tienda + panel admin + marketplace de vendedores + chat) está **funcionalmente completo** para el alcance del proyecto de grado. La app móvil está **parcial**: sus flujos y brechas actuales se detallan en [`../movil/docs/RFs-movil.md`](../movil/docs/RFs-movil.md). La deuda principal es de calidad interna (tipos `any`, cobertura frontend aún lejos de 80 %) y de escalabilidad (rate limit distribuido).

### 1.1 Medición vigente de calidad — 2026-11-20

| Suite / métrica | Resultado | Reporte / nota |
|---|---:|---|
| Backend unitarias | **1072 tests · 75 archivos** | Ejecución local 2026-11-20: 75/75 archivos y 1072/1072 tests en verde. |
| Backend integración | **132 tests · 14 archivos** | MySQL real en el puerto 3307; 0 fallos. |
| Backend combinada | Fusión unitarias + integración | st 93.99 % (5282/5620), br 84.13 % (3233/3843), fn 98.49 % (521/529), líneas 99.85 % (12277/12296). `node backend/scripts/cobertura-combinada.mjs 80`: **umbral aprobado** (reportes de cobertura del 2026-11-15). |
| Frontend | **581 tests · 59 archivos** | Umbrales 51/45/47/54 en `frontend/vitest.config.ts`; medición que los fijó: 51.01/45.57/47.30/54.94. |

Los porcentajes por suite backend son RAW y no se suman entre sí; la cifra oficial de backend es la combinada indicada arriba. El trinquete de cobertura del repositorio es la variable `COBERTURA_UMBRAL` (valor vigente: **80**; el fallback del workflow es 60 si la variable no existe).

Los cortes del 13–15 de noviembre (354 unitarias / 132 integración / 168 frontend y fusión de 70.48 %) quedan como histórico en §6.a y en `docs/testing/pendiente-cobertura-80.md`.

---

## 2. Stack real

| Capa | Tecnología |
|------|------------|
| Frontend web | React 19 + TypeScript 5.9 + Vite 8, React Router, SweetAlert2, react-icons |
| Backend | Node.js 22 + Express 5 (CommonJS), express-session + Passport.js, bcrypt, Nodemailer, PDFKit, ExcelJS, Multer, Swagger UI (`/api-docs`) |
| Base de datos | **TiDB Cloud Starter** (MySQL 8 compatible, serverless, TLS, puerto 4000) con **39 tablas** (`utf8mb4`, `setup.js` idempotente + migraciones al arrancar); MySQL 8.0 local en Docker queda como rollback |
| Móvil | React Native 0.81 + Expo 54 (Expo Router) |
| Infraestructura | Local: Docker Compose (`jadda_frontend`, `jadda_backend`, `jadda_mysql`). Producción: **Render Free** (SPA + API) + TiDB Cloud; la guía Oracle Cloud es una alternativa documentada |
| Pruebas | Vitest, Testing Library, MSW, @playwright/test (20 specs E2E, Chromium en CI + Edge local) y `tests/smoke.mjs` (25 checks) |
| CI | GitHub Actions (lint, typecheck, unitarias+integración con cobertura, build, E2E Playwright, audit de seguridad; humo legacy solo manual `workflow_dispatch` desde 2026-10-24 y `concurrency` que cancela runs obsoletos) |

**Autenticación:** sesiones con cookie (`express-session`), no JWT. El código y la dependencia `jsonwebtoken` fueron eliminados.

---

## 3. Estado por módulo

### 3.1 Implementado y verificado

| Módulo | Evidencia principal |
|--------|---------------------|
| Registro, verificación por código, login, recuperación y cambio de contraseña | `authController`, rate limiting, pruebas E2E de humo |
| Login social Google | Passport.js + `socialLogin` |
| Catálogo, búsqueda por prefijo, filtros, variantes y reseñas | `productoController`, `Catalogo.tsx`, `ProductDetailPage.tsx` |
| Carrito, minicarrito y checkout con total recalculado en servidor | `CartContext`, `checkoutController` |
| **Pasarela de pagos Wompi (sandbox): `PENDIENTE_PAGO → CONFIRMADA/CANCELADA`** | `pagosController` + `utils/pagos.js` (firma `integrity`, checksum webhook, idempotencia `PAGOS_EVENTOS`), sondeo 3,5 s + webhook firmado, **expiración configurable de 10 min** (`PAGOS_EXPIRA_MINUTOS`) con job cada 1 min que cancela y reingresa stock, banner y chips de métodos en `ResumenCompra.tsx` |
| Carrusel de banners de portada administrable | `bannerController`, `/api/banners` (público) y `frontend/src/admin` + `ModalBanners`; imágenes 1757×432 |
| Dashboard admin rediseñado | KPIs de ingresos/pedidos de 30 días, tarjeta HOY con variación vs ayer, gráfica de ventas, top 5 y pendientes por revisar |
| Borrado inteligente y edición masiva en admin | `productoController` + modales de administración (productos, usuarios y catálogos) con confirmaciones y preservación de historial |
| Alta de proveedor y categoría al vuelo | Formularios de producto permiten crear proveedor/categoría sin salir del flujo |
| Documentación interactiva del API | Swagger UI en `/api-docs` y OpenAPI 3.0 en `/api-docs.json` (`docsRoutes.js`) |
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
| App móvil | Catálogo, cuenta, carrito/checkout, reseñas, perfil/foto, retos, vendedor y chats existentes; brechas actuales: calificar compra, avance de retos, iniciar soporte general, Wompi, push y administración. Detalle: [`../movil/docs/RFs-movil.md`](../movil/docs/RFs-movil.md). |
| RNF-002 (seguridad) | CSRF cubierto por verificación de `Origin` (`proteccionOrigen.js`); HTTPS público provisto por Render; falta evaluación formal OWASP y el despliegue local/LAN sigue aceptando HTTP |
| RNF-003 (rendimiento) | Sin pruebas de carga formales (k6/Artillery planificados) |
| RNF-004 (disponibilidad) | Backups resueltos; faltan monitoreo/uptime y alta disponibilidad. Render Free duerme tras 15 min de inactividad (~1 min de cold start) |
| Correo | Depende de SMTP configurado; en CI no se configura SMTP y los envíos se omiten de forma controlada |
| Búsqueda y filtros del catálogo | Filtros de precio/orden son client-side; el backend solo filtra por prefijo |
| Chat | Web completo (página + widget); en móvil hay hilo de devolución y bandeja del vendedor, falta bandeja de soporte del cliente |

### 3.3 Pendiente / fuera de alcance

| Tema | Nota |
|------|------|
| Publicación en Internet | **Producción activa en Render Free** (`https://jadda-frontend.onrender.com` + `https://jadda-backend.onrender.com`) con TiDB Cloud; la guía Oracle Cloud (`implantacion/06-despliegue-oracle.md`) queda como alternativa. Limitaciones del plan free: suspensión por inactividad y cold start |
| Pasarela de pagos en PRODUCCIÓN | Wompi integrada en sandbox; pasar a real exige cuenta de producción y llaves `pub_prod_/pris_prod_` en el `.env` (el código no cambia) |
| Notificaciones push móviles | No implementadas |
| Multi-instancia | El rate limiting es en memoria; requeriría Redis para escalar |
| Firma del acta UAT | Documento listo; falta ejecución y firma con el cliente |

**Pendientes activos:**

- ~~**Purga del historial git:** `git filter-repo` contra los ~66,9 MiB históricos~~ — **EJECUTADA (2026-10-22)**: pack 94,56 → 3,77 MiB (+50 MiB) con backup en bundle — [auditoria/purga-media-filter-repo.md](auditoria/purga-media-filter-repo.md).
- ~~**Definición de pasarela de pagos:** proveedor por decidir~~ — **EJECUTADA (2026-10-24)**: Wompi en modo sandbox con dinero de prueba — [auditoria/pasarela-pagos-plan.md](auditoria/pasarela-pagos-plan.md). Pendiente para producción real: cuenta Wompi de producción y llaves `pub_prod_/pris_prod_`.
- **Operación de producción:** rotar la contraseña admin real tras el primer acceso y activar `DB_USER=jadda_app` (usuario de menor privilegio ya creado).

---

## 4. Deuda técnica conocida

1. **Tipos `any`:** ~181 usos en frontend (configurados como *warning* en ESLint, no rompen CI).
2. **Dependencias de hooks:** ~16 advertencias `react-hooks/exhaustive-deps` en cargas asíncronas heredadas.
3. **Cobertura frontend:** 51.01/45.57/47.30/54.94 % (statements/branches/funciones/líneas) con umbrales 51/45/47/54; el denominador incluye componentes, contextos, utilidades y `src/admin/**`. Las páginas (`src/pages/**`) y el panel vendedor (`src/vendedor/**`) quedan fuera por diseño: se cubren con E2E.
4. **Rate limiting en memoria:** suficiente para una instancia; se reinicia con el contenedor.
5. **`setup.js`:** conserva lógica de reparación de textos con U+FFFD **a propósito** (datos legacy corruptos).
6. **Tests E2E:** el humo requiere la app levantada y un navegador; no cubre todos los flujos (los unitarios cubren lógica).
7. **Imágenes en CI:** los medios **viven en Cloudinary** (URLs absolutas en la BD y seeds puro-Cloudinary desde el plan F5); los mounts `frontend/public/images` solo almacenan en disco las subidas nuevas como **fallback** si Cloudinary no está configurado o falla — en CI algunas imágenes pueden faltar sin afectar los checks.

---

## 5. Validación reproducible

> Las cifras de la tabla de abajo son el snapshot histórico del 2026-10-24 (se conservan como evidencia de ese corte); las cifras vigentes de pruebas y cobertura están en §1.1.

```bash
# Backend unitarias (sin base de datos: MySQL está mockeado)
pnpm --prefix backend test

# Backend integración (MySQL real en Docker, puerto 3307)
docker compose -f docker-compose.test.yml up -d
pnpm --prefix backend vitest run --config vitest.integration.config.mjs

# Frontend
pnpm --prefix frontend test
pnpm --prefix frontend exec tsc -b
pnpm --prefix frontend lint

# Cobertura oficial backend (unitarias + integración fusionadas, trinquete 80)
node backend/scripts/cobertura-combinada.mjs 80

# Cobertura frontend (umbrales 51/45/47/54)
pnpm --prefix frontend test:coverage

# Build de producción
pnpm --prefix frontend build

# E2E Playwright (20 specs × Chromium/Edge, requiere app levantada o entorno CI)
pnpm --prefix tests exec playwright test

# E2E de humo (requiere contenedores arriba)
node tests/smoke.mjs
```

Resultados del corte histórico (2026-10-24) — se conservan como evidencia; las cifras vigentes están en §1.1:

| Comando | Resultado |
|---------|-----------|
| `backend test` (unitarias) | 68/68 ✅ |
| `backend` integración (MySQL real 3307) | 16/16 ✅ |
| `frontend test` | 51/51 ✅ |
| `frontend exec tsc -b` | 0 errores ✅ |
| `frontend lint` | 0 errores (205 warnings) ✅ |
| `smoke.mjs` | 23/23 ✅ |
| `pnpm build` (Docker) | ✅ |

---

## 6. Cambios consolidados por corte

> Los apartados 6.a y 6.b son **cortes históricos**: conservan las cifras y plazos vigentes en su fecha (36 tablas, expiración de pagos de 48 h, 23 checks de humo). El estado vigente es el de §1.1 y §6.0.

### 6.0 Corte vigente (2026-11-20)

- **Esquema:** 39 tablas / 302 columnas / 45 FKs en `schema.sql`. Nuevas frente al corte de octubre: `BANNERS`, `NEWSLETTER_SUSCRIPTOS`, `NEWSLETTER_ENVIOS`; columnas como `PRODUCTOS.ELIMINADO`, `PLANES_USUARIO.DIAS_COMPLETADOS`, `VENTAS.CANCELADA_POR`, `VENTAS.FECHA_EXPIRA_PAGO` y los campos de seguridad de `USUARIOS`.
- **Pagos:** la venta `PENDIENTE_PAGO` expira a los **10 min** (`PAGOS_EXPIRA_MINUTOS`) y el job de `server.js` revisa cada minuto; al expirar cancela y reingresa stock. El corte de 48 h de 6.a quedó obsoleto.
- **Funcionalidades nuevas:** carrusel de banners administrable (`/api/banners`, 1757×432), borrado inteligente en admin, dashboard rediseñado (KPIs, comparativo HOY vs ayer, gráfica de 30 días, top 5), alta de proveedor/categoría al vuelo y Swagger UI/OpenAPI en `/api-docs` y `/api-docs.json`.
- **Pruebas:** **1072 unitarias backend (75 archivos)**, **132 de integración (14 archivos)**, **581 frontend (59 archivos)**, **20 specs E2E Playwright** y **25 checks** en `tests/smoke.mjs`.
- **Cobertura:** backend fusionado **93.99/84.13/98.49/99.85 %**, trinquete `COBERTURA_UMBRAL=80` aprobado; frontend **51.01/45.57/47.30/54.94 %** con umbrales 51/45/47/54.
- **Producción:** Render Free (SPA + API) con TiDB Cloud; `render.yaml` versionado, HTTPS de plataforma y defensa CSRF por `Origin`. La guía Oracle Cloud se mantiene como alternativa.
- **Documentación:** este corte se propaga a `README.md`, calidad/testing, diagramas, RF/HU/RNF, UAT, implantación, manuales y entregables.

### 6.a Pasarela de pagos Wompi + CI ajustado (2026-10-24)

- **Backend:** `backend/utils/pagos.js` (firma `integrity` SHA256, checksum del webhook timing-safe, cliente con reintentos) · `pagosController.js` + `pagosRoutes.js` (`/api/pagos`: config público, pagar 8/5 min, estado 90/min, webhook sin sesión 60/min) · tabla nueva `PAGOS_EVENTOS` (idempotencia UNIQUE `EXTERNO_ID+CHECKSUM`; 36 tablas) · job de `server.js` que cancela ventas `PENDIENTE_PAGO` de más de 48 h con reingreso de stock.
- **Frontend:** banner del checkout invita a pagar en la pasarela (cero datos de tarjeta en el sitio) y redirige con `urlCheckout`; `CompraExitosa` sondea cada 3,5 s; `DetalleCompra` y `MisCompras` muestran "PAGAR CON WOMPI" en pendientes; UIs alineadas contra `PENDIENTE_PAGO`.
- **Verificación:** suites 68 unitarias / 16 integración / 51 frontend / 40 E2E / 23 humo; sondas E2E temporales (25/25 API en contenedor + 10/10 UI) borradas tras el uso. Commits `736ae2e`, `553ce4a` en `main`.
- **CI:** `concurrency` para cancelar runs obsoletos y humo legacy solo manual (`workflow_dispatch`).
- **Documentación alineada:** RF-018/HU-018/RF-020, diccionario (36 tablas), matriz-rotación (68), manuales, implantación, UAT (TP-036..038), estado-brechas F6→EJECUTADO.

### 6.b Limpieza integral (2026-10-20)

- **Archivos muertos eliminados:** `frontend/src/index.js`, `AdminRoute.tsx` duplicado, `resenaController.js`, `checkImagenes.js`, `reinicio.tmp`, `cookies.txt`, 9 CSS sin referencias y artefactos de pruebas.
- **Suite E2E Playwright ACTIVA (nota 2026-10-22):** `tests/e2e/smoke.spec.ts` (20 specs) + `tests/playwright.config.ts` con 2 proyectos (Chromium + MS Edge) y el job `e2e-playwright` en CI. `tests/smoke.mjs` sigue como **complemento** de humo local (23 checks).
- **Dependencias sin uso eliminadas:** `axios`, `jsonwebtoken`, `@types/*`, `typescript` (backend, **supertest se conservó** porque usan las pruebas de integración); `@react-oauth/google`, `jwt-decode`, `react-bootstrap-icons`, `@testing-library/user-event`, `@types/jsdom` (frontend); 3 paquetes en móvil. Lockfiles regenerados.
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
| `backend/server.js` | API, sesiones, estáticos, scheduler de newsletter y job de expiración de pagos (cada 1 min) |
| `tests/smoke.mjs` | Suite E2E de humo |
| `.github/workflows/ci.yml` | Integración continua |
| `frontend/src/App.tsx` | Rutas y layouts |
| `docs/` | Requisitos, calidad, implantación, manuales y aceptación |
