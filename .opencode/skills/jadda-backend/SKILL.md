---
name: jadda-backend
description: "Use when editing anything under backend/ of JADDA SPORTS (Express 5 CommonJS with express-session + Passport, controllers/routes/middlewares/utils) — adding an endpoint, a controller, transactions with FOR UPDATE, stock movements, emails, PDFs/Excel reports, Wompi payments, or applying rate limits. Also use before running node --check or backend vitest."
---

# Backend de JADDA SPORTS (Express 5 + MySQL)

Hechos verificados leyendo `backend/` (package.json, server.js y los 90+ archivos). No supuestos.

## Stack exacto (backend/package.json)

- Express **5.2.1**, CommonJS (`type: commonjs`), scripts: `dev` (nodemon), `test` / `test:coverage`, `migrate: node database/migrate.js`.
- Prod deps: mysql2 3.20.0, express-session 1.19.0, express-mysql-session, passport 0.7 + google-oauth20 + facebook, helmet 8, cors, bcryptjs 3.0.3, multer 2.2.0, nodemailer 8.0.3, pdfkit, exceljs 4.4.0, cloudinary 2.11.0, google-auth-library, dotenv 17.3.1.
- **Cero JWT** (`jsonwebtoken` eliminado): autenticación = cookie de sesión.
- Tests: vitest 5, supertest 7 (integración), @vitest/coverage-v8.

## Estructura real

- `controllers/` — 25 archivos, uno por dominio (adminController, authController, carritoController, chatController, checkoutController, comprasController, contactoController, cuponesController, direccionController, devolucionController, envioController, favoritosController, historialController, imagenController, metodoPagoController, newsletterController, notificacionController, pagosController, planController, productoController, proveedorController, pqrController, retoController, seguridadController, vendedorController).
- `routes/` — 24 archivos `*Routes.js`; cada uno monta sus middlewares (rate limit por ruta, `verificarSesion`, `esAdmin`, `esVendedor`) y las monta en server.js (23 mounts `/api/*`).
- `middlewares/` — `authMiddleware.js`/`esAdmin.js`/`esVendedor.js`/`rateLimiter.js`/`proteccionOrigen.js`/`registroPeticiones.js` (+ tests co-ubicados).
- `utils/` — 33 archivos: `pagos.js` (Wompi), `envio.js` (tarifas por departamento + envío gratis), `reglasCupones.js`, `facturaPdf.js` (pdfkit), `reporteExcel.js`/`reportePdf.js` + variantes `reporteVendedor*` (exceljs), `estadoPedido.js` (correo + notificación in-app al cambiar estado), `correo.js` (`imagenComoDataUri`, `plantillaCorreo`), `cloudinary.js`, `cancelacionVenta.js` (`cancelarVentaYReembolsar`) + `reembolsosCancelacion.js`, `movimientosStock.js`, `numeroPedido.js` (hash Knuth → número de 8 dígitos estable), `agrupacionVentas.js` (granularidades cerradas, anti-inyección en reportes), `validarSubida.js`/`formatoImagen.js` (magic bytes), `groserias.js`, `trustProxy.js`, `carpetaUsuario.js` (uploads/usuarios/{USUARIO}/…), `arranque.js`, `verificacionSocial.js`.
- `config/` — `db.js` (pool mysql2), `passport.js` (Google OAuth web: valida userinfo y exige email_verified; Facebook por Graph), `mailer.js` (timeouts 10/10/20 s), `origenesAdmitidos.js` (CORS + CSRF).
- `database/` — `setup.js` (schema+migraciones+seeds al arrancar), `schema.sql`, `exportarSchema.js`, `migrate.js`, `contenidos-producto.js`.

## Convenciones al escribir código backend

