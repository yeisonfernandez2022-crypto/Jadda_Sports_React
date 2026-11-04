---
name: jadda-testing
description: "Use before or while testing JADDA SPORTS — running backend vitest (unit 152 tests / integration 22 with real MySQL on port 3307), frontend vitest + RTL + MSW (65 tests), Playwright E2E (tests/e2e/smoke.spec.ts, chromium+msedge) or tests/smoke.mjs, writing new tests in the project's conventions, or debugging flaky rate-limit/DB issues in test runs."
---

# Pruebas de JADDA SPORTS

Inventario y convenciones verificados leyendo los configs y suites reales. Para la
metodología TDD y la verificación antes de declarar listo, usa las skills genéricas
`superpowers:test-driven-development` y `superpowers:verification-before-completion`;
esta skill cubre el CÓMO del proyecto.

## Mapa de suites (todas activas)

| Suite | Comando | Qué es | Estado base |
|---|---|---|---|
| Backend unit | `pnpm --prefix backend test` (o `npx vitest run` desde backend) | vitest con mocks de BD (`tests/backend/setup.js`), 17 archivos **152 tests** (middlewares 30, authRoutes 8, utils 82, unitarios 34) en `tests/backend/{middlewares,routes,utils,unitarios}` | coverage umbral 30/30/30/30 (medido 48.91/47.67/55.68/48.88) |
| Backend integración | (desde backend) `corepack pnpm vitest run --config vitest.integration.config.mjs` | supertest contra app real + **MySQL de docker-compose.test.yml en host 3307** (BD `jadda_sports_test`), 4 archivos **22 tests** en `tests/backend/integration/` | corre en serie (`fileParallelism: false`), truncado por prueba (~225 s) |
| Frontend unit | `corepack pnpm vitest run` desde frontend | vitest + jsdom + @testing-library/react + **MSW**, 4 archivos **65 tests** (AuthModal 18, ProductCard 19, estadoCompra 14, reglasCupon 14) en `tests/frontend/{components,utils}` | coverage umbral 33/32/28/37 (medido 39.24/41.08/40/43.32) |
| E2E Playwright | (raíz) `npx playwright test --config tests/playwright.config.ts` | 21 `test()` × 2 proyectos (chromium + msedge), workers 1; `webServer: npm run preview` del frontend (reuseExistingServer local) | browser channel msedge usa Edge del sistema |
| E2E humo | (raíz) `npm run test:e2e` = `node tests/smoke.mjs` | ~25 checks de API + navegador; exige `ADMIN_EMAIL/ADMIN_PASS/VENDOR_EMAIL/VENDOR_PASS` (tests/.env) | reintenta 429 esperando 20 s |

## Cómo arranca cada entorno

- **Integración**: `tests/backend/integration/setup.js` hace `docker compose -f docker-compose.test.yml (raíz) down -v && up -d`, espera `mysqladmin ping`, llama `setupDatabase()` con config de test (puerto 3307) y monta una app Express propia con 21 routers y la BD de pruebas; beforeEach trunca ~30 tablas con FK off preservando catálogo (ROLES/CATEGORIAS/METODOS_PAGO/RETOS…).
- **Unit backend**: `tests/backend/setup.js` setea DB localhost/jadda_sports_test + mockea el pool; NO toca BD real.
- **Frontend**: `tests/frontend/setup.ts` levanta MSW con handlers (normal/error/empty/slow), mockea matchMedia/ResizeObserver/IntersectionObserver/storage; axios api se apunta con `VITE_API_URL`. Alias de import: `@ → ./src` (en vitest.config.ts).
- **CI** (`.github/workflows/ci.yml`, 9 jobs): lint+tsc → backend-tests → backend-integration-tests (servicio MySQL 3307) → frontend-tests → security-audit (informativo) → build → build-imagenes-prod → e2e-playwright (MySQL 3306, contraseña efímera del admin) → e2e-smoke (solo manual).

## TODOS los tests viven en la raíz `tests/` (desde 2026-11-03)

