# Matriz de Rotación de Pruebas - JADDA SPORTS

> **Versión**: 1.2
> **Fecha**: 2026-10-24
> **Alcance**: Cobertura completa de la pirámide de pruebas
> **Verificado contra el repositorio (oct 2026)**: 68 unitarios backend · 16 integración · 51 frontend · 40 E2E Playwright · 25 definiciones de smoke

---

## 1. Resumen Ejecutivo

| Nivel | Tests | Herramienta | Frecuencia | Tiempo | Cobertura |
|-------|-------|-------------|------------|--------|-----------|
| Unit Backend | 68 | Vitest | Cada push/PR | ~3s | Umbral global 30/30/30/30% (backend/vitest.config.mjs) |
| Unit Frontend | 51 | Vitest + RTL | Cada push/PR | ~15s | 36.6/39.4/35.7/40.5% (umbral exigido 33/32/28/37%) |
| Integración Backend | 16 | Vitest + Supertest + MySQL real (p. 3307) | Cada push/PR | ~30s | Complementaria sobre BD real |
| E2E Playwright | 40 | @playwright/test | Cada push/PR | ~40s | Flujos críticos |
| Smoke Legacy | 25 | playwright-core | Solo manual (desde 2026-10-24) | ~15s | API + UI básico |

---

## 2. Matriz Detallada por Módulo

### 2.1 Autenticación y Usuarios

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Registro usuario | ✅ `authController.registro` | ✅ POST /api/auth/registro | ✅ Login/registro flow | Alto | Backend | ✅ |
| Login (credenciales) | ✅ Validación campos | ✅ POST /api/auth/login | ✅ Login admin/vendedor | Crítico | Backend | ✅ |
| Login fallido (anti-enum) | ✅ 401 unificado | ✅ 401 sin revelar existencia | ✅ Password incorrecta | Alto | Backend | ✅ |
| Verificación email | ✅ TOKEN/TOKEN_EXPIRA | ✅ POST /api/auth/confirmar | Pendiente | Medio | Backend | ⚠️ |
| Recuperación contraseña | ✅ Generar/enviar código | ✅ Flujo completo | Pendiente | Medio | Backend | ⚠️ |
| Cambio contraseña forzado | ✅ DEBE_CAMBIAR_PASSWORD | ✅ POST /api/auth/cambiar-password | Pendiente | Alto | Backend | ⚠️ |
| Cambio email (2 pasos) | ✅ TOKEN + verificación | ✅ Flujo completo | Pendiente | Alto | Backend | ⚠️ |
| Perfil (GET/PUT) | ✅ Validaciones | ✅ CRUD perfil + foto | ✅ UI Perfil | Medio | Frontend | ✅ |
| Subida foto perfil | ✅ Base64 + validación | ✅ POST /api/auth/foto | Pendiente | Medio | Frontend | ⚠️ |
| Social Login (Google/FB) | ✅ Mock Passport | ✅ Callbacks OAuth | Pendiente | Bajo | Backend | ⚠️ |

### 2.2 Catálogo y Productos

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Listar productos | ✅ `obtenerProductos` | ✅ GET /api/productos | ✅ Catálogo público | Alto | Backend | ✅ |
| Detalle producto | ✅ `obtenerProductoPorId` | ✅ GET /api/productos/:id | ✅ UI Detalle | Alto | Backend | ✅ |
| Variantes (color/talla) | ✅ `obtenerVariantes` | ✅ GET /api/productos/:id/variantes | ✅ Selector modal | Alto | Backend | ✅ |
| Búsqueda y filtros | ✅ Prefix matching | ✅ Query params | ✅ UI Catálogo | Alto | Backend | ✅ |
| Productos relacionados | ✅ `obtenerRelacionados` | ✅ GET /api/productos/relacionados | Pendiente | Medio | Backend | ⚠️ |
| Recomendaciones | ✅ `obtenerRecomendados` | ✅ GET /api/productos/recomendados | Pendiente | Medio | Backend | ⚠️ |
| Stock y badges | ✅ Cálculo STOCK | ✅ Badges UI | ✅ UI ProductCard | Alto | Frontend | ✅ |
| Descuentos y cupones | ✅ `reglasCupones` | ✅ Validar/aplicar | ✅ Panel cupones | Alto | Backend | ✅ |

