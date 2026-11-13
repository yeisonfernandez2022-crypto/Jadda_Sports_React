# Preparación de Sustentación — Bootcamp de Testing ADSO (Semana 9)

> Proyecto: JADDA SPORTS · Sustentador: Yeison Fernández (líder único) · Corte: 2026-11-13
>
> Guion de las 3 pruebas del reto final — **explicar · romper · escribir** — por cada capa de la pirámide, con tests REALES de este proyecto (nada de ejemplos de plantilla). Cifras de la suite al día del corte: **354 unitarias** (36 archivos · 11.36 s) · **132 integración** (14 archivos · ~12.5 min · MySQL real) · **168 frontend** (19 archivos · 28.98 s) · **20 specs Playwright × chromium** en CI (40 con msedge local). Cobertura FUSIONADA del backend: st 70.39 · br 61.74 · fn 79.20 · lines 93.67.

---

## Capa 1 — Unitarias backend (354 tests, mocks, 11.36 s)

### EXPLICAR

`tests/backend/utils/envio.test.js` — prueba `backend/utils/envio.js` como función pura: envío gratis desde $800.000, tarifa por ciudad (Bogotá 8000, Medellín 9000, Cali 9000, Barranquilla 10000, Cartagena 11000, Córdoba 12000 con tilde), por departamento (antioquia 9000, cundinamarca 10000), default (vichada/guainía 15000) e insensible a mayúsculas/tildes. Es unitaria pura: sin BD, sin HTTP, milisegundos.

### ROMPER (demo en vivo — mutante elegido)

Edita `backend/utils/envio.js`: `TARIFA_DEFAULT = 15000` → `15001` (un carácter). Corre:

```
cd backend && corepack pnpm vitest run tests/backend/utils/envio.test.js
```

Falla la aserción de default (vichada/guainía 15000). Restaura con `git checkout -- backend/utils/envio.js`. Moraleja para explicar: el test no sabe el negocio, sabe el **contrato** — y el contrato es que las ciudades no listadas cuestan 15000.

### ESCRIBIR (pin en vivo)

Las tarifas de CALDAS (10000) y HUILA (11000) existen en `envio.js` y **no tienen aserción** en `envio.test.js`. Escribir (patrón exacto de las demás aserciones del archivo):

```js
it('Caldas tarifa departamental 10000', () => {
  expect(calcularEnvio('caldas', 100000)).toBe(10000);
});
it('Huila tarifa departamental 11000', () => {
  expect(calcularEnvio('huila', 100000)).toBe(11000);
});
```

Corre → suite pasa de 354 a 356 verdes. Punto de la demo: los datos del código que ningún test fija son mutantes-escapados potenciales (véase el hallazgo 23 de `hallazgos.md`).

---

## Capa 2 — Integración (132 tests, MySQL real, ~12.5 min)

### EXPLICAR

`tests/backend/integration/checkout-concurrencia.test.js` — valida el `SELECT ... FOR UPDATE` + guard `AND STOCK >= ?` del checkout: dos carritos compran la última unidad y el segundo recibe **409**, con stock real en MySQL (no mocks). Las 14 suites se corren con `USE_CI_MYSQL='1'` contra la BD `jadda_sports_test` (127.0.0.1:3307); cada suite re-siembra su estado (seed «116 ok», demo omitida). Esto es lo que ningún mock puede probar: bloqueo de filas, FKs y aislamiento.

### ROMPER (demo en vivo — mutante de integración)

Edita `backend/controllers/checkoutController.js`: el guard del stock `STOCK >= ?` → `STOCK >= 0`. Corre la suite de checkout-concurrencia → falla (el guard ya no rechaza el segundo checkout). Restaura con `git checkout -- backend/controllers/checkoutController.js`. Moraleja: aquí el mutante demuestra que el test valida la regla de CONCURRENCIA, no solo que la venta se crea.

### ESCRIBIR (pin en vivo)

