# Patrón genérico de pasarela de pagos (Fase 6 del cierre de brechas)

Estado: **EJECUTADO — pasarela Wompi (modo sandbox) integrada y verificada**
(2026-10-24). Compras de prueba SOLO en sandbox (dinero virtual: `pub_test_*` /
`prv_test_*`); para producción real basta crear la cuenta Wompi y reemplazar las
llaves sandbox por las de producción en `backend/.env` (el código no cambia:
`esAmbientePruebas()` detecta el modo por el prefijo `pub_test_`/`pub_prod_`).
Activación: variable `PAYMENT_GATEWAY=wompi`. Verificación: 25/25 checks E2E
(API con pago real en sandbox), 10/10 checks de UI (sonda Playwright msedge),
68/68 tests unitarios backend, 51/51 frontend. Detalle en §5.

## 1. Qué ya existe (commit `407232c`)

| Pieza | Implementación |
|---|---|
| Estado de venta inicial | `PAYMENT_GATEWAY` (env, vacío = actual) activa `PENDIENTE_PAGO` como ESTADO inicial en `checkoutController.js` (`ESTADO_INICIAL_VENTA`) |
| Sin pasarela | Todo el flujo actual intacto: venta `COMPLETADA` al confirmar el checkout, correos/notificaciones inmediatos post-commit |
| Con pasarela | Correos/notificaciones post-commit quedan SILENCIADOS (`if (!PAYMENT_GATEWAY)`) — se emiten cuando el webhook/confirma |
| Cancelación | `comprasController.cancelarCompra` ya admite `PENDIENTE_PAGO` (reingresa stock y registra movimiento) |
| Visibilidad | badge "Pendiente de pago" en web (`estadoCompra.ts`), móvil (`perfil/compras.tsx`) y admin (`AdminOrdenes.tsx`) |
| Total en servidor | ya se calcula 100% en servidor (el cliente nunca envía montos) — requisito previo cumplido |

## 2. Contrato a implementar cuando se elija proveedor

1. **Config** (backend/.env): `PAYMENT_GATEWAY=<nombre>` + claves de la pasarela
   (`PAYMENT_*_PUBLIC_KEY`, `PAYMENT_*_SECRET_KEY`, `PAYMENT_*_WEBHOOK_SECRET`).
   Placeholder en `backend/.env.example`; NUNCA en el repo.
2. **Sesión de pago**: endpoint `POST /api/checkout/pagar` con la misma autenticación
   del checkout → la pasarela devuelve URL de redirección/checkout embebido; NADA de
   datos de tarjeta toca el backend (modo hosted/redirect — PCI 100% del proveedor).
3. **Webhook**: `POST /api/pagos/webhook` SIN sesión, protegido por **firma
   HMAC** del proveedor (header propio del proveedor con clave
   `*_WEBHOOK_SECRET`, comparación en tiempo constante) e **idempotente de
   reintentos**: idempotencia por `REFERENCIA_PAGO` + id externo del proveedor
   (UPSERT); responde 2xx solo tras COMMIT... o inserta en una tabla de eventos de
   pagos externos para reprocesar.
4. **Confirmación**: al confirmar el pago — dentro de UNA transacción —
   `VENTAS.ESTADO='CONFIRMADA'` (transición `PENDIENTE_PAGO→CONFIRMADA`),
   revalidar stock con el mismo patrón FOR UPDATE si hubiese cambiado; luego
   disparar los correos/notificaciones hoy silenciados.
5. **Rechazo/expiración**: job periódico marca `PENDIENTE_PAGO` antiguo (>48 h) como
   `CANCELADO` reingresando stock (mismo helper de cancelarCompra).
6. **Pruebas**: nunca hooks reales en dev — endpoint de prueba interno SOLO si
   NODE_ENV=development, y tests de integración que simulan firmas válidas/inválidas.

## 3. Candidatos para Colombia

| Pasarela | Pro | Contra |
|---|---|---|
| Wompi (Ábaco) — el sugerido para Colombia | Nequi/Daviplata/PSE nativo, webhook con firma HMAC bien documentada, tarifas locales | funcionalmente checkout propio (UI de la pasarela); enlaces de pago expiran solo en 3 días |
| Mercado Pago Checkout API | gran cobertura, SDKs maduros | SDK pesado; idempotencia del webhook es la propia del proveedor |
| Stripe | la mejor API, modo de pruebas impecable | NO soporta COP; billing/servicio caro para Colombia |
| PayU Latam | cobertura amplia en CO | API legacy; sandbox inestable |