### 2.3 Carrito y Checkout

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Agregar al carrito | ✅ `agregarAlCarrito` | ✅ POST /api/carrito/agregar | ✅ UI + API | Crítico | Backend | ✅ |
| Actualizar cantidad | ✅ `actualizarCantidad` | ✅ PUT /api/carrito/actualizar | ✅ Stepper UI | Alto | Backend | ✅ |
| Validación stock | ✅ Pre-check | ✅ 400 si stock insuficiente | ✅ 400 en checkout | Crítico | Backend | ✅ |
| Cupón mínimo escalado | ✅ `montoMinimoSegunPorcentaje` | ✅ 400 bajo mínimo | ✅ Checkout min/max | Alto | Backend | ✅ |
| Panel cupones disponibles | ✅ `listarParaCheckout` | ✅ GET /api/cupones/disponibles | ✅ UI Checkout | Alto | Frontend | ✅ |
| Procesar compra | ✅ Transacción completa + `FOR UPDATE` + guard 409 | ✅ POST /api/checkout/procesar · concurrencia: 2 carritos simultáneos → 200 + 409 | ✅ Flujo completo | Crítico | Backend | ✅ |
| Sesión de pago Wompi | ✅ `pagos.test.js` (firma `integrity`, URL del widget, `gatewayActivo`) | ⚠️ Sin test de integración propio | ⚠️ Sondeo temporal (no versionado) | Crítico | Backend | ⚠️ |
| Pull de estado de pago | ✅ Lógica de estados (`estadoVenta`) | ⚠️ Sin test de integración propio | Pendiente | Crítico | Backend | ⚠️ |
| Webhook Wompi firmado | ✅ `verificarEventosWompi` + `compararSegura` (11 tests) | Pendiente | Pendiente | Crítico | Backend | ⚠️ |
| Expiración pendiente de pago (48 h) | ✅ Lógica validada en sondeo E2E | Pendiente | Pendiente | Alto | Backend | ⚠️ |
| Cálculo envío | ✅ `calcularCostoEnvio` | ✅ GET /api/envio/calcular | ✅ Deptos + gratis | Alto | Backend | ✅ |
| Factura PDF | ✅ `facturaPdf.js` | ✅ GET /api/compras/:id/factura | ✅ Descarga blob | Alto | Backend | ✅ |
| Email confirmación | ✅ Mock Nodemailer | ✅ Adjunto PDF | Pendiente | Alto | Backend | ⚠️ |

### 2.4 Pedidos y Post-Venta

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Mis compras | ✅ `obtenerCompras` | ✅ GET /api/compras | ✅ UI MisCompras | Alto | Backend | ✅ |
| Detalle compra | ✅ `obtenerCompraPorId` | ✅ GET /api/compras/:id | ✅ UI DetalleCompra | Alto | Backend | ✅ |
| Cancelar pedido | ✅ `cancelarCompra` | ✅ POST /api/compras/:id/cancelar | ✅ UI + stock | Crítico | Backend | ✅ |
| RN-010 (no cancelar enviado) | ✅ Validación EN_CAMINO/ENTREGADO | ✅ 400 | ✅ | Crítico | Backend | ✅ |
| Dirección pedido | ✅ `actualizarDireccionCompra` | ✅ PUT /api/compras/:id/direccion | ✅ Inline edit | Alto | Backend | ✅ |
| Devoluciones (solicitar) | ✅ Validaciones | ✅ POST /api/devoluciones | ✅ UI DevolverPedido | Alto | Backend | ✅ |
| Devoluciones (procesar admin) | ✅ 4 decisiones | ✅ POST /api/devoluciones/admin/:id/procesar | ✅ Admin UI | Alto | Backend | ✅ |
| Devoluciones vendedor | ✅ 4 decisiones | ✅ Vendedor UI | ✅ Vendedor panel | Alto | Backend | ✅ |
| Evidencias multi-archivo | ✅ Upload + preview | ✅ POST /api/devoluciones/:id/evidencias | Pendiente | Medio | Frontend | ⚠️ |
| Reembolsos | ✅ Flujo CANCELADA | ✅ POST /api/compras/:id/reembolso | ✅ UI ReembolsoDetalle | Alto | Backend | ✅ |
| Notificaciones estado | ✅ `notificarCambioEstado` | ✅ In-app + email mock | Pendiente | Medio | Backend | ⚠️ |

