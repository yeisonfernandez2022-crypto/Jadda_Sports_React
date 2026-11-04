# Entregable S04 — Procedimiento de Despliegue (Plan de Instalación v1)

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — e-commerce de artículos deportivos (React SPA + Express + MySQL) |
| Equipo | Yeison Fernández |
| Versión del plan | v1 |
| Versión del software cubierta | 1.0.0 |
| Fecha | 2026-11-04 |

---

## 5.1 Proceso de liberación

| Paso | Comando o acción | Resultado esperado |
|---|---|---|
| Pruebas en verde | CI de GitHub Actions (`ci.yml`: backend vitest 160 tests + integración 22 con MySQL real, frontend vitest 65 + `tsc -b`) | Todos los checks pasan |
| Etiqueta | `git tag -a v1.0.0 -m "JADDA SPORTS 1.0.0"` + `git push origin v1.0.0` | Etiqueta visible en GitHub |
| Imagen | `docker compose --env-file .env -f deploy/compose.prod.yaml build` (se construye EN el servidor; no hay registry) | Imágenes `proyectojaddasports-backend` / `-frontend` reconstruidas |
| Despliegue | `docker compose --env-file .env -f deploy/compose.prod.yaml up -d` | 4 contenedores healthy |
| Verificación | `bash scripts/smoke-test.sh https://localhost` (Linux) | `6 OK / 0 FAIL` |

Esquema de versiones y criterio SemVer del proyecto: SemVer `MAJOR.MINOR.PATCH` — la v1.0.0 marca la primera versión desplegada a producción (WSL + nube). Cambios de esquema de BD (migraciones idempotentes aditivas) no incrementan MAJOR mientras no rompan compatibilidad; romper la API o el esquema sí lo haría.

Enlace al `CHANGELOG.md`: [`CHANGELOG.md`](../../CHANGELOG.md)

## 5.2 Despliegue en servidor Linux

Entorno real de la evidencia: **WSL2 Ubuntu sobre Windows 11** (equivale a un servidor Linux dedicado; en un VPS los comandos son idénticos).

### Estructura

```
/opt/jadda-sports/
├── .env                        # secretos (fuera de git; MYSQL_ROOT_PASSWORD, DB_PASSWORD, SESSION_SECRET…)
├── backend/                    # API Express (CommonJS) + Dockerfile.prod
├── frontend/                   # SPA React/Vite + Dockerfile.prod + nginx.spa.conf.template
├── deploy/
│   ├── compose.prod.yaml       # 4 servicios: mysql, migrate, backend, frontend, nginx (borde TLS)
│   └── nginx.conf              # nginx de borde: 80→443, TLS self-signed, proxy a frontend
├── scripts/
│   ├── verificar-requisitos.sh # 22 checks de prerequisitos
│   ├── respaldar.sh            # mysqldump dentro del contenedor + sha256
│   └── smoke-test.sh           # prueba de humo (6 checks)
└── docs/                       # manuales, RFs, entregables
```

### Variables de entorno

Se declaran en `.env` de la raíz (leído por `--env-file`); el backend las recibe vía `environment:` del compose. `.env.example` documenta placeholders.

| Variable | Propósito | Ejemplo (ficticio) |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` / `DB_PASSWORD` | Credenciales de MySQL (deben ser idénticas) | `**********` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_NAME` | Conexión de la API a la BD | `mysql` / `3306` / `root` / `jadda_sports_db` |
| `DB_SSL_CA` | Certificado CA en PEM (una línea con `\n`) para TLS con la BD en nube | `-----BEGIN CERTIFICATE-----\n…` |
| `SESSION_SECRET` | Firma HMAC de la cookie de sesión (`connect.sid`) | `**********` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Cuenta admin que `setup.js` siembra en cada arranque (obligatorias en prod) | `admin@demo.local` / `**********` |
| `CORS_ORIGINS` | Orígenes extra admitidos (coma-separada); vacío = solo same-origin | `https://miotro-dominio.com` |
| `FRONTEND_URL` | URL pública del SPA para links de correos (factura, OTP, newsletter) | `https://jadda-frontend.onrender.com` |
| `PAYMENT_GATEWAY` / `WOMPI_*` | Pasarela Wompi (sandbox: `pub_test_…`) | `wompi` / `pub_test_xxx` |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP para correos transaccionales | `tienda@…` / `**********` |
| `CLOUDINARY_URL` | Almacenamiento de medios (imágenes/videos) | `cloudinary://key:secret@cloud` |
| `PORT` / `BACKEND_ORIGEN` / `DNS_RESOLVER` | nginx interno de la SPA (puerto de escucha, upstream del API, resolver DNS) — con defaults en `Dockerfile.prod` | `80` / `http://backend:5000` / `127.0.0.11` |

### Instalación inicial

