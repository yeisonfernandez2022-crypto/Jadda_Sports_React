# Sprint 7 — Review: Pruebas y Manejo de Errores

> Entregable de la **Semana 8** del bootcamp (`week-08-sprint_7_pruebas_y_manejo_de_errores`,
> archivo `3-proyecto/starter/entregable-s08-sprint-7-review.md`), aplicado al proyecto
> **JADDA SPORTS**. Formato espejo de los entregables S02–S07.
>
> **Nota honesta de preexistencia**: la pirámide de pruebas del proyecto ya existía y
> corre en CI (era el requisito previo del sprint). El trabajo del sprint fue
> **mapear los 5 flujos críticos contra las suites reales** (tabla §3, inventario
> archivo por archivo con conteo exacto de tests), **auditar el manejo de errores**
> de la API (hallazgo real: el formato NO está estandarizado — ver §4) y verificar
> el estado Docker que exige el pre-checklist del gate de la semana 9 (§8, con la
> corrida real del clon limpio del 2026-11-12).

## 1. Qué se planificó (Sprint Planning)

- **Objetivo del Sprint 7**: evidenciar que los 5 flujos más críticos del proyecto
  tienen pruebas automatizadas corriendo en CI, auditar la consistencia del manejo
  de errores de la API y dejar el pre-gate Docker de la semana 9 en verde.
- **Historias movidas del backlog a este sprint** (mapeadas a las HUs del backlog
  del proyecto): HU-006..010 (autenticación), HU-015/018 (checkout y pagos), HU-040
  (retos/cupones), HU-033 (devoluciones/reembolsos), HU-036 (login social) — todas
  las del círculo crítico que el taller de cobertura pide cubrir.

## 2. Qué se construyó

