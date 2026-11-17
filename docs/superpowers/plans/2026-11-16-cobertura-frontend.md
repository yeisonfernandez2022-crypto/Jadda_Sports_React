# Cobertura Frontend (proyecto B) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Testear los 15 paneles de `frontend/src/admin` (5,491 líneas al 0% en Sonar) y los componentes/contextos sin cubrir, subir el trinquete FE de 28/24/25/30 en pasos, y llevar el overall de SonarCloud de 55.5% hacia ~65-70% con datos honestos.

**Architecture:** Suites RTL + MSW en archivos NUEVOS bajo `tests/frontend/admin/` (infra propia: handlers MSW de admin + helper de render con rol admin). Los paneles entran al denominador del trinquete local (`vitest.config.ts`) con re-base al valor medido (mismo patrón que el 2026-11-13) y luego trinquete en pasos con CI verde en cada uno. Nada de producción cambia.

**Tech Stack:** Vitest 4 + @testing-library/react + MSW (setup existente en `tests/frontend/setup.ts`) + jsdom. Convenciones del repo en `jadda-testing` y `jadda-frontend`.

**Spec:** Conversación del 2026-11-16 (diagnóstico Sonar): Sonar homepage = main, overall 55.5% tras el sync; el hueco restante es `frontend/src/admin` (0%) y `components` (20.7%). Decisión de diseño: **admin se TESTEA** (no se excluye de Sonar) porque concentra lógica de negocio real (filtros, formularios, CRUD) — a diferencia de `pages/**`/`vendedor/**`, excluidos con la justificación §3 del informe de estrategia (composición de componentes ya en alcance + E2E Playwright). Trinquete FE vigente documentado en `docs/calidad/matriz-rotacion.md` §8 y comentario del `frontend/vitest.config.ts` (patrón: re-base al valor medido → subir en pasos).

## Estado de partida (medido 2026-11-16)

| Dato | Valor |
|---|---|
| Denominador trinquete FE (vitest include) | `src/components` (3,936 líneas) + `src/context` (562) + `src/utils` (1,205) ≈ 5,703 |
| Thresholds vigentes | st 28 / br 24 / fn 25 / lines 30 (fijados al valor medido el 2026-11-13) |
| `src/admin` | 5,491 líneas, 15 paneles, **0% en Sonar, FUERA del include local** |
| Sonar denominador FE | components + context + utils + admin (admin NO excluido) |
| Tests FE | 19 archivos / 168 tests (5 components, 3 context, 11 utils) |
| Sonar overall (main) | 55.5% · branch 61.7% · line 52.1% |

## Global Constraints