### 2.5 Panel Admin

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Dashboard KPIs | ✅ `obtenerDashboard` | ✅ GET /api/admin/dashboard | ✅ UI AdminDashboard | Alto | Backend | ✅ |
| Gestión productos | ✅ CRUD + approve/reject | ✅ GET/POST/PUT/DELETE /api/admin/productos | ✅ UI AdminProductos | Alto | Backend | ✅ |
| CRUD Categorías | ✅ `crear/actualizar/eliminarCategoria` | ✅ CRUD /api/productos/categorias | ✅ UI AdminCategorias | Alto | Backend | ✅ |
| Gestión órdenes | ✅ `obtenerTodasLasCompras` | ✅ GET /api/admin/compras | ✅ UI AdminOrdenes | Alto | Backend | ✅ |
| Estados envío | ✅ Stepper 5 pasos | ✅ PUT /api/admin/compras/:id/envio | ✅ UI Stepper | Alto | Backend | ✅ |
| Eliminar compra cancelada | ✅ `eliminarCompra` | ✅ DELETE /api/admin/compras/:id | ✅ UI botón eliminar | Medio | Backend | ✅ |
| Usuarios (ver detalle) | ✅ `obtenerUsuarioDetalle` | ✅ GET /api/admin/usuarios/:id | ✅ Modal au-modal | Alto | Backend | ✅ |
| Vendedores (aprobar/rechazar) | ✅ `procesarSolicitud` | ✅ POST /api/vendedor/admin/:id/procesar | ✅ UI AdminVendedores | Alto | Backend | ✅ |
| Reportes ventas | ✅ `reporteVentas` | ✅ GET /api/admin/reportes/ventas | ✅ UI AdminReportes | Alto | Backend | ✅ |
| Top vendidos | ✅ `masVendidos` | ✅ GET /api/admin/analytics/mas-vendidos | ✅ UI tabla | Medio | Backend | ✅ |
| Descarga Excel/PDF | ✅ `reporteExcel/reportePdf` | ✅ GET /api/admin/reportes/excel\|pdf | ✅ Blob download | Alto | Backend | ✅ |

### 2.6 Marketplace Vendedor

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Solicitud vendedor | ✅ `solicitarVendedor` | ✅ POST /api/vendedor/solicitud | ✅ UI SerVendedor | Alto | Backend | ✅ |
| Panel vendedor (KPIs) | ✅ `miTienda` | ✅ GET /api/vendedor/mi-tienda | ✅ UI VendedorDashboard | Alto | Backend | ✅ |
| CRUD productos vendedor | ✅ CRUD propio | ✅ POST/PUT/DELETE /api/vendedor/productos | ✅ UI VendedorProductos | Alto | Backend | ✅ |
| Ventas vendedor | ✅ `ventasVendedor` | ✅ GET /api/vendedor/ventas | ✅ UI VendedorVentas | Alto | Backend | ✅ |
| Reportes vendedor | ✅ `reportesVendedor` | ✅ GET /api/vendedor/reportes | ✅ UI VendedorReportes | Alto | Backend | ✅ |
| Descarga Excel/PDF vendedor | ✅ `reporteVendedorExcel/Pdf` | ✅ GET /api/vendedor/reportes/excel\|pdf | ✅ Blob download | Alto | Backend | ✅ |
| Gestión envíos vendedor | ✅ Stepper propio | ✅ PUT /api/vendedor/ventas/:id/envio | ✅ UI VendedorVentas | Alto | Backend | ✅ |
| Chat vendedor | ✅ Iniciar/mensajes | ✅ Chat API | ✅ UI VendedorChats | Alto | Backend | ✅ |

