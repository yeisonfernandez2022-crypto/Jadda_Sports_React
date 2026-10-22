# Patrón genérico de pasarela de pagos (Fase 6 del cierre de brechas)

Estado: **PATRÓN DOCUMENTADO — proveedor concreto por decidir** (decisión del
cliente, 2026-10-22: "definir pasarela más tarde"). El código ya queda preparado
para activarse con UNA variable de entorno; cero dependencias nuevas hasta
entonces.

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