## 4. No negociable en ninguna elección

- Números de tarjeta/código nunca en BD ni logs (el proveedor maneja PCI;
  el sistema solo contiene IDs de transacción).
- Montos del webhook vs venta validados contra la transacción local (centavos,
  tipo de cambio N/A — solo COP).
- El cliente NO puede saltarse `PENDIENTE_PAGO` mezclando endpoints (middleware de
  estado al confirmar/entregar: `PENDIENTE_PAGO` no admite avanzar a envío).
- Rate limit dedicado en el endpoint de sesión de pago (evitar aperturas infinitas).

## 5. Resultado de la integración (24-10-2026)

### 5.1 Piezas entregadas

| Pieza | Archivo | Detalle |
|---|---|---|
| Config de pasarela | `backend/utils/pagos.js` | `gatewayActivo()` exige PAYMENT_GATEWAY=wompi + llaves; ambiente sandbox/prod por prefijo de la llave; `firmaIntegridad` SHA256(ref+centavos+moneda+secretIntegridad); `urlCheckoutWompi` (widget con `signature%3Aintegrity=integrity:<hash>`); `verificarEventosWompi` checksum SHA256(props+timestamp+secretEventos) con doble convención de rutas (`transaction.*` relativas a data o `data.transaction.*`); `compararSegura` (timing-safe, rechaza vacíos); `fetchWompi` con 3 reintentos (la red a sandbox suelta ECONNRESET intermitente); `obtenerTransaccionWompi` (GET público) y `buscarTransaccionesPorReferencia` (GET …?reference= **exige llave privada**) |
| Endpoints | `backend/controllers/pagosController.js` + `backend/routes/pagosRoutes.js` (mount `/api/pagos` en `server.js`) | `POST /pagar` (venta PENDIENTE_PAGO del dueño → UPDATE REFERENCIA_PAGO con guard `AND ESTADO='PENDIENTE_PAGO'` (idempotencia: repetir devuelve la MISMA URL) → `urlCheckout` firmada; rate 15/min); `GET /estado/:id` (pull de la transacción: APPROVED→CONFIRMADA, DECLINED/VOIDED→reingreso stock + CANCELADA, PENDING→sigue pendiente + emails/notificaciones solo el primer cambio); `POST /webhook` (raw body + HMAC SHA256 hex del secret de eventos comparado timing-safe; válido → reconsulta la transacción vía API y confirma — el payload alone no confía; 403 + fila FIRMA_INVALIDA si la firma falla; sin EXTERNO_ID → 400); `expirarVentasPendientes()` (job cada 15 min en `server.js`: FECHA_VENTA > 48 h → transacción `FOR UPDATE`, reingreso stock por DETALLE_VENTAS con `MOVIMIENTOS_STOCK ENTRADA`, venta CANCELADA + envío CANCELADO) |
| Idempotencia | tabla `PAGOS_EVENTOS` (`EXTERNO_ID`, `CHECKSUM`, `ESTADO_PROCESADO`, `RESULTADO`, `PAGOS_EVENTOS_JSON`, UNIQUE EXTERNO_ID+CHECKSUM) | en `setup.js` (createSql en MIGRACIONES) + `schema.sql` regenerado (36 tablas); cada webhook válido registra evento; si el par (id, checksum) ya se proceso → solo se vuelve a leer la transacción y el confirmado es idempotente por el guard FOR UPDATE de `PENDIENTE_PAGO` (nada se duplica: emails/avisos/emisiones solo suceden en el primer cambio de estado) |
| Confirmación de venta | `notificarVentaConfirmada()` en `pagosController.js` | misma plantilla del checkout (correo con items URL de imagen desde PRODUCTO_IMAGENES ORDEN=1 — **OJO: PRODUCTOS no tiene URL_IMAGEN**), mailer conexión/pago, modo `CONFIRMADA`, notificación comprador, notificación al admin, limpieza de carrito, factura PDF en el correo |
| UI | `CompraExitosa.tsx` (banner pendiente: "¡Orden registrada!"/"PENDIENTE DE PAGO", spinner "Verificando tu pago cada pocos segundos…", botón "PAGAR CON WOMPI" que crea una NUEVA sesión; banner cancelada cuando expiró: "Tu pedido expiró sin pago y fue cancelado. El stock volvió a la tienda."; polling `/api/pagos/estado/:id` cada 3.5 s mientras PENDIENTE_PAGO) · `DetalleCompra.tsx` (botón "Pagar ahora", gate `ESTADO === PENDIENTE_PAGO`) · `MisCompras.tsx` (botón en la fila) · `ResumenCompra.tsx` (banner pasarela-banner ("Pago seguro con la pasarela Wompi", no pedir diligenciar datos) y al enviar formulario redirige directo → `window.location.href = urlCheckout`), `alert` de pedido pendiente | disabled si la venta ya se intentó (idempotencia estricta) |