`tests/backend/integration/basic.test.js` pide `/api/envio/calcular` y solo verifica `typeof costo === 'number'` para Bogotá — escribir la aserción EXACTA para Antioquia (patrón de las peticiones del propio archivo, líneas 29–36):

```js
it('envio: Antioquia 9000 exacto', async () => {
  const res = await request(app).get('/api/envio/calcular').query({ departamento: 'Antioquia', subtotal: 100000 });
  expect(res.status).toBe(200);
  expect(res.body.costo).toBe(9000);
});
```

Moraleja: la integración prueba el CONTRATO por HTTP (status + body), no la función.

---

## Capa 3 — Frontend (168 tests, RTL + MSW, 28.98 s)

### EXPLICAR

`tests/frontend/utils/buscador.test.ts` — la lógica de búsqueda del navbar/catálogo: `padron` de plurales ('balones'→'balon', 'guayos'→'guayo'), `filtrarProductos('balones')` devuelve el Balón Al Rihla y la Malla porta balones y **excluye** el Aro de Baloncesto y los tenis Lebron (frontera de palabra, no substring), 'banda' matchea dentro de 'minibanda' (sufijo compuesto), 'guay' matchea por prefijo de escritura parcial, y MARCA null no explota.

### ROMPER (demo en vivo — mutante FE)

Edita `frontend/src/utils/buscador.ts` (función `padron`): quita la regla del sufijo `-es` → 'balones' ya no reduce a 'balon' → el test de 'balones' falla. Restaura con `git checkout -- frontend/src/utils/buscador.ts`. Moraleja: un mutante de UNA regla de normalización rompe la búsqueda real del usuario — la FE se prueba con la misma seriedad que el backend.

### ESCRIBIR (pin en vivo)

`padron('pesas')` → `'pesa'` existe en el código y no tiene aserción. Escribir:

```ts
it('padron plural ligero -s', () => {
  expect(padron('pesas')).toBe('pesa');
});
```

Moraleja: igual que en backend, el código sin aserción es código a merced del siguiente refactor.

---

## Capa 4 — E2E (20 specs × chromium en CI, Playwright)

### EXPLICAR

`tests/e2e/smoke.spec.ts` — el recorrido crítico completo contra el stack REAL: login admin y vendedor con `loginRobusto` (×3 reintentos cada 20 s, porque el rate limit 10/15min es REAL), cred-gate que aborta el run si faltan envs, catálogo devuelve array > 0, el vendedor no puede comprar (403), cupón JADDA10 exacto (el parcial 'JADDA' responde 404), checkout por debajo del mínimo del cupón → 400 con '200.000' en el mensaje, cancelación con limpieza, contador de chats por rol.

### ROMPER (demo en vivo — mutante cross-layer)

Edita `backend/utils/reglasCupones.js` (`TABLA_MINIMOS`): umbral del 10% `200000` → `150000`. Corre el spec de checkout → la aserción que espera el mensaje con '200.000' falla. Restaura con `git checkout -- backend/utils/reglasCupones.js`. Moraleja: un E2E puede cazar un cambio en una util del backend que ningún unit fija con ese valor — la pirámide completa se defiende sola.

### ESCRIBIR (pin en vivo)

`/health` no tiene aserción en `smoke.spec.ts`. Escribir el pin con `fetch` plano (no necesita cookie; helpers disponibles: `createClient()`, `loginRobusto()`, `primeraVarianteDe()`):

```ts
test('health responde disponible', async () => {
  const r = await fetch(BASE_API + '/health');
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true, estado: 'disponible' });
});
```

Moraleja: el liveness es el primer endpoint que toca un PaaS — merece aserción exacta.

---

## Estabilidad E2E (auditoría de la semana 7 — 2026-11-13)