### 2.7 Chat y Disputas

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Iniciar chat (tipos) | ✅ `iniciar` idempotente | ✅ POST /api/chat/iniciar | ✅ UI Chats | Alto | Backend | ✅ |
| Mensajes (enviar/leer) | ✅ `enviar` + marcar leídos | ✅ POST/GET /api/chat/:id/mensajes | ✅ UI burbujas | Alto | Backend | ✅ |
| Escalación a JADDA | ✅ `escalar` (hilos separados) | ✅ POST /api/chat/:id/escalar | ✅ UI escalar | Crítico | Backend | ✅ |
| Hilos separados post-escalación | ✅ `PARTE` column | ✅ Aislamiento 403 | ✅ UI hilos | Alto | Backend | ✅ |
| Filtrado groserías | ✅ `groserias.js` | ✅ Censura en enviar | Pendiente | Medio | Backend | ⚠️ |
| Notificaciones chat | ✅ `notificarUsuarios` + rutas por rol | ✅ Rutas /admin/chats, /vendedor/chats, /chats | Pendiente | Medio | Backend | ⚠️ |

### 2.8 Retos y Gamificación

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Inscripción retos | ✅ `unirseReto` | ✅ POST /api/retos/unirse/:id_reto | ✅ UI Retos | Medio | Backend | ✅ |
| Reporte avance (base64) | ✅ `reportarProgreso` | ✅ POST /api/retos/progreso/:id_reto_usuario (legacy) | ✅ UI modal | Alto | Backend | ✅ |
| Reporte avance (multipart) | ✅ Multer + streaming | ✅ POST /api/retos/progreso/:id_reto_usuario (multipart, 25 MB × 5) | Pendiente | Alto | Backend | ⚠️ |
| Aprobación admin | ✅ `aprobarEvidencia` | ✅ POST /api/retos/admin/evidencias/:id/aprobar | ✅ UI AdminRetos | Alto | Backend | ✅ |
| Generación cupón RETO- | ✅ Cupón único + USADO=0 | ✅ Al alcanzar meta | Pendiente | Alto | Backend | ⚠️ |
| Planes entrenamiento | ✅ `generarPlan` + `misPlanes` | ✅ GET /api/planes · POST /api/planes/generar | Pendiente | Medio | Backend | ⚠️ |

### 2.9 Notificaciones y Newsletter

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Notificaciones in-app | ✅ `crearNotificacion` | ✅ CRUD /api/notificaciones | Pendiente | Medio | Backend | ⚠️ |
| Notificaciones estado pedido | ✅ `notificarCambioEstado` | ✅ In-app + email mock | Pendiente | Alto | Backend | ⚠️ |
| Newsletter auto (72h) | ✅ Scheduler + plantillas | ✅ POST /api/newsletter/enviar | Pendiente | Bajo | Backend | ⚠️ |
| Desuscripción | ✅ Token + confirmación | ✅ GET/POST /api/newsletter/desuscribir | Pendiente | Bajo | Backend | ⚠️ |

### 2.10 Frontend - Componentes UI Críticos

Solo AuthModal (30), ProductCard (20) y reglasCupon (1) tienen tests unitarios; el resto de la UI se valida por E2E (40 tests × 2 navegadores).

| Componente | Test Unitario | Test E2E | Riesgo | Estado |
|------------|---------------|----------|--------|--------|
| AuthModal | ✅ 30 tests | ✅ Login/registro flow | Crítico | ✅ |
| ProductCard | ✅ 20 tests | ✅ Catálogo/Detalle | Alto | ✅ |
| SelectorVarianteModal | ⚠️ Sin unit propios | ✅ Modal variantes | Alto | ⚠️ |
| FloatingCart + MiniCartMenu | ⚠️ Sin unit propios | ✅ Carrito persistente | Alto | ⚠️ |
| AuthModalContext | ⚠️ Ejercitado por los 30 tests de AuthModal | ✅ Login persistente | Alto | ✅ |
| ChatWidget + FloatingChat | ⚠️ Sin unit propios | ✅ Widget + página | Alto | ⚠️ |
| ResumenCompra | ⚠️ Sin unit propios | ✅ Checkout flow | Crítico | ⚠️ |
| DevolverPedido | ⚠️ Sin unit propios | ✅ Flujo devolución | Alto | ⚠️ |
| DevolucionEstado | ⚠️ Sin unit propios | ✅ Estado devolución | Alto | ⚠️ |
| AdminProductos / AdminCategorias / AdminOrdenes | ⚠️ Sin unit propios | ✅ Admin UI | Alto | ⚠️ |
| VendedorDashboard / VendedorProductos / VendedorReportes | ⚠️ Sin unit propios | ✅ Panel vendedor | Alto | ⚠️ |