| Historia / Tarea | Estado | PR (enlace) |
|---|:---:|---|
| Inventario de las 28 suites de test backend (219 tests) mapeado a los 5 flujos críticos | Completada | `Develop...documentacion-swagger-openapi` |
| Cobertura de los 5 flujos críticos verificada en CI (run #137: Backend Unit + Backend Integration + E2E Playwright en verde) | Completada | idem |
| Auditoría del manejo de errores: formatos y códigos HTTP por módulo | Completada (con hallazgo real) | idem |
| `.env.example` raíz para el gate de la semana 9 (commit `65b2fa3`) | Completada | idem |
| Estandarización del formato de error de la API | **Parcial — documentada como deuda** (ver §4) | idem |

## 3. Cobertura de Pruebas — Flujos Críticos

Inventario real (conteo por archivo, 2026-11-12): **219 tests backend en 28 archivos**
· **22 tests de integración** con MySQL real (puerto 3307) · **65 tests frontend**
(vitest + RTL + MSW) · **20 specs Playwright** × chromium en CI (msedge en local).

| # | Flujo crítico | Prueba(s) | Corre en CI |
|---|---|---|:---:|
| 1 | **Autenticación y sesión** (login, OTP, social, bloqueo por fuerza bruta, CSRF por Origin) | `authRoutes.test.js` 8 · `verificacionSocial.test.js` 5 · `proteccionOrigen.test.js` 10 · `rateLimiter.test.js` 7 · `registro-conexion.test.js` 8 · **integration** `fuerza-bruta.test.js` 4 · E2E 3 specs (login admin/vendedor/password) | Sí (Backend Unit + Integration + E2E) |
| 2 | **Checkout / stock / cupones / envío** | **integration** `checkout-concurrencia.test.js` 2 (2 checkouts simultáneos → 200 + 409) · `reglasCupones.test.js` 10 · `envio.test.js` 14 · `envioRoutes.test.js` 4 · **integration** `basic.test.js` 14 · E2E 2 specs (checkout mínimo) | Sí |
| 3 | **Pagos Wompi** (firma, expiración, webhook checksum) | `pagos.test.js` **31** (el archivo más grande de la suite) | Sí (Backend Unit) |
| 4 | **Retos / cupones RETO-** (un solo uso, personal, mínimo) | **integration** `cupon-reto.test.js` 2 · `reglasCupones.test.js` 10 | Sí |
| 5 | **Devoluciones / reembolsos por cancelación** | `reembolsosCancelacion.test.js` 5 (pago confirmado, envío no salido, agregado por producto, incluye envío) | Sí |

*Cobertura de los tests de reglas citada por el entregable anterior (S05): los 72
tests de reglas de negocio. Suites de referencia del proyecto: backend 208/208 →
219/219 tras los 4 tests de envío del Sprint 0.

**Salvedad honesta**: el flujo COMPLETO de devolución (solicitud multi-producto con
evidencias y las 4 decisiones del admin/vendedor) no tiene suite propia — está
cubierto por los 5 tests de reembolsos de cancelación y por la verificación E2E
manual de la época; registrado como deuda (S09 §4).

## 4. Manejo de Errores

- **Códigos HTTP correctos aplicados en** los endpoints principales — afirmados
  verbatim por los tests: `400` con mensajes de dominio exactos (cupón con mínimo
  "El cupón X requiere una compra mínima de $Y (tu carrito suma $Z)", stock
  insuficiente por producto), `401` genérico anti-enumeración en login ("Correo o
  contraseña incorrectos") con `403 { requiereVerificacion: true }` solo tras
  validar contraseña, `403` de reglas de negocio (vendedores no compran, cupón
  RETO ajeno, venta de vendedor para admin), `404` sin revelar existencia
  (recuperar/reenviar con correo inexistente responden 200 genérico), `409`
  de concurrencia de stock, `429` de los rate limits por ruta. El handler global
  honra `err.status` (JSON malformado → 400 "Petición rechazada", límite → 413) y
  añade `reqId` correlacionable con el log.
- **Endpoints pendientes de estandarizar** (hallazgo real del sprint): los
  controllers mezclan **tres claves de mensaje** — `{ error }` (productos/checkout/
  devoluciones), `{ msg }` (notificaciones/cupones) y `{ message }` (auth). La
  forma de respuesta de error NO tiene helper compartido: cada controller
  construye su objeto. **Plan para el siguiente trimestre**: extraer
  `utils/respuestaError.js` (función única `error(res, status, msg, extra)`),
  migrar controller por controller con los tests como red de seguridad (los
  mensajes verbatim no cambian, solo la clave), y añadir un test de contrato que
  afirme UNA clave en todos los endpoints. Impacto: el frontend/móvil hoy
  normalizan `data.error || data.msg || data.message` — un helper único elimina
  esa triple lectura.

## 5. Demo

- Correr la suite completa en vivo: `corepack pnpm exec vitest run` en backend
  (219/219, ~4 s) y la integración con MySQL real en contenedor (22/22).
- Mostrar el run #137 de CI con los jobs Backend Unit + Backend Integration +
  E2E Playwright en verde.
- Romper un mensaje de dominio a propósito (p. ej. el texto del cupón mínimo) y
  mostrar cómo el test que lo afirma verbatim vuelve rojo — evidencia de que los
  mensajes son parte del contrato.

## 6. % de Avance Acumulado del Proyecto

- **Antes del Sprint 7**: ~62 % (S06).
- **Después del Sprint 7**: **~72 %** — Sprint 7 aporta **+10 pts**: inventario
  completo de la pirámide con conteo por archivo, los 5 flujos críticos mapeados a
  suites reales corriendo en CI, auditoría de manejo de errores con hallazgo y plan,
  y el `.env.example` raíz del gate (criterios del pre-gate verificados, §8).

## 7. Estado Docker de esta Semana

| Ítem | Estado |
|---|:---:|
| `Dockerfile` con build multi-stage (backend) | **Parcial** — single-stage con el MISMO efecto: `pnpm install --frozen-lockfile --prod` (cero devDependencies ni nodemon en la imagen final) + **copia granular** del árbol de runtime (S6470: nada sensible entra al contenedor) + runtime sin root (USER node). La conversión formal a multi-stage está en la deuda (S09 §4) |
| `Dockerfile` con build multi-stage (frontend) | **Sí** — node build → nginx:alpine con plantilla + snippet compartido; el `dist` entra a la imagen final vía `COPY --from=build` |
| `.dockerignore` presente y completo | **Sí** — backend (node_modules, .env, .env.*, data, uploads, .git, *.log) y frontend (node_modules, dist, .env, .env.*, .git, *.log, test-results) |
| CI construye y prueba contra la imagen real | **Parcial** — los jobs "Build Verification" y "Build Production Images" CONSTRUYEN ambas imágenes prod y validan el compose; las suites corren con **MySQL real en contenedor** (servicios del workflow) pero el proceso del backend en los jobs de prueba corre en el runner, no dentro de la imagen prod. Plan: añadir al workflow un job que ejecute el smoke-test dentro de la imagen construida |

## 8. Pre-Checklist del Gate de Semana 9

- [x] `git clone` limpio + `cp .env.example .env` + `docker compose up` levanta el
  proyecto completo — **EJECUTADO REALMENTE el 2026-11-12** (detalle completo en
  S09 §1): clon de `documentacion-swagger-openapi` @ `65b2fa3`, los 3 contenedores
  levantaron, la BD se sembró desde cero y el SPA sirvió el catálogo (200, 68.273 B)
  por el proxy.
- [x] Backend, frontend y base de datos corren cada uno en su propio contenedor
  (`jadda_backend` / `jadda_frontend` / `jadda_mysql` — nombres fijos del compose).
- [x] Ningún proceso corriendo fuera de Docker: el compose ejecuta `pnpm install &&
  pnpm dev` DENTRO de los contenedores (los volúmenes `backend_modules`/
  `frontend_modules` hacen el resto) — verificado al correr el gate sin host.
- [x] El equipo puede demostrar el proyecto sobre la versión containerizada — el
  gate se corrió con el entorno dev detenido (no coexistieron procesos host).

**Ítems pendientes y plan antes de la semana 9**: el `.env` del clon se rellena con
credenciales reales por canal fuera de git (el `.env.example` solo trae placeholders);
para la demo ADMIN conviene añadir `ADMIN_EMAIL`/`ADMIN_PASSWORD` al `backend/.env`
del clon (el seed del admin es opcional en dev desde 2026-11-11 — el arranque no
falla sin ellas). Ambos pasos quedan en el guion de demo del S09.

## 9. Retrospectiva Breve

- **¿Qué salió bien?** El inventario archivo-por-archivo convirtió "tenemos pruebas"
  en evidencia evaluable (28 suites, 219 tests, 5 flujos mapeados); el hallazgo del
  formato de error mezclado salió de la propia auditoría, no de un checklist.
- **¿Qué no salió bien?** La estandarización del formato de error quedó como deuda
  (los 3 controllers críticos usan claves distintas) — moverla al sprint de cierre
  habría tocado más archivos de los que el tiempo del sprint permite revisar bien.
- **¿Qué vamos a cambiar en el Sprint 8 (semana 9)?** Nada de código nuevo: cierre
  con gate real (ya ejecutado), code review del repo completo y hand-off honesto.
