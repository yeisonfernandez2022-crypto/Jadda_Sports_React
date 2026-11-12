# Sprint 5 — Review: Integración Frontend-Backend

> Entregable de la **Semana 6** del bootcamp (`week-06-sprint_5_integracion_frontend_backend`,
> archivo `3-proyecto/starter/entregable-s06-sprint-5-review.md`), aplicado al proyecto
> **JADDA SPORTS** (Express 5 + MySQL/TiDB, React 19 SPA, app móvil Expo).
> Formato espejo de los entregables S02–S05.
>
> **Nota honesta de preexistencia**: la integración frontend-backend del sprint
> (consumo de la API real, estados de carga/error, CORS, variables de entorno,
> dockerización del frontend y `docker compose up` completo) estaba implementada
> desde antes del bootcamp — es la columna vertebral del producto. El trabajo del
> sprint fue **explicitarla con evidencia por criterio** (tabla §Checklist), verificar
> el Dockerfile multi-stage del frontend y el orden de arranque del compose, y
> ejecutar el `docker compose up` de punta a punta sobre un **clon limpio**
> (evidencia re-usable en el gate de la semana 9, entregable S09).

**Objetivo del sprint:** las pantallas principales del backlog consumen la API real del
backend (sin mocks), con manejo visible de carga y error; la URL de la API no está
hardcodeada; el frontend corre en un contenedor multi-stage y `docker compose up`
levanta los tres servicios juntos.

## Historias completadas

| # | Historia de Usuario | PR (enlace, mergeado a `develop`) |
|---|---|---|
| 1 | **HU-002 — Ver el catálogo de productos** (SPA consume `GET /api/productos` real con paginación y filtros client-side) | `https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/compare/Develop...documentacion-swagger-openapi` (apertura/merge = acción del propietario; los 5 sprints anteriores están mergeados: `origin/Develop` = `ff278c3`) |
| 2 | **HU-005 — Ver el detalle de un producto** (galería, variantes, reseñas, relacionados — todos endpoints reales) | mismo PR |
| 3 | **HU-009 — Gestionar el carrito** (CRUD `/api/carrito/*` con sesión) | mismo PR |

Evidencia por historia (código real):

- **HU-002/005/009**: el SPA NO tiene datos mock ni quemados — `Principal.tsx`,
  `Catalogo.tsx` y `ProductDetailPage.tsx` hacen `fetch` a rutas relativas `/api/...`
  servidas por el proxy (`vite.config.ts`: `server.proxy` y `preview.proxy` hacia
  `VITE_PROXY_TARGET`, default `http://backend:5000` dentro de la red compose). El
  catálogo alimenta también el mega-menú del navbar y la búsqueda client-side.
- **HU-009**: el carrito vive en MySQL (`CARRITO`) vía sesión — se conserva entre
  dispositivos; `CartContext` solo coordina UI.

## Historias no completadas

| Historia | Motivo |
|---|---|
| Ninguna de las HU de integración del sprint quedó incompleta | El frontend consume la API real en todas las pantallas desde la fase de construcción del producto (preexistente y verificada por la suite E2E). |
| Revisión del PR por compañero (limitación del equipo) | Equipo de 2 (propietario + asistente IA): no hay revisor humano externo. Control aplicado: CI en verde sobre la rama + suites automatizadas + revisión del propietario. |
| App móvil integrada a la API de producción | El móvil consume la MISMA API (EXPO_PUBLIC_API_URL) — se documenta en los RFs móvil, pero su lista de flujos pendientes es deuda documentada (S09 §Deuda). |

## Manejo de estados de carga y de error (criterio 3 del sprint)

- **Estado de carga**: `components/LoadingPage.tsx` es el fallback de `Suspense` de
  todas las rutas lazy y la pantalla completa del catálogo mientras carga el fetch.
- **Estado de error**: `ErrorBoundary` + `ErrorFallback` ("¡Oops!" + botón Reintentar)
  envuelven todas las rutas; `Catalogo.tsx` tiene estado de error propio con botón
  "Reintentar" si el fetch de productos falla.
- **Hardening anti-500** (2026-10-26, commit `b9d099b`): `utils/leerListaJson.ts` —
  los endpoints que DEBEN devolver array validan `r.ok && Array.isArray(body)` antes
  de entrar al estado, de modo que el body JSON de un error del backend NUNCA
  crashea el render (bug real destapado en prod: `l.filter is not a function`).
- **Prueba del criterio**: desapagar el backend deja el home vacío o con "Reintentar",
  nunca congelado — el E2E y los sondeos de prod de la época (ventanas de Aiven)
  lo demostraron en vivo.

## CORS y variables de entorno (criterios 4 y 5)

