# Estrategia de Pruebas - JADDA SPORTS

## 1. Visión General

Este documento describe la estrategia completa de pruebas para la plataforma JADDA SPORTS, una aplicación multiplataforma de comercio electrónico deportivo compuesta por:
- **Backend**: API REST Node.js/Express + MySQL 8
- **Frontend Web**: React 19 + TypeScript + Vite
- **App Móvil**: React Native + Expo Router

La estrategia sigue la **pirámide de pruebas** con énfasis en pruebas rápidas y confiables en la base, y pruebas de integración/E2E selectivas en la cúspide.

---

## 2. Pirámide de Pruebas

```
                    ┌──────────────────────────┐
                    │   E2E (Playwright)       │  ← Pocos, críticos, lentos
                    │   20 specs × 2 proyectos  │
                    │   = 40 ejecuciones        │
                   ┌─────────────────────┐
                   │  Integración Backend │  ← Medios, MySQL real
                   │  16 tests            │
                  ┌─────────────────────────┐
                  │  Componentes Frontend    │  ← Muchos, rápidos, aislados
                  │  51 tests (RTL + Vitest) │
                 ┌─────────────────────────────┐
                 │    Unitarios Backend         │  ← Base: muchos, muy rápidos
                 │    68 tests (Vitest)         │
                └───────────────────────────────┘
```

---

## 3. Niveles de Prueba

### 3.1 Tests Unitarios Backend (Vitest)
- **Ubicación**: `backend/tests/*.test.js`, `backend/utils/*.test.js`
- **Herramientas**: Vitest + vi.fn/vi.mock
- **Cobertura objetivo**: ≥30% statements/branches/functions/lines
- **Qué testear**:
  - Utilidades puras (`envio.js`, `numeroPedido.js`, `reglasCupones.js`, `agrupacionVentas.js`)
  - Crypto de la pasarela Wompi (`pagos.js`: firma de integridad, URL del widget firmada, checksum del webhook, `compararSegura`)
  - Validaciones y transformaciones de datos
  - Lógica de negocio aislada (sin BD)
  - Middlewares (`rateLimiter`, `authMiddleware`, `proteccionOrigen`, `registroPeticiones`)
- **Mocks**: Pool MySQL, Nodemailer, Passport, APIs externas
- **Ejecución**: `pnpm --prefix backend test`
- **Cobertura**: `pnpm --prefix backend test:coverage` (umbral 30%)

### 3.2 Tests de Integración Backend (Vitest + MySQL Real)
- **Ubicación**: `backend/tests/integration/*.test.js`
- **Herramientas**: Vitest + Supertest + MySQL efímero (docker-compose.test.yml)
- **Cobertura objetivo**: ~16% (complementa unitarios)
- **Qué testear**:
  - Endpoints REST completos (HTTP real)
  - Flujo de autenticación (registro, login, verificación)
  - CRUD de entidades principales (productos, carrito, checkout)
  - Transacciones y rollback
  - Rate limiting (desactivado en test)
- **Infraestructura**: MySQL 8 en Docker (puerto 3307), `docker-compose.test.yml`
- **Ejecución**: `pnpm --prefix backend vitest run --config vitest.integration.config.mjs`

### 3.3 Tests Unitarios Frontend (Vitest + React Testing Library)
- **Ubicación**: `frontend/src/**/*.test.tsx`
- **Herramientas**: Vitest + RTL + jsdom + MSW (nota 2026-10-22: `@testing-library/user-event` fue removida por caso sin uso; las interacciones se cubren con fireEvent/RTL y las E2E)
- **Cobertura objetivo**: ≥34% statements, ≥33% functions, ≥38% lines
- **Qué testear**:
  - Componentes con lógica (`AuthModal`, `ProductCard`, `SelectorVarianteModal`)
  - Hooks personalizados (`useAuth`, `useCart`, `useChatWidget`)
  - Utilidades (`reglasCupon`, `estadoCompra`, `numeroPedido`)
  - Validaciones de formularios
  - Interacciones de usuario (click, input, submit)
- **Mocks**: MSW para API, `vi.mock` para hooks/contextos
- **Ejecución**: `pnpm --prefix frontend test`
- **Cobertura**: `pnpm --prefix frontend test:coverage` (umbral 33/32/28/37%)

### 3.4 Tests E2E (Playwright Oficial)
- **Ubicación**: `tests/e2e/*.spec.ts`
- **Herramientas**: @playwright/test + Chromium + MS Edge
- **Tests**: 40 (20 Chromium + 20 MS Edge)
- **Qué testear**:
  - Flujos críticos completos: auth, catálogo, checkout, chat, admin
  - UI crítica: home, admin panel, vendor panel, chat widget
  - Responsive (1440px + 375px móvil)
  - Multi-navegador (Chromium + MS Edge)
- **Infraestructura**: MySQL 8 + Backend + Frontend preview en CI
- **Reporter**: HTML + JSON + traces + screenshots + videos
- **Ejecución**: `pnpm --prefix tests exec playwright test`
- **Reporte**: `tests/playwright-report/index.html`

### 3.5 Smoke Tests Legado (playwright-core)
- **Ubicación**: `tests/smoke.mjs`
- **Herramientas**: playwright-core + fetch API nativo
- **Tests**: 23 checks API + UI
- **Uso**: Validación rápida local, compatibilidad con runner custom
- **Ejecución**: `pnpm test:e2e` (requiere contenedores levantados)

---

## 4. Mocks y Test Doubles