### 5.2 Convenciones descubiertas de la API sandbox (docs.wompi.co da 403 a fetch y los Tutoriales eran escasos)

- Tokenización de tarjeta: `POST /v1/tokens/cards` (NO `/tokenize/cards`), body plano `{ number, cvc, exp_month, exp_year (2 dígitos) , card_holder }`, Bearer **pública** → 201 `data.id` (`tok_test_…`).
- Tokens de aceptación: `GET /v1/merchants/{pub}` → `presigned_acceptance.acceptance_token` y `presigned_personal_data_auth.acceptance_token` (NO existen `acceptance_tokens.*`); la transacción exige AMBOS tokens (`acceptance_token` + `accept_personal_data_auth_token`).
- `POST /v1/transactions`: `signature` es un STRING plano (`sha256(ref+centavos+moneda+integrity)`); el objeto `{integrity}` es solo del widget HTML. Monto mínimo 150000 centavos ($1.500 COP).
- Estado inicial `PENDING` → `APPROVED` asincrónico (~ pocos s): NO confiar en grep inmediato, sondear `GET /v1/transactions/{id}` a ~2,5 s.
- `GET /v1/transactions?reference=` requiere la llave **privada** (401 con pública) — causa del primer pull mal; el GET por ID sí admite pública.
- Widget: la URL del checkout es `https://checkout.wompi.co/p/?…&signature%3Aintegrity=integrity%3A<hash>&redirect-url=<volver>`; la venta vuelve con el param `id` de transacción.
- Cambio de flujo de pago: en pruebas con tarjeta adolece de verificación 3DS; si se quiere PSE/Nequi en pruebas, es manual en el widget.

### 5.3 Evidencia de verificación (sonda en contenedor: `node probe-pagos-e2e.mjs`, archivo temporal borrado luego)

25/25: login admin 200 · checkout PENDIENTE_PAGO + envío PENDIENTE + stock deducido + SIN avisos · /pagar firmada · transacción sandbox real APPROVED (`12235670-1792863147-93417`) · pull → CONFIRMADA + avisos (comprador + admin) + `DATOS_PAGO` con medio CARD · webhook válido → 200 `estado "procesado"` + idempotencia sin duplicar avisos + fila ESTADO_PROCESADO=RECIBIDO · webhook firma inválida → 403 + fila FIRMA_INVALIDA · venta vieja (-49 h) expirada por `expirarVentasPendientes()` → CANCELADA + stock reingresado.

10/10 UI (sonda Playwright msedge): login ✔ · carrito/agregar ✔ · checkout ✔ · banner PENDIENTE DE PAGO ✔ · botón PAGAR CON WOMPI visible (sin navegar) ✔ · DetalleCompra muestra "Pagar ahora" ✔ · venta CONFIRMADA vista de éxito estándar ✔ · CONFIRMADA no ofrece botón de pago ✔ · 0 errores de consola.

Tests: backend `utils/pagos.test.js` 11/11 (gateway/config/ambiente, firmaIntegridad determinística con y sin expiración, urlCheckoutWompi params + firma `integrity:`, compararSegura (mayúsculas, largos, vacíos), verificarEventosWompi: rutas relativas, `data.*`, checksum adulterado, cuerpo sin data/props, valores ausentes como ""). Frontend 51/51; backend total: 68/68.

### 5.4 Estado de los entornos de prueba

- Ventas demo **CONFIRMADAs** por sandbox (dinero virtual, no real): 92, 96, 98, 100 — quedan como demo pagada de Mis Compras.
- Ventas de prueba **CANCELADAs** con stock reingresado y sin rastro en PAGOS_EVENTOS: 88, 89, 90, 91, 93, 94, 95, 97, 99, 101, 102.
- La venta **103** queda **PENDIENTE_PAGO** a propósito para que el usuario pruebe el pago en sandbox desde el navegador: entrar como `yeison`, `/compra-exitosa/103` o Mis Compras → Pagar ahora, y en el widget pagar con la tarjeta de prueba `4242424242424242`, exp_month `12`, exp_year `2030`, cvc `123` (lo que entra es pesos de prueba; la pasarela sandbox no mueve dinero real).
