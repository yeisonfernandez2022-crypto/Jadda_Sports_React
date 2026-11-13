# Estrategia de Pruebas - JADDA SPORTS

## 1. Visión General

Estrategia de pruebas de la plataforma JADDA SPORTS (comercio electrónico deportivo):

- **Backend**: API REST Node.js/Express + MySQL 8 — dos suites: unitarias con mocks e integración con MySQL real.
- **Frontend Web**: React 19 + TypeScript + Vite — Vitest + RTL + MSW.
- **App Móvil**: React Native + Expo Router — verificada por `tsc --noEmit` (sin suite de pruebas propia).

La estrategia sigue la **pirámide de pruebas**: base ancha de unitarios rápidos, integración con BD real para los controladores, y E2E selectivos sobre los flujos críticos.

---

## 2. Pirámide de Pruebas (números reales, 2026-11-13)

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
            │   19 archivos / 168 tests         │
            │    (RTL + MSW)                    │
          ┌───────────────────────────────────────┐
          │           Unitarios Backend           │  ← Base: muchos, muy rápidos
          │        36 archivos / 354 tests        │
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
- **Ubicación**: `tests/frontend/{components,utils}/*.test.{tsx,ts}` (setup `tests/frontend/setup.ts` + `msw-handlers.ts`).
- **Qué testear**: AuthModal (30), ProductCard (20), utilidades compartidas (`estadoCompra`, `reglasCupon`) con handlers MSW.

### 3.4 E2E (Playwright)
- **Ubicación**: `tests/e2e/*.spec.ts`, `tests/playwright.config.ts`.
- **Flujos cubiertos (20 specs)**: catálogo/ordenamiento, producto+variantes+reseñas, carrito+cupón, checkout completo (credito y wompi), estados de pago (pendiente/declinada/expiración), Mis Compras (acciones por estado, cancelación con reembolso automático), devoluciones/reembolso UI, retos (límite 3, guía, avances), favoritos, admin (órdenes, productos, usuarios, vendedores, devoluciones, retos), chat (cliente/vendedor/admin con escalación).
- **Proyectos**: chromium + msedge en local (40 ejecuciones); **CI corre solo `--project=chromium`** (msedge no está instalado en `ubuntu-latest`; msedge sigue cubierto en local).

---

## 4. Cobertura y Umbral (gate combinado)

- **Cobertura backend se mide FUSIONADA**: `node scripts/cobertura-combinada.mjs [umbral]` une `coverage/coverage-final.json` (unitarias) + `coverage-integration/coverage-final.json` (integración) y verifica el total en statements/branches/functions/lines. Medir solo las unitarias dejaría a los controladores fuera del denominador (se ejercitan de verdad en integración).
- **Umbral por variable de repositorio**: `COBERTURA_UMBRAL` (GitHub Actions vars, fallback 60). Plan "trinquete": subir el valor hasta llegar a **80** (requisito del bootcamp). Valores usados: inicial = base combinada redondeada hacia abajo; meta final = 80.
- **Baseline unitarias (2026-11-13)**: stmts 31.15% · branches 34.01% · funcs 39.57% · lines 30.93%. La integración eleva el combinado (tabla real en `docs/testing/hallazgos.md`).
- **Cuello de botella**: branches. Tests dirigidos a branches (adminController, facturaPdf, reporte*) son la vía más rápida al 80%.
- **Frontend**: cobertura real 28.16/24.61/25.88/30.37% (stmts/branches/funcs/lines, 2026-11-13) con umbral exigido 28/24/25/30% en `frontend/vitest.config.ts` (re-basado a pisos reales; suite creció 4→19 archivos).

---

## 5. CI (`.github/workflows/ci.yml`)

| Job | Qué hace |
|-----|----------|
| `backend-unit` | Vitest unitarias + coverage → artifact `backend-coverage` |
| `backend-integration` | MySQL efímero 3307 + vitest integración con coverage → artifact `backend-coverage-integration` |
| `cobertura-backend` | Descarga ambos artifacts, corre `cobertura-combinada.mjs` con `UMBRAL: ${{ vars.COBERTURA_UMBRAL || '60' }}` |
| `evidencia-individual` | Resumen por archivo de las dos suites (evidencia de mutantes/riesgos) |
| `frontend-unit` | Vitest + RTL + MSW + `tsc -b` |
| `lint` / `audit` / `build` | ESLint, `pnpm audit --prod`, build de imágenes prod |
| `e2e-playwright` | Playwright `--project=chromium` con MySQL efímero + backend + preview |

Los checkouts usan SHA-40 del commit (regla del bootcamp).

---

## 6. Estabilidad y Buenas Prácticas

- **Rate limiter en memoria**: se reinicia al reiniciar el backend — entre corridas de sondas/test seguidos, `docker restart jadda_backend`.
- **Docker + Vite**: errores de parseo "stale" se resuelven con `docker restart jadda_frontend`.
- **Coverage exit 1**: una corrida con coverage sale con código 1 si el umbral falla aunque los tests pasen — leer las líneas "Test Files/Tests", no el exit code.
- **Junctions NTFS**: `tests/{backend,frontend}/node_modules` → junctions a los node_modules de cada capa (en clone nuevo: `mklink /J` con target absoluto).
- **Cronometraje**: unitarias ~8s · frontend ~23s (22.77s medido) · integración ~11.5min (690s medido, con coverage) · E2E ~40s.
- **Idempotencia**: `setup.js` es `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` — seguro en cada arranque de suite.

---

## 7. Cómo Correr las Pruebas

```bash
# Unitarias backend (desde backend/)
corepack pnpm exec vitest run --config vitest.config.mjs

# Integración backend (requiere MySQL test en 3307: docker restart jadda_mysql_test)
corepack pnpm run test:integration

# Cobertura combinada (tras ambas corridas con coverage)
node scripts/cobertura-combinada.mjs 60

# Frontend (desde frontend/)
npx vitest run --config vitest.config.ts
npx tsc -b

# E2E (desde tests/)
npx playwright test                     # chromium + msedge (local)
npx playwright test --project=chromium  # como el CI

# Smoke manual
node tests/smoke.mjs
```