- **Cero esperas de tiempo**: el único `waitForTimeout(1500)` del suite (test «Home carga sin errores JS») fue reemplazado por una espera de ESTADO — `await page.waitForSelector('footer', { state: 'visible' })`: el pie solo es visible cuando todo el layout del SPA montó (mismo objetivo, sin cronómetro).
- **Locators accesibles**: los 4 tests de UI escuchan `pageerror` y esperan selectores visibles de la interfaz (footer, paneles admin/vendedor, widget de chat), no textos frágiles ni rutas CSS internas.
- **Subset crítico ×5 estable**: 7 tests críticos (3 de autenticación, catálogo, cupón JADDA10 exacto, checkout bajo/sobre el mínimo) corridos con `--repeat-each=5 --project=chromium` → **35/35 passed (20.3 s)**, 0 reintentos, 0 fallos. La idempotencia por repeat está garantizada por diseño del suite: `beforeAll` corre UNA vez por worker (un producto y un cupón `SMOKE-MIN-*` únicos por corrida, y ese código NO es de un solo uso — solo los `RETO-` se marcan `USADO=1`), y cada repeat deja la BD como la encontró (el log del backend muestra por corrida: crear venta → cancelar → borrar registro admin → borrar producto de prueba).
- **Reporte HTML/trazas ya en CI ✓** (verificado en `ci.yml`): artifacts `playwright-report` (`tests/playwright-report/`) y `playwright-traces`; además `playwright.config.ts` fija `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` en CI y `retries: 2` SOLO en CI — la corrida de estabilidad de arriba se hizo con 0 retries.
- **Quirk del entorno**: tras la actualización de `@playwright/test` (browser rev 1248) los 4 tests de UI fallaban con `Executable doesn't exist` — `npx playwright install chromium` lo resolvió (los tests de API no lanzan navegador, por eso el subset ×5 pasó antes de la instalación).

---

## Preguntas típicas de sustentación (con respuesta)

1. **¿Cómo mides la cobertura y por qué confías en ese número?** — Fusionada en CI sobre TODA la suite que corre ahí (unitarias con mocks + integración con MySQL real; el job `cobertura-backend` fusiona los reportes JSON). El número del informe es el del CI, no el de un denominador maquillado: 70.39/61.74/79.20/93.67 (2026-11-13). El umbral vive en la variable de repo `COBERTURA_UMBRAL` (hoy 60) — un trinquete, no un tope fijo.
2. **¿Qué excluyes y por qué?** — Adaptadores HTTP/SMTP (cloudinary, correo), generadores de documentos (PDF/Excel de reportes), wiring declarativo sin aporte y arranque/config; en frontend, las páginas (las cubre el E2E). Justificado en `docs/estrategia-pruebas.md`.
3. **¿Por qué 5 mutantes y no 50?** — Uno por capa para demostrar el método; el quinto fue el que ESCAPÓ (rateLimiter default `max=10` sin aserción) y ese hallazgo vale más que aprobar 5: destapó una aserción faltante real.
4. **¿Cómo evitas tests de stock ambiguos?** — Los tests de integración contabilizan `MOVIMIENTOS_STOCK` (ENTRADA/SALIDA), no solo el stock final: si la cuenta no cuadra, el test lo señala aunque el número final coincida.
5. **¿Los E2E son estables?** — Sin `waitForTimeout` en los specs (locators accesibles y esperas de estado); subset crítico corrido con `--repeat-each=5` local OK; `retries` solo como red de seguridad del CI, no como forma de vida.
6. **¿Por qué solo chromium en CI?** — El canal msedge no existe en `ubuntu-latest`; local corren ambos navegadores (20/20 × 2 = 40).
7. **¿Qué pasa si un test falla en CI?** — El job se pone rojo y bloquea el merge; se corrige en el mismo PR. No se salta ni se comenta ningún test para «ponerlo verde».
8. **¿Qué es el hallazgo más valioso del trimestre?** — El survivor: un mutante `max:10 → max:11` del rate limiter sobrevivió a toda la suite porque nadie fija el default. Los tests que no pueden fallar no son tests (ver `testing/hallazgos.md`, hallazgo 23).
