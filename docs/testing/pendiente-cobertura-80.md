# Cobertura ≥80% — Estado real y handoff (Semana 9)

> Proyecto: JADDA SPORTS · Corte: 2026-11-13 · Medición FUSIONADA (unitarias + integración, reportes como corren en CI)
>
> **Decisión del líder:** el 80% NO se cerró en esta ronda (alcance recortado a petición expresa en la semana 9); se deja documentado como handoff con los números REALES y un prompt listo para reanudar. El CI usa trinquete en 60 (`COBERTURA_UMBRAL=60`), no 80: subirlo a 70 dejaría el pipeline rojo con branches en 61.74.

## 1. Números reales (2026-11-13)

- **Fused combined backend** (unitarias + integración fusionadas): statements **70.39%** (3924/5575) · branches **61.74%** (2369/3837) · functions **79.20%** (415/524) · lines **93.67%** (11465/12240). El gate fusionado local pasó con umbral 35.
- **RAW por suite** (st/br/fn): unitarias 31.16/34.01/39.58 · integración 54.49/40.34/57.44 · frontend 28.17/24.61/25.89. Los thresholds de FE están en 28/24/25/30 (commit `f37c095`).
- Volumen: **354 unitarias** (36 archivos · 11.36 s) · **132 integración** (14 archivos · ~12.5 min) · **168 frontend** (19 archivos · 28.98 s) · 20 specs E2E × chromium.

## 2. Gap exacto para 80%

| Métrica | Actual | Cubiertos/Total | Para 80% | Faltan |
|---|---|---|---|---|
| statements | 70.39% | 3924/5575 | 4460 | **536** |
| branches | 61.74% | 2369/3837 | 3070 | **~701** |
| functions | 79.20% | 415/524 | 420 | **5** |
| lines | 93.67% | 11465/12240 | ya ≥80% | 0 |

## 3. Puntos débiles (reales, del reporte RAW)

- **Unitarias (0% o bajo):** 14 controllers sin suite propia — admin, carrito, compras, contacto, cupones, devolucion, direccion, favoritos, historial, imagen, metodoPago, pqr, proveedor, reto — y la mayoría de `routes`; `reporteDatos`/`reporteVendedorDatos`; `facturaPdf` 13.28% · `productoController` 22.35% · `seguridadController` 24% · `notificacionController` 25% · `vendedorController` 26.21% · `checkoutController` 27.09% · `chatController` 45.15% · `envioController` 45.45% · `authController` 47.88%.
- **Integración (0%):** `pagosController`, `proveedorController`, `proteccionOrigen`, `registroPeticiones`, `docsRoutes`, `pagosRoutes`, `proveedores`, `arranque`, `trustProxy`; `imagenController` 13.79% · `cuponesController` 30.23% · `planController` 33.33%.
- **Frontend (0%):** ~20 archivos, entre ellos Navbar (594 líneas), ChatWidget (363), retosAvances (504), Footer, FloatingCart, MiniCartMenu, MisRetoCard, TarjetaPlan/Retos, RecortadorFoto, BarraEnvioGratis, BellNotificaciones, favoritosUI, reportes, AuthModalContext; `AuthModal` 31.76% · `estadoCompra` 56.96%.

## 4. Puntos fuertes (los que sostienen el 70%)

- **100%:** `envioRoutes`, `arranque`, `carpetaUsuario`, `estadoPedido`, `formatoImagen`, `groserias`, `numeroPedido`, `trustProxy`, `validarCorreo`, `authMiddleware`, `esAdmin`, `esVendedor`.
- **Altos backend:** `reembolsosCancelacion` 93.22% · `verificacionSocial` 95.24% · `proteccionOrigen` 88.64% · `rateLimiter` 90.32% · `pagosController` 82.98% · `reglasCupones` 83.33% · `envio.js` 80% · `pagos.js` 79.13% · `authRoutes` 84.34%.
- **Altos frontend:** `buscador` 94.74% · `AuthContext` 94.55% · `wompiWindow` 92.59% · `ProductCard` 89.47% · `CartContext` 80.77% · `ChatWidgetContext` 75.56% · `FlechaScroll` 72% · `ErrorBoundary` 70%.
- **Integración altos:** `envio.js` 90% · `reporteDatos` 80% · `contactoController` 79.31% · `facturaPdf` 77.34% · `pqrController` 75% · `productoController` 68.36% · `comprasController` 70.29%.

## 5. Handoff — prompt listo para reanudar

Copiar íntegro en la próxima sesión:

```text
Continúa el cierre de cobertura de JADDA SPORTS (rama testing/cierre-bootcamp, corte 2026-11-13).
Objetivo: subir la cobertura FUSIONADA del backend (unit + integración) a >=80% statements/branches/functions
con tests dirigidos, SIN romper las 354 unitarias, las 132 de integración ni las 168 de frontend.
Estado: st 70.39 (3924/5575) · br 61.74 (2369/3837) · fn 79.20 (415/524) → faltan 536 statements / ~701 branches / 5 functions.

Plan de lotes (por retorno de inversión):
1. Tests unitarios de los 14 controllers a 0% (admin, carrito, compras, contacto, cupones, devolucion,
   direccion, favoritos, historial, imagen, metodoPago, pqr, proveedor, reto): contratos y ramas de error
   con mocks de config/db — patrón de tests/backend/unitarios/.
2. imagenController (13.79% unit / 13.79% int) y cuponesController (30.23/13.33): suites dirigidas.
3. Bottleneck de BRANCHES (~701): dirigir 2–4 h a authController (OTP/verificación), checkoutController
   (validaciones de cupón/método) y devolucionController (estados/motivos).
4. Pins pendientes (documentados en docs/testing/preparacion-sustentacion.md): envio.test.js CALDAS 10000 /
   HUILA 11000; buscador.test.ts padron('pesas') → 'pesa'; basic.test.js Antioquia 9000; smoke.spec.ts
   /health {ok:true, estado:'disponible'}; rateLimiter default max=10 (el survivor de mutantes).

Comandos:
- Unit: cd backend && corepack pnpm vitest run --coverage
- Integración: USE_CI_MYSQL='1' && corepack pnpm vitest run --config vitest.integration.config.mjs --coverage
  (MySQL 127.0.0.1:3307, jadda_sports_test; si la BD está caída: docker restart jadda_mysql_test)
- Fusión: node scripts/cobertura-combinada.mjs (fusiona los JSON y valida el umbral)

Reglas: cada lote corre antes de commit; los tests de integración NO dejan stock ambiguo (contabilizan
MOVIMIENTOS_STOCK); nada de tests dependientes del orden; mensajes de commit ASCII.
Al llegar: subir la variable de repo COBERTURA_UMBRAL gradualmente (60 → 70 → 80) verificando que el job
cobertura-backend quede VERDE en cada paso antes de subir otro punto.
```

## 6. Cómo se sube el trinquete (cuando llegue el momento)

1. **Local:** correr los lotes del prompt → fusionar con `scripts/cobertura-combinada.mjs` → verificar contra el umbral objetivo antes de tocar nada del CI.
2. **CI:** subir la variable de repo `COBERTURA_UMBRAL` (Settings → Actions → Variables) en pasos: 60 → 62 → 65 → 70 → 75 → 80. Cada paso exige el job `cobertura-backend` VERDE antes de subir otro punto — así el número publicado nunca puede retroceder.
3. **Frontend:** thresholds 28/24/25/30 (`f37c095`) suben con el mismo criterio; el 80% FE exige el grind de componentes (Navbar, ChatWidget y retosAvances son los 3 archivos mayores) — las pages quedan fuera por diseño (las cubre el E2E).
