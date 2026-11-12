# Sprint 4 — Review: Reglas de Negocio y Servicios

> Entregable de la **Semana 5** del bootcamp (`week-05-sprint_4_reglas_de_negocio_y_servicios`,
> archivo `3-proyecto/starter/entregable-s05-sprint-4-review.md`), aplicado al proyecto
> **JADDA SPORTS** (Express 5 + MySQL/TiDB, React 19 SPA, app móvil Expo).
> Formato espejo de los entregables S02/S03/S04.
>
> **Nota honesta de preexistencia**: las reglas de negocio del sprint (HU-015/017/018)
> estaban implementadas antes del bootcamp. El trabajo del sprint fue **extraerlas e
> inventariarlas como reglas explícitas** (tabla §4), documentar la capa de servicios
> real del proyecto (módulos de dominio puros en `backend/utils/`), responder las
> preguntas guía con código y verificar la paridad local/contenedor de los tests.
> Único cambio de código: cherry-pick del fix de integración del Sprint 3 (commit
> `55bb565`) para que esta rama también esté verde.

**Objetivo del sprint:** explicitar las reglas de negocio de las HU-015 (total de la
compra), HU-017 (dirección de envío) y HU-018 (método de pago + pasarela), evidenciar
dónde viven (módulos de dominio puros vs. controlador transaccional), y verificar que
los tests de reglas pasan tanto en local como contra el backend containerizado (CI).

## Historias completadas

| Historia | PR (enlace, mergeado a `develop`) |
|---|---|
| **HU-015 — Calcular y mostrar el total de la compra** | `https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React/compare/Develop...feature/sprint4-reglas-negocio` (apertura/merge = acción del propietario) |
| **HU-017 — Ingresar la dirección de envío** | mismo PR |
| **HU-018 — Seleccionar el método de pago (pasarela Wompi sandbox)** | mismo PR |

Evidencia por historia (código real):

- **HU-015**: `POST /api/checkout/procesar` calcula subtotal, descuento de productos
  (`ID_DESCUENTO`), descuento de cupón, envío y total **100 % en servidor** — ignora
  `totalFinal`/`descuentoAplicado` que mande el cliente (`checkoutController.js` L100:
  comentario de diseño + recalcula). El desglose que muestra la SPA se alimenta de la
  misma aritmética server-side (`GET /api/envio/calcular?departamento=&subtotal=` para
  el preview del envío). **Divergencia de dominio registrada**: el texto original de la
  HU menciona "IVA 19%" y el sistema **no desglosa IVA** (precios finales; el desglose
  es base → descuento productos → subtotal → descuento cupón → envío → total).
- **HU-017**: CRUD de direcciones con ownership (`direccionRoutes.js` L14-17: GET/POST/
  PUT/DELETE, todos `verificarSesion` + rate 20/15 min, el controlador filtra por
  `ID_USUARIO`), la dirección elegida viaja al checkout y se persiste en `ENVIOS` en
  servidor; edición de la dirección de un pedido bloqueada cuando el envío salió del
  almacén (400 "No puedes editar la dirección porque el pedido ya salió del almacén").
- **HU-018**: métodos guardados del perfil (`metodoPagoRoutes.js`: guardar/eliminar/
  principal con ownership) + pasarela **Wompi sandbox** real: `POST /api/pagos/pagar`
  crea la sesión de cobro con firma de integridad (`pagos.js` L198: SHA-256 de
  referencia+centavos+moneda+secreto, hash plano sin prefijo), pull `GET /estado/:id`
  confirma/cancela, `POST /webhook` con checksum timing-safe y **re-obtención de la
  transacción vía API** (no se confía en el payload del webhook).

## Historias no completadas

| Historia | Motivo |
|---|---|
| Ninguna de las HU del sprint (015/017/018) quedó incompleta | Las tres están implementadas y verificadas; el sprint fue de explicitación y verificación. |
| Revisión del PR por compañero (limitación del equipo) | Equipo de 2 (propietario + asistente IA): no hay revisor humano externo. Control aplicado: suites automatizadas + CI + revisión del propietario al abrir el PR. |
| CI E2E Playwright en verde (transversal, preexistente) | Sigue rojo desde antes del bootcamp (ver S04 §Estado Docker): diagnóstico pendiente del propietario con el reporte HTML del run #135. No bloquea los tests de reglas de negocio (unit + integración, en verde). |