1. **CommonJS**: `require`/`module.exports`. En controllers usa `exports.funcionX = async (req,res)` y nunca `module.exports = {...}` AL FINAL (pisa los exports anteriores → "argument handler must be a function").
2. Respuesta JSON consistente: éxito `{ ok: true, ... }`; error con código HTTP correcto (400 validación, 401 sesión, 403 rol/ownership, 404 no existe, 409 duplicado/concurrencia, 429 rate limit) y `msg`/`message` en ESPAÑOL.
3. **Transacciones del checkout**: `checkoutController` valida stock y calcula TOTAL/DESCUENTO/ENVÍO SIEMPRE en el servidor; usa `BEGIN/COMMIT/ROLLBACK` + `SELECT ... FOR UPDATE` por variante y guard `AND STOCK >= ?` (`affectedRows===1` → 409) dentro de la transacción; libera la conexión en `finally`.
4. Stock: cada cambio mueve `MOVIMIENTOS_STOCK` con `registrarMovimientoStock({conn?, idProducto, tipo: 'SALIDA'|'ENTRADA', cantidad})` (helper que NUNCA lanza).
5. Correo/notificaciones best-effort: nodemailer + `utils/correo.js`; notificación in-app escribiendo en `NOTIFICACIONES` (con ruta por destinatario) — SIEMPRE try/catch, jamás bloquean la respuesta.
6. Cancelación de ventas: reutiliza `utils/cancelacionVenta.js` (`cancelarVentaYReembolsar({idVenta, canceladaPor})`) — transacción, lock `FOR UPDATE` SIN LEFT JOIN (MySQL no bloquea nullable), distinguye reembolso automático (pago confirmado pre-despacho) y notifica tras el commit.
7. Número de pedido público: `utils/numeroPedido.js` (8 dígitos derivados de ID_VENTA; no se guarda en BD). Espejo exacto en frontend y móvil.
8. Rutas nuevas: rate limit obligatorio para acciones sensibles con `rateLimit({ ventanaMs, max, mensaje, totalPorIp })` (en memoria por proceso; se desactiva con `NODE_ENV=test` o `DISABLE_RATE_LIMIT=true`); login = 10/15 min por IP (útil en pruebas: `docker restart jadda_backend` limpia el limiter).
9. Subidas: valida tipo REAL con magic bytes (`utils/formatoImagen.js` + `validarSubida.js`); evidencias ≤25MB ×5, imágenes de producto ≤6MB. Cloudinary si `CLOUDINARY_URL` está configurado, fallback a disco (`uploads/…` con mount a `frontend/public/images`).
10. Sanitiza y limita texto libre (motivo ≤500, descripción ≤2000, censura con `utils/groserias.js` en chats), y aplica escHTML en el frontend para textos del usuario.

## Pasarela Wompi (sandbox activo)

- `utils/pagos.js`: firma de integridad SHA256 (hash PLANO sin prefijo `integrity:` en la URL del widget), activación por env `PAYMENT_GATEWAY=wompi` + llaves `WOMPI_*` (solo en `backend/.env`).
- Flujo: `POST /api/checkout/procesar` crea venta `PENDIENTE_PAGO` con `FECHA_EXPIRA_PAGO` (10 min) → `POST /api/pagos/pagar` crea `REFERENCIA_PAGO = JADDA-<id>-<rand>` y devuelve `urlCheckout` → pestaña de Wompi → pull `GET /api/pagos/estado/:id` (confirma y dispara factura/stock/correos) y webhook `POST /api/pagos/webhook` (checksum timing-safe; no se confía en el payload).
- Sólido a idempotencia: toda confirmación parte de un UPDATE con guard `ESTADO='PENDIENTE_PAGO'`; expiración por job de 1 min cancela vencidas y reingresa stock.

## Verificación obligatoria

- `node --check <archivo>` por cada .js editado (es CommonJS, valídalo siempre).
- Suites: **`pnpm test`** (unit, 17 archivos ≈154 tests) e **integración `npx vitest run --config vitest.integration.config.mjs`** (22 tests, MySQL real docker-compose.test.yml puerto 3307). Detalle en la skill `jadda-testing`.
- Tras cambiar el esquema: regenerar `schema.sql` (`node backend/database/exportarSchema.js`) — ver skill `jadda-database`.
