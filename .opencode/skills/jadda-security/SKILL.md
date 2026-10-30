---
name: jadda-security
description: "Use when touching auth, session, roles, cookies, CORS/CSRF, rate limits, uploads, secrets (.env), Wompi webhook signatures, private image routes or user data handling in the JADDA SPORTS backend/frontend/movil — and when adding or reviewing any security-sensitive code path."
---

# Seguridad de JADDA SPORTS

Hechos verificados en `backend/server.js`, `config/passport.js`, middlewares y controllers. Aplica esto al escribir código nuevo en rutas sensibles.

## Sesión y roles (no JWT)

- Cookie de sesión por **express-session + MySQLStore** (tabla `sessions`): `httpOnly: true`, `sameSite: 'lax'`, `secure: isProduction`, `maxAge: 24h`, secret `SESSION_SECRET` (fail-fast en producción si falta).
- Passport solo para OAuth WEB (Google exige `email_verified` vía userinfo, Facebook valida por Graph). El flujo MÓVIL (`POST /api/auth/social-login`) valida el token social con `google-auth-library`/debug_token, no crea cookie de navegador.
- Roles DB (`ROLES.ID`): **1 = Admin, 4 = Cliente, 6 = Vendedor**. Guards: `middlewares/authMiddleware.js` (verificarSesion → 401), `esAdmin.js` (403 si `ID_ROL !== 1`), `esVendedor.js` (rol 6 + fila en VENDEDORES → `req.vendedor`; 403 en ventas ajenas). El Admin además ve sus cosas propias donde el modelo lo pide — el ownership siempre se filtra por `ID_USUARIO` del recurso, no por rol.
- Otros usuarios pueden ver SUS datos únicamente; las rutas admin no exponen listas sin `esAdmin`. `obtenerPendientes` (`/api/admin/pendientes`) es el agregador seguro de contadores.

## Cookies, CORS y CSRF

- CORS con `credentials: true`, orígenes desde `config/origenesAdmitidos.js` (env `CORS_ORIGINS` añadible).
- **CSRF por verificación de Origin** (`middlewares/proteccionOrigen.js`): mutaciones con Origin ajeno o "null" → 403. No/curl/móvil nativo (sin Origin) pasan. Modelo deliberado porque la app móvil nativa no puede leer cookies httpOnly; NO implementar doble-submit.
- Proxy: `trust proxy` env `TRUST_PROXY` (prod=1) para que `req.ip` sea la IP real detrás de nginx.

## Rate limits (limiter en memoria, por proceso)

- Global `server.js`: 300/min por IP (`GLOBAL_RATELIMIT_MAX`), exentas `/health`, `/api/health`, `/images/*`.
- Por ruta (middleware `rateLimit({ ventanaMs, max, mensaje, totalPorIp })`, default 15 min). Valores reales: login 10/15min, registro 5, confirmar/verificar-código 10, recuperar 5, reenviar 5, pagos `/pagar` 8/5min, `/estado` 90, webhook 60/min, contacto 5, newsletter 5, devoluciones POST 10, admin 60/30, vendedor solicitud 10, reportes 60. Respuesta 429 `{ ok:false, msg: "Demasiados intentos. Intenta de nuevo más tarde" }`.
- El limiter se desactiva con `NODE_ENV=test` o `DISABLE_RATE_LIMIT=true` (CI lo usa). En dev, `docker restart jadda_backend` limpia los contadores (memoria).

## Passwords, OTP y enumeración

- Contraseñas siempre **bcrypt** (rounds 10). Mensajes genéricos anti-enumeración: login con contraseña errónea → 401 "Correo o contraseña incorrectos" (nunca revela si el correo existe); `reenviar-codigo` responde 404 SIN enviar cuando el correo no existe pero siempre con la misma forma de respuesta para no sondear.
- Verificación de correo: código de 6 dígitos (USUARIOS.TOKEN, vigencia 15 min, límite de intentos INTENTOS_CODIGO/VENTANA_CODIGO). Cambio de contraseña/email exige el código o el password actual (`/api/auth/verificar-password`).
- Vendedores nuevos nacen con `DEBE_CAMBIAR_PASSWORD=1` → el frontend fuerza el cambio antes de usar la cuenta.

## Archivos privados y subidas

- `/images/usuarios` y `/images/devoluciones` NO son static público: `servirArchivoPrivado()` en server.js autoriza por recurso (dueño/vendedor/admin) consultando DEVOLUCIONES…; **403 antes que 404**, con anti-path-traversal (`%2e%2e` + `decodeURIComponent`).
- `/images/productos` y `/images/perfiles` son públicos.
- Subidas (multer): whitelist de MIME + extensión y **validación de magic bytes reales** (`utils/formatoImagen.js`); límites 25 MB × 5 evidencias, 6 MB producto. Destino Cloudinary (`utils/carpetaSegura`: `jadda/productos|perfiles|retos|devoluciones/…`), fallback local a `frontend/public/images` (montado en el contenedor).
- Nombres de archivo/carpetas con clave de usuario saneada (`[a-z0-9._-]`, utils/carpetaUsuario.js).

## Secretos

- `backend/.env` gitignored con TODAS las credenciales (SESSION_SECRET, DB_PASSWORD, ADMIN_EMAIL/ADMIN_PASSWORD, SMTP, Google/Facebook, `CLOUDINARY_URL`, Wompi `WOMPI_*`). `backend/.env.example` solo con placeholders — nunca valores reales.
- Producción: fail-fast si faltan `SESSION_SECRET`/`DB_PASSWORD`; sin admin con credenciales default; `validarPasarelaProduccion()` exige llaves de producción real (no sandbox) si `NODE_ENV=production` y llaves de test.
- El `.env` raíz solo lleva la interpolación del compose (MYSQL_ROOT_PASSWORD, DB_PASSWORD, GLOBAL_RATELIMIT_*).

## Datos personales y pagos

- Logs (`registroPeticiones`): sin IP, query ni cuerpo (solo ruta truncada, status, ms y `X-Request-Id` correlacionable).
- Wompi webhook: valida checksum SHA256 timing-safe; NUNCA se confía en el número/monto del payload — se re-obtiene la transacción por API con la llave privada. Guard idempotente por `ESTADO='PENDIENTE_PAGO'`.
- Escapes de texto del usuario hacia SweetAlert2/html con `frontend/src/utils/escapeHtml.ts` (XSS almacenado); censura de chats `utils/groserias.js`.
- Facturas PDF: datos del pedido propios (dueño) o admin; no exponen PII de terceros.

## Checklist para un cambio "seguro" en este repo

1. Guard de sesión/rol correcto en la ROUTE (no confíes en que el controlador valide).
2. Validación de pertenencia (ownership) y estado en el controlador; 404 (no 500) cuando no exista.
3. Rate limit en acciones sensibles; nunca silenciar 429 en el frontend (mostrar el msg).
4. Antes de declarar listo: corre `node --check` + suites (ver `jadda-testing`) y `verification-before-completion`.