| # | Acción | Comando | Resultado esperado |
|---|---|---|---|
| 1 | Verificar requisitos | `bash scripts/verificar-requisitos.sh` | Código de salida 0 (22 checks OK) |
| 2 | Clonar el repo | `sudo git clone https://github.com/…/Jadda_Sports_React.git /opt/jadda-sports` | Directorio creado |
| 3 | Crear `.env` | copiar de `.env.example` y llenar secretos (MYSQL_ROOT_PASSWORD = DB_PASSWORD) | `.env` presente (gitignoreado) |
| 4 | Levantar la pila | `docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build` | `mysql_prod` healthy → `migrate` exit 0 → `backend_prod` healthy → `frontend_prod` healthy → `web_prod` up |
| 5 | Verificar | `bash scripts/smoke-test.sh https://localhost` | `6 OK / 0 FAIL` |

Siempre invocar compose con `--env-file .env -f deploy/compose.prod.yaml` desde la raíz (sin `--project-directory .`, que rompe las rutas relativas de los Dockerfiles).

### Actualización

| # | Acción | Comando | Resultado esperado |
|---|---|---|---|
| 1 | Respaldo previo | `bash scripts/respaldar.sh` | `backups/mysql/<fecha>_jadda_sports_db.sql` + sha256 |
| 2 | Traer el código | `git pull --ff-only` | HEAD en el commit/tag nuevo |
| 3 | Reconstruir y relanzar | `docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build` | Contenedores recreados con la imagen nueva |
| 4 | Si se recreó el frontend | `docker compose --env-file .env -f deploy/compose.prod.yaml restart nginx` | El borde re-resuelve la IP del frontend (la cachea al arrancar) |
| 5 | Verificar | `bash scripts/smoke-test.sh https://localhost` | `6 OK / 0 FAIL` |

### Rollback

| # | Acción | Comando | Resultado esperado |
|---|---|---|---|
| 1 | Volver al código bueno | `git checkout v1.0.0` (o el tag/commit anterior) | HEAD en la versión previa |
| 2 | Reconstruir | `docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build` | Imágenes de la versión anterior |
| 3 | Si la BD quedó inconsistente | restaurar el dump del paso 1 de "Actualización" con `scripts/restaurar-backup.ps1` (o `mysql < dump`) | BD en el estado previo |
| 4 | Verificar | `bash scripts/smoke-test.sh https://localhost` | `6 OK / 0 FAIL` |

Clasificación de migraciones (¿permiten rollback sin restaurar?):

| Migración | Cambio | ¿Compatible hacia atrás? |
|---|---|---|
| `ENVIOS.COSTO_ENVIO`, `DESCUENTOS.USADO`, `RETO_EVIDENCIAS`, `NOTIFICACIONES`, `AVISOS_STOCK`, `DEVOLUCIONES`, `PAGOS_EVENTOS` | Tablas/columnas nuevas | Sí — código viejo las ignora |
| `VENTAS.FECHA_EXPIRA_PAGO`, `VENTAS.CANCELADA_POR`, `RETO_EVIDENCIAS.OBSERVACION`, `USUARIOS.EMAIL_PENDIENTE`, `CHAT.PARTE`, `PRODUCTOS.ID_VENDEDOR`/`ESTADO_PUBLICACION` | Columnas nuevas (NULL o default) | Sí — `NULL` = comportamiento legacy |
| `USUARIOS.TOKEN VARCHAR(6)→VARCHAR(255)` | Ensanchamiento (OTP hasheado) | Sí — solo crece |
| Índice único `uq_categoria_nombre` | Restricción | Sí — no afecta lecturas |

Todas las migraciones de `setup.js` son **aditivas e idempotentes** (verifican `INFORMATION_SCHEMA` antes de aplicar): hasta la v1.0.0 no existe ninguna destructiva, por lo que el rollback de código NO exige restaurar la BD.

### Evidencia

```
── smoke-test https://localhost ──
  [OK] SPA responde 200
  [OK] servida: index con <div id=root> montado
  [OK] /api/productos 200
  [OK] respuesta del API con productos ([] , formato del endpoint)
  [OK] /api/productos/categorias 200
  [OK] login rechaza credenciales erradas (HTTP 401)
── smoke-test terminó: 6 OK / 0 FAIL ──
```

Prueba adicional de resiliencia (valida el proxy con variable del nginx interno — fallo real de Render reproducido y corregido el 2026-11-04): con el backend detenido, `docker compose restart frontend` mantiene el nginx del SPA ARRIBA (healthcheck `healthy`, SPA 200) y `/api` responde 502 en vez de tumbar el contenedor; al volver el backend, `/api` responde 200 sin reiniciar el frontend.

## 5.3 Despliegue en la nube

| Componente | Proveedor y plan | Región | Configuración |
|---|---|---|---|
| App (SPA + API) | Render — Free (2 web services) | Oregon (default del plan) | Blueprint `render.yaml` en la raíz del repo |
| Base de datos | Aiven for MySQL — Free | Región asignada por Aiven | TLS obligatorio (`VERIFY_IDENTITY` con CA descargada) |

URL pública: https://jadda-frontend.onrender.com (SPA) · https://jadda-backend.onrender.com (API, `/health`)

Procedimiento (pasos numerados):