### 2.11 App Móvil (React Native)

| Área | Test Unitario | Test E2E | Riesgo | Estado |
|------|---------------|----------|--------|--------|
| Auth (login/registro/verificar) | Pendiente | Pendiente | Crítico | ❌ |
| Catálogo + búsqueda | Pendiente | Pendiente | Alto | ❌ |
| Detalle producto + variantes | Pendiente | Pendiente | Alto | ❌ |
| Carrito + checkout | Pendiente | Pendiente | Crítico | ❌ |
| Perfil + foto + métodos pago | Pendiente | Pendiente | Alto | ❌ |
| Retos + avance | Pendiente | Pendiente | Medio | ❌ |
| Chat (devolución + vendedor) | Pendiente | Pendiente | Medio | ❌ |
| Push notifications | Pendiente | Pendiente | Bajo | ❌ |

---

## 3. Evidencia de Tests Implementados

### Backend Unit Tests (68 tests)
```
backend/utils/envio.test.js                          14 tests  ✅
backend/utils/numeroPedido.test.js                    4 tests  ✅
backend/utils/reglasCupones.test.js                  10 tests  ✅
backend/utils/pagos.test.js                          11 tests  ✅ (crypto Wompi: firma integridad,
                                                                URL widget firmada, checksum webhook,
                                                                comparaSegura, gateway/ambiente)
backend/tests/unitarios/agrupacion_y_formato.test.js  9 tests  ✅
backend/middlewares/rateLimiter.test.js               5 tests  ✅
backend/middlewares/proteccionOrigen.test.js         10 tests  ✅
backend/middlewares/registroPeticiones.test.js        5 tests  ✅
Total: 68 tests passing
```

### Backend Integration Tests (16 tests)
```
backend/tests/integration/basic.test.js               14 tests  ✅
  - Health checks (3)
  - Autenticación (3)
  - Cupones (2)
  - Carrito (1)
  - Base de datos real (5)
backend/tests/integration/checkout-concurrencia.test.js  2 tests  ✅
  - 2 checkouts simultáneos contra la última unidad (200 + 409)
  - Compra sin competencia descuenta el stock exacto
Se ejecutan contra MySQL real en el puerto 3307:
  local:  docker compose -f backend/docker-compose.test.yml up -d
  CI:     servicio GitHub Actions mysql:8.0 (3307:3306)
  Nota:   PROJECT_ROOT se resuelve como const '../../..' en
          backend/tests/integration/setup.js (no en el config de vitest)
```

### Frontend Unit Tests (51 tests)
```
src/components/AuthModal.test.tsx        30 tests  ✅
src/components/ProductCard.test.tsx      20 tests  ✅
src/utils/reglasCupon.test.ts            1 test    ✅
Total: 51 tests passing
```

### E2E Playwright (40 tests = 20 Chromium + 20 MS Edge)
```
tests/e2e/smoke.spec.ts                  20 tests × 2 browsers = 40  ✅
  Autenticación: 3
  Catálogo: 2
  Reglas de compra: 3
  Checkout: 2
  Chats/Disputas: 6
  UI páginas críticas: 4
```

### Smoke Legacy (25 checks definidos)
```
tests/smoke.mjs                          25 checks ✅
  Autenticación: 3
  Catálogo: 2
  Reglas de compra/cupones: 5
  Checkout/cancelación: 5
  Chats/disputas: 4
  Admin × ventas de vendedor: 2
  UI (requieren navegador): 4
```

---

## 4. Frecuencia y Rotación

| Tipo | Frecuencia | Trigger | Tiempo Máx |
|------|------------|---------|------------|
| Unit (back+front) | Cada push/PR | GitHub Actions (ci.yml) | 2 min |
| Integración Backend | Cada push/PR | GitHub Actions + docker-compose.test.yml (MySQL p. 3307) | 2 min |
| Build | Cada push/PR | GitHub Actions | 3 min |
| E2E Playwright | Cada push/PR | GitHub Actions (no hay schedule nocturno en ci.yml) | 2 min |
| Smoke Legacy | Solo manual |workflow_dispatch (desde 2026-10-24; el job `e2e-smoke` se salta en push/PR) | 1 min |
| Cobertura | Cada push/PR | `test:coverage` de backend y frontend (artefactos en Actions) | ~1 min |