- **CORS**: `config/origenesAdmitidos.js` es la fuente única (base dev localhost:5173
  + env `CORS_ORIGINS` coma-separada para otros orígenes; en producción nginx sirve
  todo same-origin). `credentials: true` para las cookies de sesión. Además el backend
  valida **Origin en mutaciones** (`middlewares/proteccionOrigen.js`, 10 tests) —
  defensa CSRF complementaria.
- **URL de la API sin hardcodear**: el SPA usa rutas relativas `/api/...` (el proxy
  del compose/nginx decide el destino); `VITE_PROXY_TARGET` configurabilidad dev,
  `BACKEND_ORIGEN`+`DNS_RESOLVER` en la imagen de producción (Dockerfile.prod).
  En el móvil: `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_FRONT_URL` con `constants/api.ts`
  y `resolverImagen()`.

## Demo

1. Home y catálogo renderizando los **104 productos reales de la BD** (sin mocks).
2. Detalle de producto: galería, chips de variante con stock real, reseñas y
   relacionados de `GET /api/productos/:id/relacionados`.
3. Carrito en sesión: agregar variante → `POST /api/carrito/agregar` → visible en
   `/perfil/compras` tras comprar.
4. **Backend apagado momentáneamente** (`docker compose stop backend`): el home
   queda vacío con posibilidad de reintentar y la navegación muestra "¡Oops!" del
   ErrorBoundary — ningún estado congelado ni crash de JS.
5. `docker compose up` en un **clon limpio** (`git clone -b documentacion-swagger-openapi`
   + copiar `.env.example` a `.env` + rellenar credenciales): los 3 contenedores
   levantan juntos — mysql y backend quedan `healthy` y el frontend arranca solo
   cuando el backend está sano (`depends_on: service_healthy`). Evidencia completa
   en el entregable S09 §1 (corrida real del 2026-11-12: UI 200, API 200 vía proxy,
   BD sembrada desde cero).

## Estado Docker de esta semana

- [x] `frontend/Dockerfile.prod` **multi-stage real**: stage 1 `node:22-alpine`
  (pnpm 11.8.0 fijado + `pnpm install --frozen-lockfile` + `pnpm build`) → stage 2
  `nginx:alpine` que sirve el `dist` y proxea `/api` e `/images` con la plantilla
  `nginx.spa.conf.template` + snippet compartido `nginx.proxy-backend.conf`. El
  runtime ya NO es `vite preview` (antes: nodo en RAM sirviendo producción).
- [x] `docker-compose.yml` incluye los servicios `database`, `backend` y `frontend`.
- [x] `docker compose up` levanta los tres juntos sin pasos manuales en un clon
  limpio — **verificado de verdad** (ver S09 §1): el backend corre `pnpm install &&
  pnpm dev` solo, el volumen `mysql_data` nuevo lo siembra `setup.js` (tablas +
  seeds + demo) y el frontend espera al backend sano.
- **Evidencia** (comando corrido y resultado): `docker compose ps` en el clon limpio
  → `jadda_mysql: healthy · jadda_backend: healthy · jadda_frontend: Up`;
  `GET http://127.0.0.1:5173/api/productos` → **200, 68.273 bytes** (104 productos)
  a través del proxy del SPA; `GET http://127.0.0.1:5173/` → **200** (index del SPA).
  Corrida del 2026-11-12 sobre Docker Desktop 29.5.2 / Windows 11.

## % de avance acumulado del proyecto

**~52 %** de las semanas del plan (Semana 1 + Sprints 0–5 de 8 + semana de arranque).
Sprint 5 aporta **+10 pts**: los 7 criterios del entregable verificados con evidencia
(carga/error, CORS, env vars, multi-stage, compose completo en clon limpio). Nota
honesta: el código preexistía — el porcentaje acredita semanas cerradas con criterios
verificados, no líneas nuevas.

## Enlaces a PRs mergeados

- `feature/sprint0-coding-standards` … `feature/sprint4-reglas-negocio` → `Develop`
  (5 PRs mergeados el 2026-11-12; CI run #137 **verde 8/9 jobs** — el E2E Playwright
  en verde por primera vez desde el run #75 tras arreglar la causa raíz del seed demo
  y el proyecto msedge ausente en CI).
- Rama del trabajo documental/integración vigente: `documentacion-swagger-openapi`
  (OpenAPI/Swagger en `/api-docs`, inventario de licencias, `.env.example` raíz).

## Roles del Equipo (Sprint 5)

| Integrante | Rol |
|---|---|
| Yeison Fernández (@yeisonfernandez2022-crypto) | Scrum Master · Product Owner · Dev Backend · Dev Frontend · QA |
| Asistente IA (OpenCode) | Dev Backend · QA · documentación de evidencia |