1. **Base de datos**: crear servicio MySQL Free en Aiven → copiar host, puerto (`20013`), usuario `avnadmin`, contraseña y descargar el certificado CA (`ca.pem`). Crear la BD `jadda_sports_db` (utf8mb4).
2. **Blueprint**: push del repo a GitHub → Render → *New → Blueprint* → detecta `render.yaml` → crea `jadda-backend` y `jadda-frontend`.
3. **Secretos**: en cada servicio, completar las `envVars` marcadas `sync: false` (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME, `DB_SSL_CA` en una línea con `\n`, ADMIN_EMAIL/ADMIN_PASSWORD, SESSION_SECRET, EMAIL_*, CLOUDINARY_URL, WOMPI_*). `SESSION_SECRET` puede generarlo Render.
4. **Deploy automático**: cada push a `main` dispara build+deploy de ambos servicios. Verificar `GET /health` del backend (200) y la SPA.
5. **Webhook de pagos** (opcional): en la consola de Wompi apuntar el webhook del sandbox a `https://jadda-backend.onrender.com/api/pagos/webhook`.

Método de rollback en el PaaS: Render conserva el historial de deploys — pestaña *Deploys* → botón **Rollback** sobre cualquier deploy exitoso anterior (un click, sin rebuild). La BD no se toca (migraciones idempotentes aditivas, ver §5.2).

Límites del plan gratuito que afectan al cliente (con fuente y fecha):

- **Render Free**: 512 MB RAM por servicio; el servicio **duerme tras 15 min de inactividad** y la primera petición tarda ~1 min en despertarlo; 750 h/mes de instancias free compartidas entre servicios (fuente: render.com/docs/free, consultado 2026-11-03).
- **Aiven MySQL Free**: 1 vCPU / 1 GB RAM / 1 GB de almacenamiento; `max_connections = 76`; sin respaldos automáticos con retención larga ni escalado (fuente: aiven.io/prices, consultado 2026-11-03).
- **OAuth Google/Facebook desactivado en la nube**: sin dominio propio no hay callback registrado; el login por correo/contraseña y la verificación OTP funcionan completos (pendiente externo E-x, ver §5.4 del plan de implantación).

### Evidencia

Salida del backend directo y del smoke contra la URL pública (2026-11-04):

```
$ curl https://jadda-backend.onrender.com/health
{"ok":true,"estado":"disponible"}          # HTTP 200

$ curl https://jadda-backend.onrender.com/api/productos
HTTP 200 (63.973 bytes de JSON)

── smoke-test https://jadda-frontend.onrender.com ──
  [OK] SPA responde 200
  [OK] servida: index con <div id=root> montado
  [OK] /api/productos 200
  [OK] respuesta del API con productos ([] , formato del endpoint)
  [OK] /api/productos/categorias 200
  [OK] login rechaza credenciales erradas (HTTP 401)
── smoke-test terminó: 6 OK / 0 FAIL ──
```

Dos fallos reales corregidos durante el despliegue (documentados en
`docs/implantacion/04-despliegue-produccion.md` §3.1):

1. **`nginx: [emerg] host not found in upstream "jadda-backend"`** — el nginx
   interno resolvía el upstream al ARRANCAR y Render aún no tenía el backend →
   el contenedor moría. Fix: `proxy_pass` con **variable** + `resolver`
   (resolución en runtime; con el backend caído el SPA vive y `/api` da 502).
2. **HTTP 508 Loop Detected** — con `proxy_set_header Host $host` el edge de
   Render recibía `Host: jadda-frontend.onrender.com` en una petición dirigida
   al backend y la devolvía al propio frontend (Render enruta por Host). Fix:
   NO fijar `Host` (nginx manda el del upstream) y conservar el host original
   en `X-Forwarded-Host`, que es la cabecera que usa la defensa CSRF del
   backend — el login del smoke (401 con credenciales erradas, no 403) prueba
   que el CSRF pasa por toda la cadena.

## 5.4 Estimación de costos

| Concepto | Alternativa 1: nube gratuita (Render Free + Aiven Free) | Alternativa 2: nube pagada (Render Starter ×2 + Aiven Developer) |
|---|---|---|
| Total mensual | **$0 USD** | ≈ **$19 USD** (Render $7/mes × 2 servicios + Aiven $5/mes) |
| Total anual | $0 | ≈ $228 USD |
| Horas de administración al mes | ~2 h (deploy automático por push; solo vigilar el dashboard) | ~2 h (igual + rotación de secretos recomendada) |
| Fuente y fecha | render.com/docs/free · aiven.io/prices (consultado 2026-11-03) | ídem |

Recomendación al cliente: para demostración y uso académico la **alternativa gratuita es suficiente** — el costo es cero y el único inconveniente visible es que la app duerme tras 15 minutos de inactividad (la primera visita tarda ~1 minuto en despertar). Para un negocio real con tráfico continuo, la alternativa pagada elimina el sleep, añade respaldos automáticos de BD y sube los límites de conexiones; el dominio propio (~$15 USD/año, ver entregable S03) se compra aparte a nombre del cliente.
