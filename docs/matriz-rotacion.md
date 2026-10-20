# Matriz de Rotación de Pruebas - JADDA SPORTS

> **Versión**: 1.0
> **Fecha**: 2026-10-20
> **Alcance**: Cobertura completa de la pirámide de pruebas

---

## 1. Resumen Ejecutivo

| Nivel | Tests | Herramienta | Frecuencia | Tiempo | Cobertura |
|-------|-------|-------------|------------|--------|-----------|
| Unit Backend | 42 | Vitest | Cada push | ~3s | 100% (archivos testeados) |
| Unit Frontend | 51 | Vitest + RTL | Cada push | ~4s | 34/37/33/38% |
| Integración Backend | 14 | Vitest + Supertest + MySQL | Cada push | ~30s | ~16% complementaria |
| E2E Playwright | 40 | @playwright/test | Cada push + nightly | ~40s | Flujos críticos |
| Smoke Legacy | 23 | playwright-core | Manual + CI | ~15s | API + UI básico |

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
| Procesar compra | ✅ Transacción completa | ✅ POST /api/checkout/procesar | ✅ Flujo completo | Crítico | Backend | ✅ |
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
| Inscripción retos | ✅ `inscribirse` | ✅ POST /api/retos/inscribir | ✅ UI Retos | Medio | Backend | ✅ |
| Reporte avance (base64) | ✅ `reportarProgreso` | ✅ POST /api/retos/avance | ✅ UI modal | Alto | Backend | ✅ |
| Reporte avance (multipart) | ✅ Multer + streaming | ✅ POST /api/retos/avance (multipart) | Pendiente | Alto | Backend | ⚠️ |
| Aprobación admin | ✅ `aprobarEvidencia` | ✅ POST /api/retos/admin/evidencias/:id/aprobar | ✅ UI AdminRetos | Alto | Backend | ✅ |
| Generación cupón RETO- | ✅ Cupón único + USADO=0 | ✅ Al alcanzar meta | Pendiente | Alto | Backend | ⚠️ |
| Planes entrenamiento | ✅ `generarPlan` | ✅ POST /api/planes | Pendiente | Medio | Backend | ⚠️ |

### 2.9 Notificaciones y Newsletter

| Área | Test Unitario | Test Integración | Test E2E | Riesgo | Responsable | Estado |
|------|---------------|------------------|----------|--------|-------------|--------|
| Notificaciones in-app | ✅ `crearNotificacion` | ✅ CRUD /api/notificaciones | Pendiente | Medio | Backend | ⚠️ |
| Notificaciones estado pedido | ✅ `notificarCambioEstado` | ✅ In-app + email mock | Pendiente | Alto | Backend | ⚠️ |
| Newsletter auto (72h) | ✅ Scheduler + plantillas | ✅ POST /api/newsletter/enviar | Pendiente | Bajo | Backend | ⚠️ |
| Desuscripción | ✅ Token + confirmación | ✅ GET/POST /api/newsletter/desuscribir | Pendiente | Bajo | Backend | ⚠️ |

### 2.10 Frontend - Componentes UI Críticos

| Componente | Test Unitario | Test E2E | Riesgo | Estado |
|------------|---------------|----------|--------|--------|
| AuthModal | ✅ 30 tests | ✅ Login/registro flow | Crítico | ✅ |
| ProductCard | ✅ 20 tests | ✅ Catálogo/Detalle | Alto | ✅ |
| SelectorVarianteModal | ✅ 15 tests | ✅ Modal variantes | Alto | ✅ |
| FloatingCart + MiniCartMenu | ✅ Contexto + UI | ✅ Carrito persistente | Alto | ✅ |
| AuthModalContext | ✅ Estado global | ✅ Login persistente | Alto | ✅ |
| ChatWidget + FloatingChat | ✅ Contexto + UI | ✅ Widget + página | Alto | ✅ |
| ResumenCompra | ✅ Validaciones + UI | ✅ Checkout flow | Crítico | ✅ |
| DevolverPedido | ✅ Form + evidencias | ✅ Flujo devolución | Alto | ✅ |
| DevolucionEstado | ✅ Timeline + evidencias | ✅ Estado devolución | Alto | ✅ |
| AdminProductos / AdminCategorias / AdminOrdenes | ✅ Tablas + modales | ✅ Admin UI | Alto | ✅ |
| VendedorDashboard / VendedorProductos / VendedorReportes | ✅ KPIs + tablas | ✅ Panel vendedor | Alto | ✅ |

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

### Backend Unit Tests (42 tests)
```
backend/utils/envio.test.js              23 tests  ✅
backend/utils/numeroPedido.test.js       4 tests   ✅
backend/utils/reglasCupones.test.js      15 tests  ✅
Total: 42 tests passing
```

### Backend Integration Tests (14 tests)
```
tests/integration/basic.test.js          14 tests  ✅
  - Health checks (3)
  - Autenticación (3)
  - Cupones (2)
  - Carrito (1)
  - Base de datos real (5)
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

### Smoke Legacy (23 checks)
```
tests/smoke.mjs                          23 checks ✅
  Autenticación: 3
  Catálogo: 2
  Reglas de compra: 4
  Checkout: 4
  Chats/Disputas: 5
  UI páginas críticas: 4
```

---

## 4. Frecuencia y Rotación

| Tipo | Frecuencia | Trigger | Tiempo Máx |
|------|------------|---------|------------|
| Unit (back+front) | Cada push/PR | GitHub Actions | 2 min |
| Integración Backend | Cada push/PR | GitHub Actions | 2 min |
| Build | Cada push/PR | GitHub Actions | 3 min |
| E2E Playwright | Cada push/PR + nightly | GitHub Actions | 2 min |
| Smoke Legacy | Manual + CI | Manual + CI | 1 min |
| Cobertura completa | Semanal (nightly) | Schedule cron | 10 min |

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