- NUNCA editar suites existentes (`tests/frontend/**` existente intacto; los `.test.tsx` de admin/components son archivos NUEVOS).
- `tests/frontend/msw-handlers.ts` NO se toca: los handlers de admin viven en un archivo nuevo y se activan con `server.use(...)` por suite.
- No cambiar lógica de producción (`frontend/src/**` intacto). Si un test destapa un defecto → hallazgo en `docs/testing/hallazgos.md`, fix en decisión aparte.
- `frontend/vitest.config.ts` SOLO se toca para: añadir `src/admin/**` al `coverage.include` (Task 7) y subir `thresholds` en pasos (Task 7 y 10). El comentario del config documenta cada cambio de umbral (patrón vigente).
- Convenciones: `describe`/`test` en español, `globals: true`, timeouts 10 s, `npx tsc -b` sin errores tras cada lote, `corepack pnpm` desde la raíz, PowerShell sin `&&`, scripts de diagnóstico Node a `.cjs` en `C:\Users\Yeison\AppData\Local\Temp\opencode` (nunca `node -e` inline, nunca leer JSONs de cobertura directo).
- Los paneles usan SweetAlert: en flujos con SweetAlert mockear/responder el diálogo, sin temporizadores frágiles (regla de `jadda-testing`).
- main NO se toca hasta la Task 12 (sync con la misma autorización que PR #19; confirmar en ese punto).
- Umbrales FE de Sonar: sin cambios de config de Sonar en este plan (admin entra al denominador porque se testea).

## Review Focus

1. **SweetAlert en acciones destructivas** (crear/editar/eliminar en paneles): si el diálogo no se responde, la acción nunca ocurre y el test espera un estado que no llega. Esperado: cada suite que dispara acción con confirmación responde el Swal y aserta el efecto. Test: lo fija cada suite que use `fireEvent`/`userEvent` sobre botones con `Swal` (Task 3-6).
2. **Render sin rol admin**: los paneles piden `useAuth()` admin; si el helper no provee usuario admin con rol correcto, todos los paneles caen al guard de acceso. Esperado: `renderAdmin` (Task 2) provee `{rol:'admin'}` y una suite del lote A aserta que el panel NO muestra el mensaje de acceso denegado.
3. **Paths de error MSW (500/404)** por panel: esperado mensaje de error visible y estado de carga terminado (no spinner infinito). Test: 1 caso de error por panel en cada suite (Task 3-6).
4. **Polling/timbre** (ChatWidget u otros intervals activos dentro de paneles): dejan la red viva y colgan unmount; esperado `unmount()` explícito y no aserciones sobre `networkidle`. Test: patrón en cada suite que renderiza panel con polling (Task 4-6).
5. **Textos con tildes/ñ** en queries RTL (`getByText('Categorías')`): esperado usar los textos literales de la UI; si un query falla por acento, es señal del test, no de la UI. Test: lo fija cada suite (Task 3-6).

---

### Task 1: Rama + recon de cobertura FE

**Files:**
- Create: `C:\Users\Yeison\AppData\Local\Temp\opencode\diagnostico-fe.cjs` (fuera del repo)
- Create: `.superpowers/sdd/2026-11-16-cobertura-frontend/progress.md` (ledger, gitignored)

**Interfaces:**
- Produces: baseline por archivo (líneas sin cubrir por panel/componente) que Tasks 3-9 usan para priorizar; ledger del plan.

- [ ] **Step 1: Crear rama desde Develop**

```bash
git checkout -b testing/frontend-cobertura origin/Develop
```

- [ ] **Step 2: Correr la suite FE con cobertura (UNA corrida de recon)**

Run (desde `frontend/`): `corepack pnpm vitest run --coverage`
Expected: 19 archivos / 168 tests PASS; `frontend/coverage/` con `coverage-final.json`. Registrar st/br/fn/lines reales del resumen.

- [ ] **Step 3: Diagnóstico por archivo**

Escribir `diagnostico-fe.cjs` que lea `frontend/coverage/coverage-final.json` y liste, por archivo de `src/components`, `src/context`, `src/utils`: líneas totales, cubiertas, % — ordenado por líneas sin cubrir desc. Ejecutar y guardar el top-30 en el ledger. Este ranking decide el orden interno de Tasks 8-9.

- [ ] **Step 4: Registrar baseline en el ledger** (números de la tabla "Estado de partida" re-medidos + ranking) y commit de nada (todo gitignored/temp). 

### Task 2: Infra admin — handlers MSW + helper de render + suite de humo

**Files:**
- Create: `tests/frontend/admin/msw-handlers-admin.ts`
- Create: `tests/frontend/admin/helpers.tsx`
- Test: `tests/frontend/admin/AdminNavbar.test.tsx`, `tests/frontend/admin/AdminFooter.test.tsx`

**Interfaces:**
- Consumes: `server` de `tests/frontend/setup.ts` (ya registrado globalmente), `render` de RTL, patrón de provider del `tests/frontend/context/AuthContext.test.tsx` existente.
- Produces (lo que usan Tasks 3-9): `renderAdmin(ui)` — monta el árbol con AuthContext proveído por `{ usuario: { rol: 'admin', ... } }` mockeado (revisar cómo AuthContext expone el usuario; si el panel usa `useAuth`, mockear el hook o el provider siguiendo el patrón de la suite existente de AuthContext). `HANDLERS_ADMIN: RequestHandler[]` — handlers MSW por endpoint admin: usuarios (lista/rol), órdenes/ventas (lista/estado), devoluciones, categorías, retos, vendedores, reportes, configuración. Datos con prefijo `ADMIN-TEST` para trazabilidad. Cada suite activa con `server.use(...HANDLERS_ADMIN)` en `beforeEach`.

- [ ] **Step 1: Escribir `msw-handlers-admin.ts`** con handlers `http.get(...)`/`http.post(...)` (mismo estilo de `msw-handlers.ts`; mirar rutas reales de `backend/routes/*.js` para los paths exactos).
- [ ] **Step 2: Escribir `helpers.tsx`** con `renderAdmin` (patrón de la suite de AuthContext; sin duplicar utilidades que ya existan).
- [ ] **Step 3: Suite de humo `AdminNavbar.test.tsx`** — renderiza con `renderAdmin` + handlers; aserta: no hay mensaje de acceso denegado, se ve la marca/nav del panel, 1 path de error 500 muestra el mensaje de error y termina la carga.
- [ ] **Step 4: Suite de humo `AdminFooter.test.tsx`** — render estático mínimo.
- [ ] **Step 5: Correr** (desde `frontend/`): `corepack pnpm vitest run ../tests/frontend/admin`
Expected: 2 suites PASS (ajustar helpers hasta verde; los ajustes son de la SUITE NUEVA, nunca de producción).
- [ ] **Step 6: `npx tsc -b` sin errores y `corepack pnpm --prefix frontend lint` limpio.**
- [ ] **Step 7: Commit** `test: infra admin para tests FE (handlers MSW + renderAdmin) + humo de Navbar/Footer`

### Task 3: Lote admin A — paneles chicos

**Files:**
- Test: `tests/frontend/admin/AdminCategorias.test.tsx`, `AdminRetos.test.tsx`, `AdminProductoCaracteristicas.test.tsx`

**Interfaces:** Consumes `renderAdmin` + `HANDLERS_ADMIN` (Task 2). Produces: patrones confirmados de CRUD y SweetAlert que Tasks 4-6 replican.

Patrón de suite (idéntico para cada panel): render con `renderAdmin` → aserta carga inicial (encabezados/controles) → 1-3 interacciones de negocio → 1 path de error 500.

Casos por panel (aserción clave en negrita):
- **AdminCategorias** (10.6 KB): listar **filas de categorías visibles con handlers**; crear (responde Swal → **nueva fila en la lista**); eliminar con confirmación → **fila fuera**; error 500 → **mensaje visible**.
- **AdminRetos** (14.9 KB): listar retos **con estados visibles**; aprobar/rechazar un reto → **cambio de estado renderizado**; error 500 → **mensaje**.
- **AdminProductoCaracteristicas** (3.9 KB): render del form; guardar → **POST emitido (asertar handler llamado)**; validación vacía → **no hay POST**.

- [ ] **Step 1 (por panel): escribir la suite** con los casos de arriba (3 archivos).
- [ ] **Step 2: correr las 3 suites** → PASS (los datos faltantes se agregan a `msw-handlers-admin.ts`, que es de esta rama).
- [ ] **Step 3: `npx tsc -b` + lint.**
- [ ] **Step 4: Commit** `test: lote admin A (Categorias, Retos, ProductoCaracteristicas)`

### Task 4: Lote admin B — panel y maestros

**Files:**
- Test: `tests/frontend/admin/AdminDashboard.test.tsx`, `AdminConfiguracion.test.tsx`, `AdminUsuarios.test.tsx`, `AdminVendedores.test.tsx`

**Interfaces:** Consumes Task 2. Mismo patrón de suite que Task 3.

- **AdminDashboard** (16 KB): render de tarjetas/kpis **con datos de handlers**; navegación interna si la hay.
- **AdminConfiguracion** (21 KB): render del form con valores del handler; guardar → **PUT emitido y toast/mensaje**; error 500 → **mensaje**.
- **AdminUsuarios** (28 KB): listar **usuarios con rol visible**; cambiar rol (Swal) → **petición emitida y fila actualizada**; error 500 → **mensaje**.
- **AdminVendedores** (17.5 KB): listar vendedores; acción de aprobar/estado → **peticion emitida**; error 500 → **mensaje**.

- [ ] **Step 1: escribir las 4 suites.** - [ ] **Step 2: correr → PASS** (completar handlers de admin si falta un endpoint). - [ ] **Step 3: `npx tsc -b` + lint.** - [ ] **Step 4: Commit** `test: lote admin B (Dashboard, Configuracion, Usuarios, Vendedores)`

### Task 5: Lote admin C — operaciones

**Files:**
- Test: `tests/frontend/admin/AdminDevoluciones.test.tsx`, `AdminOrdenes.test.tsx`, `AdminReportes.test.tsx`

**Interfaces:** Consumes Task 2. Mismo patrón.

- **AdminDevoluciones** (24 KB): listar devoluciones **con estado visible**; acción de decidir (aprobar/rechazar con Swal) → **petición emitida y estado actualizado**; error 500 → **mensaje**.
- **AdminOrdenes** (28.9 KB): listar órdenes **con total/estado**; filtro por estado (si existe) → **lista filtrada**; cambiar estado → **petición emitida**; error 500 → **mensaje**.
- **AdminReportes** (27 KB): render de reportes con datos del handler; cambiar rango/tipo (si existe) → **nueva petición emitida**; error 500 → **mensaje**.

- [ ] **Step 1: escribir las 3 suites.** - [ ] **Step 2: correr → PASS.** - [ ] **Step 3: `npx tsc -b` + lint.** - [ ] **Step 4: Commit** `test: lote admin C (Devoluciones, Ordenes, Reportes)`

### Task 6: Lote admin D — productos (los grandes)

**Files:**
- Test: `tests/frontend/admin/AdminProductos.test.tsx`, `EditarProductoAdmin.test.tsx`, `SubirImagenes.test.tsx`

**Interfaces:** Consumes Task 2. `AdminProductos` (46 KB) y `EditarProductoAdmin` (34 KB) son los más complejos: si el panel exige datos iniciales grandes, el handler devuelve un catálogo `ADMIN-TEST` mínimo coherente con el render.

- **AdminProductos**: listar **productos con handlers**; buscar/filtrar → **lista re-renderizada**; eliminar con confirmación → **petición emitida y fila fuera**; error 500 → **mensaje**.
- **EditarProductoAdmin**: render del form con producto del handler; guardar → **PUT emitido con los campos editados**; validación requerida → **no hay petición y hay mensaje**.
- **SubirImagenes** (6.4 KB): render del uploader; selección de archivo (en jsdom, `File` + `fireEvent.change`) → **previsualización/estado actualizado**; error del servidor al subir → **mensaje**.

- [ ] **Step 1: escribir las 3 suites.** - [ ] **Step 2: correr → PASS.** - [ ] **Step 3: `npx tsc -b` + lint.** - [ ] **Step 4: Commit** `test: lote admin D (Productos, EditarProducto, SubirImagenes)`

### Task 7: Admin entra al denominador + re-base del trinquete (paso 1)

**Files:**
- Modify: `frontend/vitest.config.ts` (coverage.include y coverage.thresholds + comentario)

**Interfaces:** Consumes: todas las suites de Tasks 2-6 en verde. Produces: nuevo denominador (`components+context+utils+admin` ≈ 11,194 líneas) y thresholds re-basados al valor medido.

- [ ] **Step 1: Añadir `'src/admin/**'` al `coverage.include`** y correr la suite completa con cobertura (desde `frontend/`): `corepack pnpm vitest run --coverage`.
- [ ] **Step 2: Piso los thresholds al valor medido** (mismo patrón del 2026-11-13: bajar al número real y documentar en el comentario del config la fecha, la medición y el porqué). Con admin al ~50% esperado sobre 11k líneas: st/br/fn/lines caerán respecto a 28/24/25/30 — es el re-base pactado, NO un retroceso (el denominador creció 2x).
- [ ] **Step 3: Suite completa PASS + `npx tsc -b` + lint + Commit** `test: src/admin entra al denominador del trinquete FE (re-base al valor medido)`

### Task 8: Components — suites nuevas para los no cubiertos

**Files:**
- Test: `tests/frontend/components/<Componente>.test.tsx` (archivos NUEVOS; el ranking de Task 1 decide cuáles — los 8-12 componentes con más líneas sin cubrir)

**Interfaces:** Consumes: `renderAdmin` NO (son componentes públicos) — patrón de las suites existentes de components (`AuthModal.test.tsx`, `ProductCard.test.tsx`: MSW + RTL + screen). Suites en archivos NUEVOS.

Casos por componente (regla general): render con datos MSW → **contenido visible**; 1 interacción de negocio del componente → **petición/estado**; 1 path de error → **mensaje**. Los nombres exactos y el orden los fija el ranking del recon.

- [ ] **Step 1: escribir las suites del top del ranking** (lotes de 3-4 componentes, commit por lote).
- [ ] **Step 2: tras cada lote: correr suites nuevas + `npx tsc -b` + lint + Commit** `test: components <nombres>`

### Task 9: Context/utils top-up

**Files:**
- Test: `tests/frontend/context/<Contexto>.extra.test.tsx` o `tests/frontend/utils/<Util>.extra.test.ts` (SOLO archivos nuevos — si un contexto ya tiene suite, el extra va en archivo `.extra` nuevo, mismo patrón que backend)

Casos: del ranking de Task 1 — los caminos (branches) sin cubrir de AuthContext (75.2% → 90+), CartContext, ChatWidgetContext y utils (p. ej. `wompiWindow`, `oauthResultado`, `navigationGuard` según ranking).

- [ ] **Step 1: escribir los `.extra` del top del ranking.**
- [ ] **Step 2: correr → PASS + `npx tsc -b` + lint + Commit** `test: context/utils extras`

### Task 10: Trinquete FE en pasos (thresholds)

**Files:**
- Modify: `frontend/vitest.config.ts` (thresholds, comentario por paso)

**Interfaces:** Consumes: Tasks 7-9 en verde. Produces: thresholds subidos en pasos con el job `Frontend Unit Tests` verde en cada paso.

- [ ] **Step 1 (por paso): subir los 4 thresholds al valor medido actual redondeado hacia abajo** (p. ej. paso 1: medido st X → threshold floor(X)). Correr local: `corepack pnpm --prefix frontend test` PASS.
- [ ] **Step 2: Commit + push** → el PR en curso corre CI; con `Frontend Unit Tests` verde, siguiente paso. Cada paso: un commit `test: trinquete FE st/br/fn/lines → <n>`.
- [ ] **Step 3: Parar en el objetivo pactado: st ≥ 55 y br ≥ 45 sobre el denominador completo (si la medición da más, seguir hasta que el margen entre medido y umbral sea < 1 punto).**

### Task 11: Docs + PR a Develop

**Files:**
- Modify: `docs/testing/preparacion-sustentacion.md` (cifras FE: de 168 a las nuevas; nota del trinquete FE)
- Modify: `docs/calidad/bitacora-lecciones-aprendidas.md` (lecciones reales del trabajo FE: SweetAlert en tests, polling en jsdom, lo que surja)
- Modify: `docs/testing/hallazgos.md` (SOLO si algún test destapó defecto de producción)
- Modify: `.superpowers/sdd/2026-11-16-cobertura-frontend/progress.md` (ledger)

- [ ] **Step 1: actualizar docs con los números reales medidos (nada inventado).**
- [ ] **Step 2: Commit** `docs: cifras FE del trinquete y lecciones del lote admin` **y push.**
- [ ] **Step 3: Crear PR a Develop** (base `Develop`, head `testing/frontend-cobertura`) con resumen de cifras; esperar las 10 checks requeridas verdes; merge con `--admin` (misma regla de code-owner imposible con líder único — ruling ya documentado).

### Task 12: Sync a main (mismo patrón que PR #19)

**Files:** ninguno nuevo (PR `Develop` → `main`).

- [ ] **Step 1: CONFIRMAR con el usuario** (la autorización "pasarlos a main todo ya" fue para el estado de ese día; este es un push nuevo a main).
- [ ] **Step 2: PR base `main` head `Develop`, esperar checks verdes, merge `--admin`.**
- [ ] **Step 3: Verificar en SonarCloud (API o UI) el nuevo overall de main** y registrar en el ledger: esperado ~60-70% (admin testado + components arriba). 

---

## Notas de ejecución

- Correr suites SIEMPRE desde `frontend/` (los configs usan `../tests/...`); los bare imports resuelven por el junction `tests/frontend/node_modules` (ya existe en este equipo; en CI lo crea el workflow).
- Si un panel necesita datos que ningún handler tiene, se AGREGA el handler a `msw-handlers-admin.ts` (archivo de esta rama) — nunca a `msw-handlers.ts`.
- Si un test no puede pasar sin cambiar producción: detener, documentar como hallazgo (nombre del defecto + repro) y decidir con el usuario; NO se arregla en silencio.
- El objetivo de Sonar overall ≥80 NO está prometido en este plan: con admin testado y components arriba, la proyección honesta es ~60-70%; el resto depende de pages/vendedor (excluidos con E2E) y de cuánto suban los paneles reales. El trinquete FE es la garantía de que no retrocede.
