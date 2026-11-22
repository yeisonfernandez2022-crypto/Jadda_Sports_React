# Estrategia de Pruebas - JADDA SPORTS

## 1. Visión General

Estrategia de pruebas de la plataforma JADDA SPORTS (comercio electrónico deportivo):

- **Backend**: API REST Node.js/Express + MySQL 8 / TiDB Cloud — dos suites: unitarias con mocks e integración con MySQL real.
- **Frontend Web**: React 19 + TypeScript + Vite — Vitest + RTL + MSW.
- **App Móvil**: React Native + Expo Router — verificada por `tsc --noEmit` (sin suite de pruebas propia).

La estrategia sigue la **pirámide de pruebas**: base ancha de unitarios rápidos, integración con BD real para los controladores, y E2E selectivos sobre los flujos críticos.

---

## 2. Pirámide de Pruebas (números reales, 2026-11-20)

```
                ┌─────────────────────────────┐
                │      E2E (Playwright)       │  ← Pocos, críticos, lentos
                │   20 specs × 2 proyectos    │
                │   = 40 ejecuciones local    │
                │   (CI: solo chromium = 20)  │
              ┌───────────────────────────────┐
              │     Integración Backend       │  ← Medios, MySQL real p.3307
              │  14 archivos / 132 tests      │
              │  (supertest + coverage)       │
            ┌───────────────────────────────────┐
            │      Componentes Frontend         │  ← Muchos, rápidos, aislados
            │   59 archivos / 581 tests         │
            │    (RTL + MSW)                    │
          ┌───────────────────────────────────────┐
          │           Unitarios Backend           │  ← Base: muchos, muy rápidos
          │        75 archivos / 1072 tests       │
          │        (Vitest, BD inyectada)         │
          └───────────────────────────────────────┘
```

Complemento: `tests/smoke.mjs` (25 checks, solo manual desde 2026-10-24).

---

## 3. Niveles de Prueba

### 3.1 Unitarios Backend (Vitest)
- **Ubicación**: `tests/backend/{middlewares,routes,utils,unitarios}/*.test.js` (setup central `tests/backend/setup.js`).
- **Herramientas**: Vitest + `vi.fn`/`vi.mock`.
- **Qué testear**: utilidades puras (`envio`, `numeroPedido`, `reglasCupones`, `agrupacionVentas`, `cloudinary`, `validarSubida`), crypto de Wompi (`pagos.js`), validaciones, middlewares (`rateLimiter`, `proteccionOrigen`, `registroPeticiones`, `esAdmin/esVendedor`), y **controladores con BD inyectada**.
- **Inyección de BD (`_useDb`)**: los controladores exponen un inyector para tests unitarios — en el tope del archivo:

```js
const dbReal = require('../config/db');
// (P7/P10) Inyección de BD para tests unitarios
let db = dbReal;
const _useDb = (reemplazo) => { db = reemplazo; };
```

El bloque se agrega al `module.exports` del controlador. Los tests unitarios inyectan un pool mockeado; los **caminos felices de BD viven en la suite de integración** (MySQL real), no se duplican con mocks.
- **Excepción válida en el código**: `planController.js` usa el estilo `exports._useDb = (reemplazo) => { db = reemplazo; };` — semánticamente equivalente.

### 3.2 Integración Backend (Vitest + Supertest + MySQL real)
- **Ubicación**: `tests/backend/integration/*.test.js`; config `backend/vitest.integration.config.mjs` (exclude del resto, coverage en `coverage-integration/`).
- **BD**: contenedor MySQL efímero de pruebas en puerto **3307** (`docker-compose.test.yml`); cada suite re-ejecuta `setup.js` (seed idempotente, demo omitido).
- **Qué testear**: los flujos críticos de punta a punta — auth (registro/login/OTP/roles), checkout con concurrencia (`FOR UPDATE`, 409), cupones (mínimos, RETO- personal), devoluciones/reembolsos, retos/evidencias, chat, vendedor, admin. Los caminos felices de controladores viven aquí.

### 3.3 Componentes Frontend (Vitest + RTL + MSW)
- **Ubicación**: `tests/frontend/{components,context,utils,admin}/*.test.{tsx,ts}` (setup `tests/frontend/setup.ts` + `msw-handlers.ts`).
- **Qué testear**: componentes (AuthModal, ProductCard, Navbar, ChatWidget, MiniCartMenu...), contextos (Auth, Cart, ChatWidget, AuthModal), utils (buscador, estadoCompra, reglasCupon, wompiWindow, validarCorreo...) y los 15 paneles de `src/admin/**`, con handlers MSW. La suite suma **581 tests en 59 archivos**.