- `tests/backend/{setup.js, middlewares, routes, utils, unitarios, integration}` y `tests/frontend/{setup.ts, msw-handlers.ts, components, utils}` — NADA co-located en packages. `tests/` en la raíz mantiene además la E2E (`smoke.mjs`, `e2e/`, `playwright.config.ts`, `package.json` de Playwright).
- **Junctions de resolución**: los tests usan `require('express')`/`import 'react'` — el ascent de node_modules sube hasta la RAÍZ (node_modules muerta) y falla. Windows local: `cmd /c mklink /J tests\backend\node_modules ..\..\backend\node_modules` CON RUTAS ABSOLUTAS (mklink desde piped cmd resolve el target contra el CWD del proceso cmd, no el workdir del tool — target relativo produjo `C:\Users\Yeison\backend\...` vacío); igual para frontend. Gitignored (`tests/{backend,frontend}/node_modules/`). En CI añadir symlink equivalente si vuelve a fallar este lado.
- Los imports relativos de cada test se recalculan contra la UBICACIÓN NUEVA (`path.relative(newDir, resolve(oldDir, spec))`): desde `tests/backend/utils/` los módulos quedan a `../../../backend/utils/...`; los `vi.mock('../config/db')` y `require.resolve('./pagos')` TAMBIÉN estaban escondidos — 76 + 3 vi.mock + 2 require.resolve recalculados.
- Los configs de vitest SÍ viven en su paquete (`backend/vitest.config.mjs`, `backend/vitest.integration.config.mjs`, `frontend/vitest.config.ts`, `frontend/tsconfig.test.json`) con include `../tests/**` — el exclude DEBE nombrar el junction (`../tests/backend/node_modules/**`) o el glob `**` lo sesga (ps.stree.remy 152/152 + 1 suite fake → 17/17). El `include` de COVERAGE no debe listar `'../tests/**'` ni `**/*.{js,cjs,...}` — el denominador explotará (10.94% vs 30%); déjalo coleccionar transitive y solo excluye.
- `frontend` config necesita `server.fs.allow: ['.', '..']` — setupFiles fuera del root viste config daba "Cannot find module '/@fs/…/tests/frontend/setup.ts'".

## Convenciones para escribir pruebas aquí

- Backend unit: unitarios en `tests/backend/{middlewares,routes,utils,unitarios}/*.test.js`, `globals: true` (`describe/test` suelto), mocks por `vi.mock` con paths recalculados a la ubicación nueva (`vi.mock('../../../backend/config/db', ...)` desde `tests/backend/middlewares`); timeouts 10 s. No uses BD real en unit.
- Backend integración: agrega el archivo en `tests/backend/integration/` con sufijo `.test.js`; usa `supertest(app)` y la BD truncada; toda prueba que dependa de estado de venta arranca creando la venta por API de checkout (tests de checkout son los ejemplos).
- Frontend: `tests/frontend/{components,utils}/*.test.{tsx,ts}`; usa MSW handlers (`tests/frontend/setup.ts` ya registrado en el config) y verifica con `render(...)` de RTL más `screen.*`; en flujos con SweetAlert evita temporizadores manuales cutre frágiles.
- TypeScript frontend: `npx tsc -b` DEBE seguir pasando después de cualquier test nuevo (los tests se compilan con el build del proyecto).
- Backend: `node --check` en archivos backend aunque sean solo de test.

## Gotchas reales al correrlas

0. **Tests centralizados en la raíz `tests/`**: correr las suites DESDE EL PAQUETE (workdir backend o frontend) — los configs usan `../tests/...`. Los bare imports resuelven por el junction `tests/{backend,frontend}/node_modules` (ver sección anterior).

1. **Rate limit de login: 10/15 min por IP** acumulado entre corridas seguidas (limiter en memoria del proceso): `docker restart jadda_backend` antes de correr sondas/E2E locales repetidas.
2. En PowerShell, `%TEMP%` NO se expande — usa `$env:TEMP`; y curl desde PS añade un `NativeCommandError` cosmético — solo juzga por el output/exit code.
3. Salud: espera `GET /health` (backend) y `mysqladmin ping` antes de correr integración; los tests de integración levantan el contenedor solos.
4. Las pruebas que tocan stock/compras/cancelaciones: contabiliza movimientos (un checkout CONFIRMADO consume, una cancelación pre-despacho devuelve) al fijar la aritmética esperada.
5. JSON a curl/axios desde PowerShell: usa `--data-binary @archivo.json` (PS5.1 desarma las comillas de `-d "{\"a\":1}"`).
6. Los tests E2E usan `waitUntil: "domcontentloaded"` + `waitForSelector` — el polling del timbre de notificaciones mantiene la red viva y `networkidle` queda colgado.
7. `tests/smoke.mjs` necesita 4 credenciales (admin + vendedor); cópialas de tus cuentas reales a `tests/.env` (gitignored).

## Al agregar funcionalidad nueva (checklist de prueba)

- Función pura/backend lógica → unit centralizada en `tests/backend/...` primero (RED), implementar (GREEN).
- Endpoint nuevo → casos unit del controller cuando se puede mockear, + integración con datos reales si toca transacciones/stock.
- Pantalla → vitest RTL si hay lógica condicional, y un spec Playwright si es flujo crítico (checkout/pagos/rol).
- Declarar "listo" solo tras: unit backend + integration (si aplica) + frontend tests + `npx tsc -b` + build. Correr `superpowers:verification-before-completion` antes de reportar éxito.