**Cómo ejecutar las suites localmente**
- Unit backend (68): `corepack pnpm exec vitest run` en `backend/`.
- Integración (16): `docker compose -f backend/docker-compose.test.yml up -d` (MySQL en 3307) y luego `corepack pnpm exec vitest run --config vitest.integration.config.mjs` en `backend/`.
- Unit frontend (51): `corepack pnpm exec vitest run --coverage` en `frontend/`.
- E2E (40): backend arriba + preview en 5173 → `pnpm --prefix tests exec playwright test`.
- Smoke: con backend y preview arriba → `node tests/smoke.mjs` (variables `API_URL` y `WEB_URL`).

---

## 5. Métricas de Calidad por Módulo

| Módulo | Unit Coverage | Integración | E2E | Riesgo Residual |
|--------|---------------|-------------|-----|-----------------|
| Auth | 100% (utils) | ✅ | ✅ | Bajo |
| Catálogo | 100% (utils) | ✅ | ✅ | Bajo |
| Carrito/Checkout | 100% (utils) | ✅ | ✅ | Bajo |
| Admin | 0% (controllers) | ✅ | ✅ | Medio |
| Vendedor | 0% (controllers) | ✅ | ✅ | Medio |
| Chat/Disputas | 0% (controllers) | ⚠️ | ✅ | Medio |
| Retos | 0% (controllers) | ⚠️ | ⚠️ | Medio |
| Notificaciones | 0% (controllers) | ❌ | ❌ | Alto |
| Móvil | 0% | ❌ | ❌ | Crítico |

---

## 6. Plan de Mejora (Próximos 30 días)

| Prioridad | Acción | Módulo | Esfuerzo |
|-----------|--------|--------|----------|
| 1 | Tests unitarios controllers críticos (auth, checkout, admin) | Backend | 2 días |
| 2 | Tests integración chat + notificaciones | Backend | 1 día |
| 3 | Tests unitarios móviles (Jest + Expo) | Móvil | 3 días |
| 4 | Tests E2E flujos móviles (Detox o Playwright RN) | Móvil | 2 días |
| 5 | Tests notificaciones in-app + email | Backend | 1 día |
| 6 | Tests retroalimentación (reseñas, PQR) | Backend | 1 día |
| 7 | Tests de accesibilidad (axe-playwright) | Frontend | 1 día |

---

## 7. Responsables

| Rol | Nombre | Áreas |
|-----|--------|-------|
| QA Lead | - | Estrategia general, CI/CD, métricas |
| Backend Dev | - | Unit/Integración backend, API tests |
| Frontend Dev | - | Unit/Component frontend, E2E UI |
| Mobile Dev | - | Tests móviles, App tests |
| DevOps | - | CI/CD, infraestructura test, reportes |

---

## 8. Criterios de Aceptación por Release

| Criterio | Mínimo | Objetivo |
|----------|--------|----------|
| Unit tests passing | 100% | 100% |
| Integration tests passing | 100% | 100% |
| E2E Playwright passing | 100% | 100% |
| Build success | ✅ | ✅ |
| Lint errors | 0 | 0 |
| TypeScript errors | 0 | 0 |
| Backend coverage (tested files) | ≥30% | ≥80% |
| Frontend coverage | ≥33/32/28/37% | ≥50% |
| E2E critical flows | 100% | 100% |
| No flaky tests | 0 | 0 |

---

## 9. Herramientas y Versiones

| Herramienta | Versión | Uso |
|-------------|---------|-----|
| Vitest | 5.0.3 | Unit + Integración |
| @vitest/coverage-v8 | 5.0.3 | Cobertura |
| React Testing Library | 16.3.3 | Componentes React |
| @testing-library/user-event | 16.3.3 | Interacciones usuario |
| MSW | 3.0.2 | Mock API |
| Supertest | 7.3.1 | API HTTP tests |
| @playwright/test | 1.64.1 | E2E oficial |
| playwright-core | 1.48.2 | Smoke legacy |
| MySQL | 8.0 | BD real tests |
| Docker Compose | v5 | Orquestación test DB |
| GitHub Actions | - | CI/CD |

---

*Documento vivo - actualizar con cada release mayor*