### 4.1 Backend (vi.fn / vi.mock)
```javascript
// Pool MySQL mock en setup.js
vi.mock('../config/db', () => ({
  promisePool: {
    query: vi.fn(),
    end: vi.fn(),
  }
}));

// Nodemailer mock
vi.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test' })
  })
}));

// Rate limiter desactivado en test
vi.mock('../middlewares/rateLimiter', () => ({
  rateLimit: () => (req, res, next) => next()
}));
```

### 4.2 Frontend (MSW)
```typescript
// msw-handlers.ts - Handlers centralizados
export const handlers = [
  http.get('/api/productos', () => HttpResponse.json([...])),
  http.post('/api/auth/login', async ({ request }) => {...}),
  // ... handlers para todos los endpoints
];

// En setup.ts
export const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 4.3 Móvil
- Tests unitarios con Jest/Expo testing library (pendiente)
- MSW para interceptar API (configurado en `movil/constants/api.ts`)

---

## 5. Base de Datos para Tests

| Entorno | Base de Datos | Puerto | Propósito |
|---------|--------------|--------|-----------|
| Desarrollo | MySQL 8 (Docker) | 3306 | App principal |
| Test Unitarios | Mock (sin BD) | N/A | Unit tests rápidos |
| Test Integración | MySQL 8 (Docker) | 3307 | Tests reales con BD |
| CI E2E | MySQL 8 (GitHub Actions) | 3306 | Tests completos |
| CI Integración | MySQL 8 (GitHub Actions) | 3307 | Tests integración |

**Inicialización**: `backend/database/setup.js` crea tablas + seeds automáticamente al arrancar.
**Limpieza**: `TRUNCATE` selectivo en `beforeEach` (preserva tablas de referencia: ROLES, CATEGORIAS, PROVEEDORES, etc.)

---

## 6. CI/CD Pipeline (GitHub Actions)

### Jobs y Dependencias
```
lint-and-typecheck ──────┐
                         │
backend-tests ───────────┤
                         ├──► build ──► e2e-playwright ──► e2e-smoke (legacy)
backend-integration-tests ┤
                         │
frontend-tests ──────────┘
```

> **Nota 2026-10-24:** `e2e-smoke (legacy)` pasó a **solo manual** (`workflow_dispatch`, botón "Run workflow" en Actions) para ahorrar minutos de la cuenta gratuita de GitHub Actions; duplicaba la cobertura del job oficial `e2e-playwright`. También se agregó `concurrency` con `cancel-in-progress` (los pushes en serie sobre la misma rama cancelan la corrida obsoleta).

### Gates de Calidad
- ✅ Lint (0 errores, warnings permitidos)
- ✅ TypeScript strict (`tsc -b`)
- ✅ Unit tests (backend 68, frontend 51)
- ✅ Coverage thresholds (backend ≥30%, frontend ≥33/32/28/37%)
- ✅ Integration tests (MySQL real)
- ✅ Build exitoso (`pnpm build`)
- ✅ E2E Playwright (20 specs × 2 proyectos = 40 ejecuciones)
- ✅ E2E Smoke legacy (23 checks)

### Artefactos
- Cobertura backend/frontend (7 días)
- Playwright HTML report + traces + videos (7 días)

---

## 7. Ejecución Local

### Prerrequisitos
```bash
# Levantar infraestructura
docker compose up -d

# Verificar servicios
curl http://localhost:5000/api/productos  # API
curl http://localhost:5173              # Web
```

### Comandos de Prueba
```bash
# Tests unitarios backend
pnpm --prefix backend test
pnpm --prefix backend test:coverage

# Tests integración backend (requiere docker-compose.test.yml up)
docker compose -f docker-compose.test.yml up -d
pnpm --prefix backend vitest run --config vitest.integration.config.mjs

# Tests frontend
pnpm --prefix frontend test
pnpm --prefix frontend test:coverage

# Tests E2E Playwright (requiere backend + frontend corriendo)
pnpm --prefix tests exec playwright test

# Smoke legacy (requiere contenedores arriba)
pnpm test:e2e

# Suite completa (simula CI)
pnpm test && pnpm test:coverage && pnpm build && pnpm test:e2e
```

---

## 8. Criterios de Calidad

| Métricas | Objetivo | Estado Actual |
|----------|----------|---------------|
| Backend Unit Coverage | ≥30% | 100% (archivos testeados) |
| Frontend Coverage | ≥33/32/28/37% | 34/37/33/38% |
| Integration Coverage | Complementaria | ~16% |
| E2E Playwright | 20 specs × 2 proyectos = 40 ejecuciones | 40/40 passing |
| Smoke Tests | 23 checks | 23/23 passing |
| Lint Errors | 0 | ✅ 0 |
| TypeScript Errors | 0 | ✅ 0 |
| Build Success | ✅ | ✅ |

---

## 9. Mantenimiento

- **Añadir tests** junto a cada nueva feature (TDD cuando sea posible)
- **Actualizar mocks** MSW cuando cambie la API
- **Revisar coverage** mensualmente, bajar umbrales solo con justificación
- **Rotar tests E2E** para cubrir nuevas áreas críticas
- **Limpiar tests frágiles** o mover a integración si dependen de timing

---

## 10. Referencias

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Docs](https://mswjs.io/)
- [Playwright Docs](https://playwright.dev/)
- [Supertest](https://github.com/ladjs/supertest)
- [MySQL Docker](https://hub.docker.com/_/mysql)