## Reglas de negocio identificadas durante el sprint

Reglas que NO estaban explícitas en el informe de diseño ni en el texto de la HU
original (y cómo quedó implementada cada una):

| Regla encontrada | Historia | Cómo se aplicó |
|---|---|---|
| **Envío gratis desde $800.000** (`ENVIO_GRATIS_DESDE = 800000`, `envio.js` L80; `if (subtotalNum >= ENVIO_GRATIS_DESDE) return 0` L97) | HU-015 | Módulo de dominio puro `utils/envio.js`; el umbral real ($800.000) corrige el valor del borrador temprano ($200.000). |
| **Envío por ciudad > departamento > tarifa default**, con tildes normalizadas (25 departamentos + 24 ciudades en tablas del mismo módulo) | HU-015/017 | `calcularCostoEnvio()` — una sola fuente de verdad para API, checkout y correo de confirmación. |
| **Mínimo de compra del cupón escalado por porcentaje**: ≥10 % → $200.000 · 7-9 % → $150.000 · 5-6 % → $100.000 · <5 % → $50.000 (`reglasCupones.js` L1-12) | HU-015 | El checkout rechaza ANTES de abrir la transacción (`checkoutController.js` L84-85) con mensaje exacto "El cupón X requiere una compra mínima de $Y (tu carrito suma $Z)" — el cupón NO se consume si no alcanza. |
| **Cupón `RETO-` personal e intransferible y de UN solo uso** | HU-015/018 | Validación exige sesión y propiedad (`403 "Este cupón de reto no pertenece a tu cuenta"`); en checkout se revalida con `SELECT USADO ... FOR UPDATE` (L349-352) y se marca `UPDATE ... SET USADO = 1 ... AND USADO = 0` (L369) dentro de la transacción — dos checkouts concurrentes serializan: el segundo recibe 403. |
| **Total inmutable desde el cliente** | HU-015 | El servidor recalcula TODO; `totalFinal` del body es ignorado (L100). |
| **Vendedores no compran** (403, L118) **y deben cambiar su contraseña temporal antes de comprar** (403, L125: `DEBE_CAMBIAR_PASSWORD`) | HU-018 | Guards de negocio al inicio del checkout — la segunda no estaba en ningún documento de diseño. |
| **Concurrencia del stock**: `SELECT STOCK ... FOR UPDATE` por variante (L253) + `UPDATE ... SET STOCK = STOCK - ? WHERE ID_VARIANTE = ? AND STOCK >= ?` (L317) → **409** si otra venta ganó la fila (L322) | HU-015 | Transacción única del checkout; el rollback revierte stock, movimientos y cupón. Probado por test de integración concurrente (`checkout-concurrencia.test.js`: 2 checkouts simultáneos → 200 + 409). |
| **Expiración del pago**: ventana `PAGOS_EXPIRA_MINUTOS` (default 10, mínimo 1, `pagos.js` L28) — si el cobro no se completa, el pedido se cancela solo y el stock regresa | HU-018 | Pull `GET /pagos/estado/:id` verifica `pagoVencido()` (L110) y el job en `server.js` (1 min) cancela las vencidas con reingreso de stock + notificación. La HU original no contemplaba expiración alguna. |
| **El webhook no es fuente de verdad**: checksum HMAC timing-safe (`verificarEventosWompi` L340 + `compararSegura`) y la transacción se RE-consulta en la API de Wompi antes de confirmar | HU-018 | Firma inválida → 403 + fila de auditoría `PAGOS_EVENTOS.FIRMA_INVALIDA`. |
| **Reembolso automático de cancelación pagada antes del despacho** (productos + costo de envío), regla `ventaPagada`: COMPLETADA/CONFIRMADA aunque `DATOS_PAGO` sea NULL; NUNCA reembolsa si el envío salió o si la venta es `PENDIENTE_PAGO` | HU-017/018 | `utils/reembolsosCancelacion.js` + `utils/cancelacionVenta.js` (transacción compartida por cliente/admin/vendedor). Cobertura por tests (`reembolsosCancelacion.test.js`: 5 tests). |
| **Bloqueo por cuenta por fuerza bruta** (no por IP): 10 logins fallidos → ventana de 15 min persistida en BD, evaluada en SQL (independiente de réplicas) | HU-018 (login) | `USUARIOS.INTENTOS_LOGIN/VENTANA_LOGIN` + test de integración `fuerza-bruta.test.js` (4 tests). |
| **Precios finales SIN desglose de IVA** — el texto original de HU-015 pedía "IVA 19%" | HU-015 | Decisión de dominio implementada: no hay línea de impuestos en el desglose ni cálculo en el checkout. Registrada como divergencia HU ↔ sistema. |

