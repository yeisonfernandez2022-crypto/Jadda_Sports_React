# Estado del proyecto — JADDA SPORTS

> **Corte de calidad:** 2026-11-14 · **Alcance funcional:** el documento conserva abajo el snapshot funcional de `main` del 2026-10-24. Las cifras vigentes de pruebas y cobertura se actualizan en §1.1 con ejecuciones locales de esta fecha; no se deben comparar con los snapshots históricos posteriores sin revisar sus cortes.
> Este documento refleja lo que **realmente hace el código**, no lo que estaba planificado.

---

## 1. Resumen ejecutivo

| Indicador | Valor |
|-----------|-------|
| Requisitos funcionales documentados | **61** (RF-001…RF-061) |
| Historias de usuario documentadas | **61** (HU-001…HU-061) |
| Requisitos no funcionales documentados | **17** (RNF-001…RNF-017) |
| Tablas en la base de datos | **36** (incluye `PAGOS_EVENTOS` de la pasarela) |
| Pruebas backend unitarias | **354** (36 archivos; suite actual) |
| Pruebas backend de integración | **132** (14 archivos; MySQL real, puerto 3307; 2026-11-14) |
| Pruebas frontend | **168** (19 archivos) |
| Pruebas E2E Playwright | **20 specs × Chromium en CI** (MS Edge se ejecuta localmente donde está instalado) |
| Cobertura backend | **FUSIONADA unitarias + integración: 70.48 % statements · 61.61 % branches · 79.17 % funciones · 94.43 % líneas** (2026-11-14; gate 60 % pasa). |
| Cobertura frontend | **28.16 % statements · 24.61 % branches · 25.88 % funciones · 30.37 % líneas** (Vitest, 2026-11-14) |

**Conclusión:** el producto web (tienda + panel admin + marketplace de vendedores + chat) está **funcionalmente completo** para el alcance del proyecto de grado. La app móvil está **parcial**: sus flujos y brechas actuales se detallan en [`../movil/docs/RFs-movil.md`](../movil/docs/RFs-movil.md). La deuda principal es de calidad interna (tipos `any`, cobertura frontend) y de infraestructura de producción (HTTPS/CSRF, rate limit distribuido).

### 1.1 Medición vigente de calidad — 2026-11-14

| Suite / métrica | Resultado | Reporte / nota |
|---|---:|---|
| Backend unitarias | 354 tests · 36 archivos | Cobertura RAW: st 31.32 % (1758/5613), br 33.95 % (1303/3837), fn 39.01 % (206/528), líneas 31.11 % (1635/5254). Los tests pasaron; la corrida con coverage emitió además un error de teardown del worker. |
| Backend integración | 132 tests · 14 archivos | 0 fallos; cobertura RAW: st 54.62 % (3066/5613), br 40.21 % (1543/3837), fn 57.38 % (303/528), líneas 56.69 % (2979/5254). |
| Backend combinada | Fusión unitarias + integración | st 70.48 % (3956/5613), br 61.61 % (2364/3837), fn 79.17 % (418/528), líneas 94.43 % (11597/12281). `node scripts/cobertura-combinada.mjs 60`: gate aprobado. |
| Frontend | 168 tests · 19 archivos | st 28.16 % (631/2240), br 24.61 % (413/1678), fn 25.88 % (153/591), líneas 30.37 % (562/1850). |

El conteo de tests corresponde a la suite actual. Los porcentajes por suite backend son RAW y no se suman entre sí; la cifra oficial de backend es la combinada indicada arriba. Los umbrales frontend configurados siguen en 28/24/25/30 %.

Re-verificación del 2026-11-15 (misma suite): 354/354 unitarias · 132/132 integración · 168/168 frontend; fusión con gate 60 aprobada — st 70.48 % (3956/5613) · br 61.64 % (2365/3837) · fn 79.17 % (418/528) · líneas 94.43 % (11597/12281). La única desviación frente a la tabla es ±1 rama de la suite de integración (61.61 → 61.64), varianza normal de corrida; la corrida unitaria del 2026-11-15 cerró limpia, sin el error de teardown observado el 2026-11-14.

---

## 2. Stack real

| Capa | Tecnología |
|------|------------|
| Frontend web | React 19 + TypeScript 5.9 + Vite 8, React Router, SweetAlert2, react-icons |
| Backend | Node.js 22 + Express 5 (CommonJS), express-session + Passport.js, bcrypt, Nodemailer, PDFKit, ExcelJS, Multer |
| Base de datos | MySQL 8.0 (36 tablas, `utf8mb4`, migraciones idempotentes al arrancar) |
| Móvil | React Native 0.81 + Expo 54 (Expo Router) |
| Infraestructura | Docker Compose (`jadda_frontend`, `jadda_backend`, `jadda_mysql`) |
| Pruebas | Vitest, Testing Library, MSW, @playwright/test (E2E 2 navegadores) + playwright-core (humo) |
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
| **Pasarela de pagos Wompi (sandbox): `PENDIENTE_PAGO → CONFIRMADA/CANCELADA`** | `pagosController` + `utils/pagos.js` (firma `integrity`, checksum webhook, idempotencia `PAGOS_EVENTOS`), sondeo 3,5 s + webhook firmado, expiración 48 h, banner y chips de métodos en `ResumenCompra.tsx` |
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
3. **Cobertura frontend:** 28.16/24.61/25.88/30.37 % (statements/branches/funciones/líneas) sobre componentes, contextos y utilidades; páginas y panel vendedor están excluidos del denominador Vitest actual.
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

# Cobertura
pnpm --prefix backend test:coverage && pnpm --prefix frontend test:coverage

# Build de producción
pnpm --prefix frontend build

# E2E Playwright (20 specs × Chromium/Edge, requiere app levantada o entorno CI)
pnpm --prefix tests exec playwright test

# E2E de humo (requiere contenedores arriba)
node tests/smoke.mjs
```

Resultados de la última ejecución local (2026-10-24):

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
| `backend/server.js` | API, sesiones, estáticos y scheduler de newsletter |
| `tests/smoke.mjs` | Suite E2E de humo |
| `.github/workflows/ci.yml` | Integración continua |
| `frontend/src/App.tsx` | Rutas y layouts |
| `docs/` | Requisitos, calidad, implantación, manuales y aceptación |