### 3.4 E2E (Playwright)
- **Ubicación**: `tests/e2e/*.spec.ts`, `tests/playwright.config.ts`.
- **Flujos cubiertos (20 specs)**: catálogo/ordenamiento, producto+variantes+reseñas, carrito+cupón, checkout completo (credito y wompi), estados de pago (pendiente/declinada/expiración), Mis Compras (acciones por estado, cancelación con reembolso automático), devoluciones/reembolso UI, retos (límite 3, guía, avances), favoritos, admin (órdenes, productos, usuarios, vendedores, devoluciones, retos), chat (cliente/vendedor/admin con escalación).
- **Proyectos**: chromium + msedge en local (40 ejecuciones); **CI corre solo `--project=chromium`** (msedge no está instalado en `ubuntu-latest`; msedge sigue cubierto en local).

---

## 4. Cobertura y Umbral (gate combinado)

- **Cobertura backend se mide FUSIONADA**: `node scripts/cobertura-combinada.mjs [umbral]` une `coverage/coverage-final.json` (unitarias) + `coverage-integration/coverage-final.json` (integración) y verifica el total en statements/branches/functions/lines. Medir solo las unitarias dejaría a los controladores fuera del denominador (se ejercitan de verdad en integración). Salvedad: si un archivo llega con instrumentación divergente entre las dos corridas, el script conserva los MÁXIMOS por clave (unión de cobertura: se considera cubierto si lo cubrió cualquiera) y lo avisa por consola — esos "hits" no son conteos literales de ejecución.
- **Umbral por variable de repositorio**: `COBERTURA_UMBRAL` (GitHub Actions vars). Valor vigente: **80** — la fusión actual (93.99/84.13/98.49/99.85) lo supera. El workflow usa `vars.COBERTURA_UMBRAL || '60'` como fallback si la variable no existe. Plan "trinquete": mantener 80 y subir hacia el objetivo corporativo de 90 cuando el equipo lo acuerde.
- **Frontend**: cobertura real 51.01/45.57/47.30/54.94 % (statements/branches/funciones/líneas; medición 2026-11-16, 581 tests) con umbral 51/45/47/54 % en `frontend/vitest.config.ts`. El denominador incluye componentes, contextos, utils y `src/admin/**`; pages y panel vendedor se cubren por E2E.

---

## 5. CI (`.github/workflows/ci.yml`)

| Job (ID real en ci.yml) | Qué hace |
|-----|----------|
| `backend-tests` | Vitest unitarias + coverage → artifact `backend-coverage` |
| `backend-integration-tests` | MySQL efímero 3307 + vitest integración con coverage → artifact `backend-coverage-integration` |
| `cobertura-backend` | Descarga ambos artifacts, corre `cobertura-combinada.mjs` con `UMBRAL: ${{ vars.COBERTURA_UMBRAL || '60' }}` (variable vigente: **80**) |
| `evidencia-individual` | Resumen por archivo de las dos suites (evidencia de mutantes/riesgos) |
| `frontend-tests` | Vitest + RTL + MSW + `tsc -b` |
| `lint-and-typecheck` / `security-audit` | ESLint + TS, `pnpm audit --prod` |
| `build` / `build-imagenes-prod` | Build de verificación + build de imágenes prod |
| `e2e-playwright` | Playwright `--project=chromium` con MySQL efímero + backend + preview |
| `e2e-smoke` | Smoke legacy solo en workflow_dispatch (se salta en push/PR) |

Los checkouts usan SHA-40 del commit (regla del bootcamp).

---

## 6. Estabilidad y Buenas Prácticas

- **Rate limiter en memoria**: se reinicia al reiniciar el backend — entre corridas de sondas/test seguidos, `docker restart jadda_backend`.
- **Docker + Vite**: errores de parseo "stale" se resuelven con `docker restart jadda_frontend`.
- **Coverage exit 1**: una corrida con coverage sale con código 1 si el umbral falla aunque los tests pasen — leer las líneas "Test Files/Tests", no el exit code.
- **Junctions NTFS**: `tests/{backend,frontend}/node_modules` → junctions a los node_modules de cada capa (en clone nuevo: `mklink /J` con target absoluto).
- **Cronometraje (referencia 2026-11-13, 354 tests backend / 168 frontend)**: unitarias 11.36s · frontend 28.98s · integración ~12.5min (748s medido, con coverage) · E2E ~40s. **Medición 2026-11-22 con la suite vigente:** backend 1072 tests en 29.2 s · frontend 581 tests en 76.4 s. Medir de nuevo antes de usar estos valores en una sustentación.
- **Idempotencia**: `setup.js` es `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` — seguro en cada arranque de suite.

---

## 7. Cómo Correr las Pruebas

```bash
# Unitarias backend
corepack pnpm --prefix backend test

# Integración backend (requiere MySQL test en 3307)
corepack pnpm --prefix backend test:integration

# Cobertura combinada (tras ambas corridas con coverage)
node backend/scripts/cobertura-combinada.mjs 80

# Frontend
corepack pnpm --prefix frontend test
corepack pnpm --prefix frontend test:coverage
corepack pnpm --prefix frontend exec tsc -b

# E2E (desde tests/)
corepack pnpm --prefix tests exec playwright test
corepack pnpm --prefix tests exec playwright test --project=chromium

# Smoke manual
node tests/smoke.mjs
```