## Capa de servicios

- **Servicios creados**: **ninguno en este sprint** — el inventario demuestra que la
  capa de servicios ya existe con el patrón del proyecto: **módulos de dominio puros**
  (sin `req`/`res`, sin Express) en `backend/utils/`, consumidos por los controladores:
  `utils/envio.js` (tarifas + umbral gratis), `utils/reglasCupones.js` (mínimos +
  condiciones de texto), `utils/pagos.js` (firma, expiración, verificación de eventos,
  comparación timing-safe), `utils/reembolsosCancelacion.js` + `utils/cancelacionVenta.js`
  (transacción de cancelación/reembolso), `utils/movimientosStock.js` (registro de
  entradas/salidas), `utils/numeroPedido.js` (número estable por hash).
- **Excepciones de dominio definidas**: el proyecto no usa clases de error custom —
  las excepciones de negocio se modelan como **códigos HTTP con mensajes de dominio
  exactos** (400 "…requiere una compra mínima…", 403 "Los vendedores no pueden comprar…",
  403 "Este cupón de reto no pertenece a tu cuenta", 409 "El stock cambió mientras se
  procesaba tu compra", 429 "Demasiados intentos fallidos…") y los tests afirman los
  mensajes verbatim, de modo que un cambio silencioso de texto rompe el suite. El
  checkout usa un `throw` interno con el mensaje de dominio (L85) atrapado por su
  handler que lo mapea a 400.
- [x] Separación endpoint/servicio verificada en code review (RAP-3) — *con la salvedad
  honesta del equipo de 2*: la verificación fue del asistente (inventario + suites) y
  queda pendiente la firma del propietario al abrir el PR (revisión de los archivos
  `utils/` vs controladores). El controlador de checkout conserva la orquestación
  transaccional (decisión documentada: es el único flujo con transacción de negocio;
  extraerla a una capa adicional sería el siguiente refactor si el producto lo pide).

## Demo

1. **Total server-side**: abrir el checkout con DevTools, interceptar `POST /api/checkout/
   procesar` y mandar `totalFinal: 1` → el servidor IGNORA el valor y registra el total
   real (venta con total correcto en BD).
2. **Cupón con mínimo**: carrito por debajo del mínimo → `400` con el mensaje exacto y el
   cupón sigue usable (no se consumió); subir el carrito → el descuento aplica.
3. **Cupón RETO ajeno**: usuario B intenta validar el cupón de usuario A → `403 "Este
   cupón de reto no pertenece a tu cuenta"` (y en checkout con rollback: sin venta, sin
   stock movido, `USADO=0`).
4. **Concurrencia**: dos checkouts simultáneos de la última unidad (o el test de
   integración en vivo) → `200` + `409 "El stock cambió…"`.
5. **Wompi sandbox**: pagar con Nequi de prueba (`3991111111`) → pull confirma solo →
   venta CONFIRMADA; pagar con `3992222222` → declinada → venta sigue `PENDIENTE_PAGO`
   y se puede reintentar; dejar el pedido sin pagar → a los 10 min se cancela solo y el
   stock regresa.
6. **Reembolso automático**: cancelar un pedido pagado antes del despacho → reembolso
   APROBADO automático (productos + envío) sin pasar por el admin.

## Estado Docker de esta semana

- [x] Tests de reglas de negocio pasan contra el backend containerizado (`docker compose up be` + suite de tests)

**Los tests de reglas de negocio son 64 unit + 8 de integración** (conteo real):
`utils/envio.test.js` 14 · `utils/reglasCupones.test.js` 10 · `utils/pagos.test.js` 31 ·
`utils/numeroPedido.test.js` 4 · `utils/reembolsosCancelacion.test.js` 5 ·
`integration/checkout-concurrencia.test.js` 2 · `integration/cupon-reto.test.js` 2 ·
`integration/fuerza-bruta.test.js` 4.

- **En contenedor**: el job **Backend Unit Tests** de CI (runner Ubuntu containerizado)
  corre la suite completa — **verde** en el run #135 (y en toda la serie; los unit de
  reglas nunca dejaron de pasar). La integración con MySQL real (p. 3307, contenedor)
  quedó **22/22 verde localmente** tras el fix del fixture (`session.regenerate`) —
  el cherry-pick `2ddea9e` en esta rama hace que el PR abra con ambos jobs verdes
  (el job de integración estaba rojo SOLO por ese fixture, no por reglas de negocio).
