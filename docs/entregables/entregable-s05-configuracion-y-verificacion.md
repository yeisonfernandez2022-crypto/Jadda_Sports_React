# Entregable S05 — Configuración, Verificación y Migración Ejecutada

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — e-commerce de artículos deportivos (React SPA + Express + MySQL/TiDB Cloud) |
| Equipo | Yeison Fernández |
| Versión del software | 1.0.0 |
| Fecha | 2026-11-11 |

---

## 6.1 Inventario de configuración

Los secretos **nunca van a git**. Dónde vive cada valor:

- **Desarrollo**: `.env` de la **raíz** (`MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` y el bloque `TIDB_*` que interpola `docker-compose.yml`) + `backend/.env` (gitignoreado: secretos de app — sesión, admin, pasarela, correo, medios, OAuth).
- **Servidor (Linux/compose)**: `.env` de la raíz (permisos 600) creado desde `deploy/env.prod.example`; `backend/.env` es **opcional** (integraciones auxiliares; sin él la app arranca igual).
- **Nube (Render)**: Dashboard del servicio — las variables marcadas `sync: false` en `render.yaml` se llenan a mano la primera vez; `SESSION_SECRET` la genera Render (`generateValue: true`). Jamás en el repo.

| Variable | ¿Secreto? | Desarrollo | Servidor | Nube | Si falta… |
|---|:---:|---|---|---|---|
| `DB_HOST` / `DB_PORT` | No | `${TIDB_HOST}` / `${TIDB_PORT:-4000}` del `.env` raíz → TiDB Cloud (`gateway01.us-west-2…tidbcloud.com:4000`); rollback local a `database:3306` comentado en compose | Fijo `database:3306` en `compose.prod.yaml` | Panel de Render (`sync:false`) | El pool reintenta en bucle con logs claros (sin default engañoso) |
| `DB_USER` / `DB_PASSWORD` | Sí | `.env` raíz (`TIDB_USER`/`TIDB_PASSWORD`; persistidas el 2026-11-11 tras perderse en una recreación del contenedor) | `.env` (600): `jadda_migrator` (DDL) y `jadda_app` (DML) de `scripts/sql/usuarios-produccion.sql` | Panel de Render | Fail-fast: `ER_ACCESS_DENIED` → `process.exit(1)` con mensaje de credenciales |
| `DB_NAME` | No | `jadda_sports_db` | `jadda_sports_db` | `jadda_sports_db` | Error de arranque del pool |
| `DB_SSL` / `DB_SSL_CA` | Sí | `DB_SSL=true` (TiDB cifra sin CA propia: la CA de TiDB no vive en el almacén de Node) | No aplica (BD en la misma red) | `DB_SSL=true` fijo en `render.yaml` | TiDB rechaza: «Connections using insecure transport are prohibited» |
| `SESSION_SECRET` | Sí | `backend/.env` | `.env` (600) | `generateValue: true` (Render) | Prod: fail-fast «SESSION_SECRET requerido»; dev: cookie sin firma |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Sí | `backend/.env` | `.env` (600; sin defaults en prod) | Panel (`sync:false`) | Prod: el seed de admin aborta; dev: no se siembra el admin |
| `MYSQL_ROOT_PASSWORD` | Sí | `.env` raíz | `.env` (600) | n/a (BD gestionada) | `${VAR:?}`: compose falla en seco antes de levantar nada |
| `MIGRATE_DB_PASSWORD` | Sí | n/a | `.env` (600) | n/a | `${VAR:?}`: compose falla en seco |
| `RUN_MIGRATIONS_ON_BOOT` | No | n/a (el DDL corre siempre con `setup.js`) | n/a (sidecar `migrate`) | `true` (render.yaml; PaaS sin sidecar) | En PaaS la DDL no se aplicaría al arrancar |
| `TRUST_PROXY` / `CORS_ORIGINS` / `GLOBAL_RATELIMIT_MAX` | No | defaults 0 / vacío / 300 | defaults 2 / vacío / 300 | `TRUST_PROXY=2` fijo en render.yaml | En nube sin 2, todo el tráfico del SPA compartiría un solo cubo del rate limiter |
| `PAYMENT_GATEWAY` + `WOMPI_*` (4 llaves) | Sí | `backend/.env` (sandbox `pub_test_…`) | `backend/.env` opcional | Panel (`sync:false`) | Ventas nacen `COMPLETADA` (simulación interna) en vez de `PENDIENTE_PAGO` |
| `BREVO_API_KEY` / `EMAIL_USER` / `EMAIL_PASS` | Sí | `backend/.env` | `backend/.env` opcional | Panel (Render Free bloquea SMTP; la nube envía por API Brevo) | Correos omitidos (best-effort; nunca bloquean la compra) |
| `CLOUDINARY_URL` | Sí | `backend/.env` | `backend/.env` opcional | Panel | Fallback a disco (`uploads/`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Sí | `backend/.env` (callback localhost) | opcional | Panel (callback fijo `https://jadda-frontend.onrender.com/api/auth/google/callback` en render.yaml) | Login social apagado (queda correo/contraseña + OTP) |
| `FRONTEND_URL` | No | default `http://localhost:5173` | opcional | Fijo `https://jadda-frontend.onrender.com` | Links de correos apuntarían a localhost (no bloquea) |
| `NODE_ENV` / `DEMO_DATA` | No | dev con demo activo | `production` / `false` | `production` / `false` | En prod sembraría cuentas/ventas de demostración |
| `DB_PING_SEGUNDOS` / `PAGOS_EXPIRA_MINUTOS` / `DB_BOOT_*` | No | defaults 60 / 10 / 5 ciclos × 30 s | opcionales | defaults | Sin keepalive la BD serverless hiberna; la ventana de pago sería la default (10 min) |

## 6.2 Servicios

### Servidor (Linux — `deploy/compose.prod.yaml`, 5 servicios)

| Servicio | Imagen / versión | Depende de | Política de reinicio | Healthcheck | Rotación de logs |
|---|---|---|---|---|---|
| `database` (`jadda_mysql_prod`) | `mysql:8.0` | — | `always` | `mysqladmin ping` (5 s / 30 reintentos / start 30 s) | Sin rotación explícita (json-file de Docker) |
| `migrate` (`jadda_migrate_prod`) | build `backend/Dockerfile.prod` (v1.0.0) | `database` (healthy) | `no` — proceso corto `node database/migrate.js` | — (una corrida) | ídem |
| `backend` (`jadda_backend_prod`) | build `backend/Dockerfile.prod` (v1.0.0) | `database` healthy + `migrate` completado OK | `unless-stopped` | `node fetch /health` (30 s / 3 / start 40 s) | ídem |
| `frontend` (`jadda_frontend_prod`) | build multi-stage `frontend/Dockerfile.prod` (dist Vite + nginx interno) | `backend` (healthy) | `unless-stopped` | `wget http://127.0.0.1:80/` (30 s / 3 / start 20 s) | ídem |
| `nginx` (`jadda_web_prod`) | `nginx:alpine` | `frontend` + `backend` healthy | `unless-stopped` | — (sin healthcheck propio: busybox wget no maneja con fiabilidad el 308→HTTPS; decisión documentada en S04) | ídem |

> **Nota honesta**: no se configuró rotación explícita de logs (los contenedores usan el driver `json-file` por defecto de Docker, sin límite de tamaño). Mejora pendiente (`max-size`/`max-file` o driver dedicado). En la nube, Render gestiona los logs con su propia retención.

### Nube (Render — blueprint `render.yaml`, 2 web services Docker + BD externa)

| Servicio | Imagen / versión | Depende de | Política de reinicio | Healthcheck | Rotación de logs |
|---|---|---|---|---|---|
| `jadda-backend` | runtime docker (`backend/Dockerfile.prod`, plan free, oregon) | TiDB Cloud Starter (servicio externo) | Redeploy automático por push a `main`; Render reinicia si `/health` deja de responder 200 | `healthCheckPath: /health` | Gestionada por Render |
| `jadda-frontend` | runtime docker (`frontend/Dockerfile.prod`, plan free, oregon; nginx interno proxea `/api` y `/images` al backend con `proxy_pass` por variable + resolver) | `jadda-backend` | Redeploy automático por push | `healthCheckPath: /` | Gestionada por Render |
| TiDB Cloud Starter | servicio gestionado (serverless) | — | Hibernación por inactividad con resurrección en segundos; keepalive `DB_PING_SEGUNDOS=60` desde el backend | Sonda del backend (`/api/health`) | Gestionada por TiDB |

El webhook de Wompi apunta a la URL **pública** del backend (`https://jadda-backend.onrender.com/api/pagos/webhook`) — server-to-server, sin cookies.

### Desarrollo (`docker-compose.yml`, 3 contenedores)

| Servicio | Imagen / versión | Depende de | Política de reinicio | Healthcheck | Rotación de logs |
|---|---|---|---|---|---|
| `database` (`jadda_mysql`) | `mysql:8.0` | — | `always` | `mysqladmin ping` (5 s / 30 / start 30 s) | json-file default |
| `backend` (`jadda_backend`) | build `./backend`; `pnpm install && pnpm dev` (bind-mount) | — (tolera BD tardía reintentando el boot) | `unless-stopped` | `node fetch /health` (30 s / 3 / start 40 s) | json-file default |
| `frontend` (`jadda_frontend`) | build `./frontend`; dev o preview según `MODE` | `backend` (healthy) | default (`no`) | — | json-file default |

## 6.3 Endpoint de salud

| Campo | `/health` (liveness) | `/api/health` (readiness) |
|---|---|---|
| Ruta | `GET /health` | `GET /api/health` |
| Dependencias que verifica | **Ninguna** — respuesta síncrona del proceso (montada antes del logger/CORS; no toca BD ni sesión; pública — no filtra info de arquitectura) | La BD: `SELECT 1` sobre el pool MySQL |
| Respuesta si está sano | `200 {"ok":true,"estado":"disponible","hora":"…"}` | `200 {"ok":true,"estado":"disponible","bd":"ok","hora":"…"}` |
| Respuesta si falla una dependencia | No cambia (200 mientras el proceso viva) — la BD se vigila con `/api/health` y con el healthcheck del contenedor de BD | `503 {"ok":false,"estado":"degradado","bd":"no disponible","hora":"…"}` |
| Quién la consume | Healthcheck de compose (`node fetch /health`), `healthCheckPath` de Render, monitor externo opcional (UptimeRobot) | Sondeos manuales y de verificación post-despliegue |

Salidas reales (2026-11-11):

```
# Nube (Render + TiDB Cloud)
$ curl https://jadda-backend.onrender.com/health
{"ok":true,"estado":"disponible","hora":"2026-11-11T19:00:40.031Z"}

$ curl https://jadda-backend.onrender.com/api/health
{"ok":true,"estado":"disponible","bd":"ok","hora":"2026-11-11T19:00:40.322Z"}

# Desarrollo (dev restaurado sobre TiDB el mismo día)
$ curl http://localhost:5000/api/health
{"ok":true,"estado":"disponible","bd":"ok","hora":"2026-11-11T18:56:35.090Z"}
```

## 6.4 Pruebas

### Prueba de humo

Comando: `bash scripts/smoke-test.sh <URL_SPA> [URL_BACKEND]` — solo depende de `curl` y `grep`; no toca datos ni necesita credenciales.

Verificaciones incluidas:

| # | Verificación | Resultado esperado |
|---|---|---|
| 1 | `GET /` del SPA | 200 |
| 2 | El index sirve `<div id="root">` montado | ≥1 coincidencia |
| 3 | `GET /api/productos` (vía proxy del SPA) | 200 |
| 4 | La respuesta trae productos (campo `NOMBRE`) | ≥1 coincidencia |
| 5 | `GET /api/productos/categorias` | 200 |
| 6 | `POST /api/auth/login` con credenciales erradas | 400/401 (rechaza) |
| 7 | `GET /health` del backend (con `BACKEND_URL` separado) | 200 |

Salida contra el servidor (dev local restaurado sobre TiDB, 2026-11-11):

```
── smoke-test http://localhost:5173 ──
  [OK] SPA responde 200
  [OK] servida: index con <div id=root> montado
  [OK] /api/productos 200
  [OK] respuesta del API con productos ([] , formato del endpoint)
  [OK] /api/productos/categorias 200
  [OK] login rechaza credenciales erradas (HTTP 401)
  [OK] backend /health 200
── smoke-test terminó: 7 OK / 0 FAIL ──
```

Salida contra la nube (2026-11-11):

```
── smoke-test https://jadda-frontend.onrender.com ──
  [OK] SPA responde 200
  [OK] servida: index con <div id=root> montado
  [OK] /api/productos 200
  [OK] respuesta del API con productos ([] , formato del endpoint)
  [OK] /api/productos/categorias 200
  [OK] login rechaza credenciales erradas (HTTP 401)
  [OK] backend /health 200
── smoke-test terminó: 7 OK / 0 FAIL ──
```

Referencia de las suites del repo (última corrida documentada 2026-11-09): backend vitest **208/208** (23 archivos) · integración **22/22** con MySQL real (puerto 3307) · frontend vitest **65/65** · `tsc -b` exit 0.

### Casos funcionales

| ID | Caso | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| F-01 | Login correcto con sesión | `POST /api/auth/login` con credenciales reales → `GET /api/auth/perfil` con la cookie | 200 + cookie `connect.sid`; perfil 200 | OK (sondas diarias del proyecto; smoke F-06 cubre el caso negativo) |
| F-02 | Login errado + rate limit | credenciales falsas repetidas | 401 genérico (anti-enumeración); 429 tras 10/15 min | OK — 429 demostrado en vivo en las mediciones RNF (2026-10-21) |
| F-03 | Registro + verificación OTP | registro → código de 6 dígitos al correo → confirmar → login | 200 en cada paso; OTP guardado hasheado (`TOKEN` VARCHAR 255) | OK (E2E de verificación 11/11, 2026-10-21) |
| F-04 | Checkout con cupón | carrito → aplicar cupón → `POST /api/checkout/procesar` | Total recalculado 100 % en servidor; cupones `RETO-` personales y de un solo uso (`USADO=1`) | OK (sonda cupón personal 30/30, 2026-10-31; concurrencia checkout 16/16) |
| F-05 | Pago Wompi sandbox | checkout → `PENDIENTE_PAGO` → pagar en `checkout.wompi.co` con tarjeta de prueba | `APPROVED` → venta `CONFIRMADA` + correos/factura + stock decrementado | OK (sonda E2E 25/25 en contenedor + UI, 2026-10-24; Nequi sandbox 2026-10-27) |
| F-06 | Webhook de Wompi | `POST /api/pagos/webhook` con firma válida / inválida | Válido: confirma idempotente (`PAGOS_EVENTOS` con UNIQUE). Inválido: 403 + fila `FIRMA_INVALIDA` | OK (11 tests de `pagos.test.js` + sonda E2E, 2026-10-24) |
| F-07 | OAuth Google en nube | popup → consentimiento → callback al origen del SPA | Sesión creada; 403 si el `state` no coincide | OK (callback movido al origen del SPA y verificado en prod, 2026-11-07) |
| F-08 | Factura PDF | `GET /api/compras/:id/factura` con sesión del dueño | 200 (`%PDF`); 403 sin sesión o ajeno | OK (RF-021, evidencia 2026-08-06) |
| F-09 | Expiración de pago | venta `PENDIENTE_PAGO` sin pagar > 10 min | `CANCELADA` automática + stock reingresado + notificación | OK (sonda de expiración 13/13, 2026-10-26) |
| F-10 | Restauración de configuración del entorno | recrear el backend con las `TIDB_*` persistidas en el `.env` raíz | `/health` 200 y `/api/health` con `bd:"ok"`; smoke 7/7 | OK (2026-11-11: healthy en ~72 s, humo 7 OK / 0 FAIL, ver §6.3 y §6.4) |

## 6.5 Lista de verificación posterior al despliegue

- [x] `GET /health` → 200 y healthcheck del contenedor `healthy` (liveness)
- [x] `GET /api/health` → `bd:"ok"` (readiness)
- [x] `bash scripts/smoke-test.sh` → **7 OK / 0 FAIL** contra el servidor y contra la nube
- [x] DDL/migraciones aplicadas (sidecar `migrate` en servidor; `RUN_MIGRATIONS_ON_BOOT=true` en nube; `setup.js` idempotente en dev)
- [x] Admin sembrado con credenciales propias (`ADMIN_EMAIL`/`ADMIN_PASSWORD`; sin defaults en producción)
- [x] `SESSION_SECRET` definido (fail-fast en producción)
- [x] Cookies `connect.sid` Secure + SameSite=Lax por HTTPS de punta a punta
- [x] TLS con la BD activo (TiDB lo obliga; el store de sesiones usa su pool propio TLS-capable)
- [x] Rate limits activos (techo global 300/min; login 10/15 min; checkout 5/15 min; 429 verificado en vivo)
- [x] CORS/CSRF por Origin (403 con Origin ajeno; el 401 del login errado en el smoke prueba el paso de la cadena)
- [x] Webhook de Wompi apuntando a `https://jadda-backend.onrender.com/api/pagos/webhook` (server-to-server)
- [x] Ventana de expiración de pagos activa (`PAGOS_EXPIRA_MINUTOS=10`) + keepalive de BD (`DB_PING_SEGUNDOS=60`)
- [x] Respaldo de BD disponible (dump del corte de 300,794 B + `scripts/backup.ps1` con retención 7 días en servidor)
- [ ] Rotación de logs de Docker configurada (`max-size`/`max-file`) — pendiente de mejora (hoy json-file sin límite)

---

## 2.8 Evidencia de migración ejecutada (se agrega a la sección 2)

| Campo | Valor |
|---|---|
| Origen (tipo y versión) | MySQL 8.0.46 local (contenedor `jadda_mysql`, volumen `mysql_data`) |
| Destino (proveedor, versión, región) | TiDB Cloud Starter (MySQL 5.7-compatible) — región us-west-2 (AWS Oregon), puerto 4000, TLS forzado |
| Diferencias resueltas (dueño, versión, SSL…) | **SSL obligatorio** → 2 bugs de código corregidos (el store de sesiones `express-mysql-session` descarta el `ssl` de su whitelist y se le pasa un pool propio como 2º argumento; el `createConnection` del migrador recibía la config campo a campo y perdía el `ssl` — fix con spread condicional). Puerto no estándar 4000. Sin triggers/procedures en el esquema (0 en origen → compatible 1:1). Dueño: en origen `root` local; en destino la cuenta única admin del plan Starter (usuario `*.root`) — sin usuarios de menor privilegio (limitación del plan). Cifrado sin CA propia (`rejectUnauthorized=false`). |

Registro de la ventana (2026-11-08):

| Paso | Hora inicio | Hora fin | Resultado |
|---|---|---|---|
| Dump del origen (`mysqldump --single-transaction --skip-lock-tables --skip-add-locks --no-tablespaces`) | — * | — * | Dump de 300,794 B con línea «Dump completed» |
| Importe en TiDB (cliente `mysql:8.0.46` efímero, `--ssl-mode=REQUIRED`) | — * | — * | 0 errores de importe |
| Verificación de huellas (12 tablas) | — * | — * | Origen == destino (12/12) |
| Corte en Render (Environment del servicio) | — * | — * | Boot verde: «Base de datos MySQL 'jadda_sports_db' conectada (pool OK, intento 2)» |
| Iteración de fixes TLS sobre el sistema en vivo | ~16:38 UTC | ~16:47 UTC | Commits `06d7718` (migrador) y `81ef0d7` (store) aplicados y verificados |

\* La ventana no se cronometró paso a paso; las únicas marcas de reloj documentadas son las de las iteraciones de los fixes (bitácora de la sesión del 2026-11-08). Verificación por lectores independientes en todo el proceso: huellas origen vs destino y API en producción leyendo TiDB en vivo.

Huellas:

```
-- Origen (MySQL 8.0.46 local) == Destino (TiDB Cloud Starter) → 12/12 idénticas
PRODUCTOS 109 · USUARIOS 11 · CATEGORIAS 15 · PRODUCTO_VARIANTES 620
PRODUCTO_IMAGENES 313 · VENTAS 45 · DESCUENTOS 9 · RETO_EVIDENCIAS 6
NOTIFICACIONES 642 · SESIONES 3 · FAVORITOS 3 · CHAT_MENSAJE 2
```

Prueba de humo después del corte:

```
Boot en Render (log del usuario):
  ✅ Base de datos MySQL 'jadda_sports_db' conectada (pool OK, intento 2)

Sondas post-corte (2026-11-08):
  14 × GET /api/productos   → 200 (payload 65.517 B, ms 343-1142, sin ventanas de error)
  GET /api/auth/perfil      → 401 anónimo en ~599 ms (el store de sesiones ya lee la
                              tabla `sessions` en TiDB con TLS — el camino que falló
                              durante el boot)
  /api/productos/categorias → 200, ~270 ms
  /api/productos/descuentos → 200, ~254 ms
  /api/vendedores           → 200, ~269 ms
```

¿Fue necesario el rollback? ¿Por qué?

**No.** El corte se completó el mismo día. Los dos fallos intermedios fueron del **código** (el pool del store de sesiones y la conexión del migrador nacían sin `ssl`, y TiDB los rechazaba con «insecure transport»), no del estado de los datos: se corrigieron con push y redeploy (`06d7718`, `81ef0d7`) sin tocar la BD. El camino de rollback quedó disponible pero no se ejecutó: el dump (300,794 B) y el volumen local `mysql_data` completo conservaban el estado pre-corte. Aiven (proveedor anterior) se mantuvo vivo hasta verificar el nuevo destino y quedó obsoleto por su fin de vida del 21-dic-2026, sin datos que rescatar.