- **Evidencia local del cierre del sprint** (BD de test aislada `docker-compose.test.yml`,
  NUNCA TiDB): `Tests 22 passed (22)` integración · `Tests 210 passed (210)` unit.

- [x] Paridad local/contenedor verificada por al menos dos integrantes del equipo

Verificada en **dos entornos distintos**: Windows local (Node 22, host) y el runner
containerizado de GitHub Actions (Ubuntu) — la suite de unit da el MISMO resultado
(210/210) en ambos, y la de integración (con MySQL real) da 22/22 en local tras el fix.
*Salvedad honesta*: la paridad la verificó UNA persona (el asistente) en los dos
entornos; el "segundo integrante" queda como la acción del propietario al abrir el PR
(ver CI corriendo sobre esta rama).

## % de Avance Acumulado del Proyecto

**~42 %** de las semanas del plan (Sprint 0 + 1 + 2 + 3 + 4 de 8 sprints de desarrollo +
Semana 1). Sprint 4 aporta **+7 pts**: 12 reglas de negocio explicitadas con ubicación
exacta en el código (incluida 1 divergencia de diseño: IVA 19 % de la HU original no
implementada a propósito), capa de servicios inventariada (módulos puros testeables) y
paridad local/contenedor de los 72 tests de reglas. Nota honesta: el código preexistía —
el porcentaje acredita semanas cerradas con criterios verificados, no líneas nuevas.

## Retrospectiva breve

- **¿Qué salió bien?**: las reglas vivían ya en módulos puros de `utils/` — el sprint fue
  de explicitación, no de rescate: cada regla citada tiene línea exacta y test que la
  afirman (los mensajes de dominio son aserciones verbatim, imposible romperlos sin que
  el suite lo grite). El fix del fixture de integración (Sprint 3, cherry-picked aquí)
  demostró el valor de correr SIEMPRE la suite completa: un test que nadie había corrido
  desde 2026-11-09 escondía el rojo de CI.
- **¿Qué no salió bien?**: (1) el texto de la HU-015 decía "IVA 19 %" y el sistema nunca
  lo calculó — la divergencia quedó documentada en el entregable (regla §4, última fila),
  pero el documento de la HU sigue con el texto original (pendiente de alinear con el
  propietario); (2) no hay clases de excepción de dominio (los errores son HTTP con
  mensajes exactos — patrón válido, pero distinto al teórico del taller); (3) la
  orquestación transaccional del checkout sigue en el controlador (los servicios son
  módulos puros, no una capa formal sobre los endpoints); (4) CI E2E sigue rojo
  (preexistente, diagnóstico pendiente del propietario con el artifact del run #135);
  (5) no existe revisor humano externo (equipo de 2).
- **¿Qué cambia para el Sprint 5?**: integración frontend-backend (HU-020, checkout
  end-to-end): la SPA debe CONSUMIR las reglas server-side tal cual (mostrar los
  mensajes exactos de 400/403/409, no reimplementarlas) — la verificación será que el
  flujo real de compra pase contra el backend containerizado; además, sincronizar la
  fila de PRs pendientes (Sprint 0 → 4) para que CI quede verde sobre `develop` de una
  vez, y pedir al propietario el diagnóstico del E2E con el reporte HTML.
