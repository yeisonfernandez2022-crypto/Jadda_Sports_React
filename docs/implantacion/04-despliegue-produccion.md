# Módulo A · Despliegue de producción (docker-compose.prod.yml)

> Estado: actualizado 2026-10-21. La topología de desarrollo
> (`docker-compose.yml`) queda intacta; este perfil es el que hay que usar para
> "lanzar a producción" en una máquina o LAN.

## 1. Qué cambia respecto al despliegue de desarrollo

| Riesgo (revisión) | En desarrollo (`docker-compose.yml`) | En producción (`docker-compose.prod.yml`) |
| --- | --- | --- |
| Código vivo montado (`./backend:/app`, `./frontend:/app`) | bind-mount, editable en caliente | **sin mounts de código** — imagen construida con `Dockerfile.prod` |
| Dependencias con `pnpm install` en cada arranque + `pnpm dev` (nodemon) | sí | **CMD directo** (`node server.js`) con deps baked; el frontend es **multi-stage** (build con node → runtime `nginx:alpine`, Fase 3) |
| Puertos 3306 (MySQL), 5000 (backend), 5173 (Vite) publicados en todas las interfaces | sí | **ninguno publicado** — solo nginx (80→443) |
| Código OTP (códigos a 15 min) | se guarda como hash bcrypt (60 chars, `USUARIOS.TOKEN VARCHAR(255)`) | igual |
| Datos de demostración | se insertan en cada arranque | **`DEMO_DATA=false` + `NODE_ENV=production`** → no se crean |
| Cookies de sesión | `secure:false` (HTTP) | `secure:true` (HTTPS terminado en nginx) |
| Secretos | `.env` con valores cómodos de dev | `.env`-raíz con `${VAR:?}` → el compose NO arranca sin: `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Admin semilla | `seedAdminUser` garantiza existencia (sin sobreescribir password, salvo `SEED_ADMIN_PASSWORD=true`) | requiere credenciales explícitas — el seed ya no tiene valores por defecto en el código |

## 2. Preparar la máquina

```bash
# 1) Clonar/actualizar y entrar en el proyecto
git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
cd Jadda_Sports_React

# 2) .env de la raíz CON los secretos obligatorios
cat > .env <<'EOF'
MYSQL_ROOT_PASSWORD=<password raiz proyectada>
DB_PASSWORD=<misma>
SESSION_SECRET=<64 hex>
ADMIN_EMAIL=<correo real del admin>
ADMIN_PASSWORD=<contraseña fuerte>
EOF

# Generar SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3) backend/.env (correo, Cloudinary, OAuth, FRONTEND_URL=https://<host>/,
#    y si habrá pasarela de pagos: PAYMENT_GATEWAY=wompi + WOMPI_* de PRODUCCIÓN
#    con WOMPI_EVENTS_SECRET apuntando a la URL de eventos https://<host>/api/pagos/webhook)
cp backend/.env.example backend/.env
#   → editar con el editor (el .env real no se versiona)

# 4) Certificados TLS (self-signed para LAN; sustituibles por CA real)
mkdir -p deploy/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/certs/key.pem -out deploy/certs/cert.pem -subj "/CN=localhost"
```

Los navegadores pedirán aceptar el certificado self-signed una vez por equipo (o
instalar `cert.pem` en "Autoridades de certificación de confianza" del
equipo/cliente).

### 2.1. Pasarela de pagos: bloqueo al arranque (Fase 0 cierre-produccion)

En producción el backend se **niega a arrancar** si la pasarela no está
configurada completa (antes, un `PAYMENT_GATEWAY` vacío dejaba el checkout
silenciosamente en modo simulado: venta `COMPLETADA` con referencia `SIM_` SIN
cobro real). Requisito: `PAYMENT_GATEWAY=wompi` + `WOMPI_PUBLIC_KEY`,
`WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_KEY` y `WOMPI_EVENTS_SECRET`. Única
excepción, explícita y con aviso fuerte en el log: `ALLOW_SIMULATED_PAYMENTS=true`
(solo demostraciones junto a datos de prueba, NUNCA junto a dinero real). Si las
llaves son de SANDBOX (`pub_test_...`) arranca igual pero registra "cobrará con
DINERO DE PRUEBA" — es la demo actual, no producción real. La validación vive en
`backend/utils/pagos.js` (`validarPasarelaProduccion`, con 6 tests unitarios) y
se ejecuta en `server.js` dentro del bloque fail-fast de producción.

### 2.2. Migraciones FUERA del arranque: `pnpm migrate` (Fase 2 cierre-produccion)

Antes, `setup.js` (DDL completo + seeds) corría dentro del proceso del backend
en cada arranque: con un usuario de menor privilegio (sin permisos DDL) el
contenedor ni siquiera levantaba. Ahora el DDL vive fuera del proceso vivo:

1. **Cuenta migradora** — ejecuta una vez `scripts/sql/usuarios-produccion.sql`
   (reescrito en Fase 2: crea `jadda_migrator` con CREATE/ALTER/DROP sobre
   `jadda_sports_db` + la cuenta DML-only `jadda_app`; contraseñas por
   placeholders `__CAMBIAR_PASSWORD_MIGRATOR__`/`__CAMBIAR_PASSWORD_APP__`,
   nunca en git).
2. **`.env` raíz** — `DB_PASSWORD` (app) y `MIGRATE_DB_PASSWORD` (migrador,
   obligatoria en compose con `${VAR:?}`; opcional `MIGRATE_DB_USER`).
3. **Servicio `migrate`** — nuevo en `docker-compose.prod.yml`: misma imagen
   del backend corriendo `node database/migrate.js` (script `pnpm migrate`,
   que reutiliza `setupDatabase()` de setup.js 1:1 — NO duplica lógica).
   Como la corrida también SIEMBRA el administrador, el servicio recibe además
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` (las mismas variables del backend).
   Con `up -d`, compose ejecuta migrate primero y el backend solo levanta si
   terminó OK (`condition: service_completed_successfully`). Idempotente en
   cada `up` (todo es CREATE IF NOT EXISTS / INSERT IGNORE / verificación MySQL).
4. **Backend DML-only** — por defecto `DB_USER=jadda_app`; en producción ya no
   migra al arrancar: si la BD no estuviese migrada, el arranque FALLA con
   instrucción clara (`run --rm migrate`) en vez de sembrar por accidente
   (verificación tras conectar: `SELECT 1 FROM CATEGORIAS LIMIT 1`).
5. **Tabla de sesiones** — la DDL de `sessions` pasó de "el store la crea solo"
   a setup.js/migrate.js (`SQL_TABLA_SESIONES`, SQL idéntica al `schema.sql`
   oficial del paquete v3.0.3); `server.js` fijó
   `createDatabaseTable: false` en `express-mysql-session`. Probado en la BD
   dev viva: CREATE IF NOT EXISTS aplicado, tabla intacta con sus filas.
6. **Escapatoria** — `RUN_MIGRATIONS_ON_BOOT=true` re-habilita el setup al
   arrancar (emergencias; en dev no aplica: se migra siempre, idempotente).

## 3. Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker logs -f jadda_backend_prod   # ver "BD ya migrada (verificación de negocio OK)" / "Pool MySQL conectado"
docker logs jadda_migrate_prod      # la corrida de migración (proceso de una sola vez, no escucha)
```

> Los datos del volumen prod son independientes de dev: la opción de
> reciclarlos (o arrancar desde cero) está detallada en §3.2.

## 3.1. El frontend de producción es nginx, no Vite (Fase 3 cierre-produccion)

El contenedor `jadda_frontend_prod` ya NO corre `vite preview`: es una imagen
**multi-stage** (`frontend/Dockerfile.prod`) — stage de build con node
(`corepack pnpm@11.8.0 build`) y runtime `nginx:alpine` que solo contiene el
HTML/JS/CSS compilado. La configuración interna (`deploy/nginx.spa.conf`,
montada read-only) hace:

- proxy de `/api/` y `/images/` → `backend:5000` (el SPA sigue siendo
  same-origin: cookies sin CORS, y las imágenes privadas pasan por la
  autorización del backend);
- cache larga para `/assets/` (los bundles Vite llevan hash);
- fallback SPA: cualquier ruta desconocida sirve `index.html`.

El nginx de borde (`deploy/nginx.conf`) apunta `proxy_pass http://frontend:80`
(antes :5173 al preview). Beneficio medido en el smoke: el contenedor
frontend pasa de **~391 MiB RAM (vite preview) a 10,6 MiB (nginx)**, y el
borde puede comunicar con él por HTTP plano interno (el TLS solo existe en
el borde).

**Lección crítica — `X-Forwarded-Proto`:** la cookie de sesión es `Secure`,
solo válida si el backend ve la petición como HTTPS. El nginx de borde fija
`X-Forwarded-Proto: https`; el nginx INTERNO de la SPA NO debe re-fijarla con
`$scheme` (sería `http` interno) ni hereda el valor por defecto: dejar esa
cabecera sin `proxy_set_header` hace que nginx la PASE hacia el backend tal
como vino del borde. Con `$scheme` en el interno, el login devolvía 200 pero
NUNCA emitía `Set-Cookie` (perfil 401) — bug detectado y corregido en el smoke.

## 3.2. Volúmenes separados: producción NO comparte la BD con desarrollo

`docker-compose.prod.yml` declara su propio volumen `mysql_prod` (nombre
fijo `jadda_mysql_prod_data`), fundido en Fase 3. Antes prod reutilizaba el
volumen de dev (`proyectojaddasports_mysql_data`) y era fácil aplastar o
revivir datos de prueba; ahora cada stack es independiente y los checkboxes
de módulo (dev demo, prod limpia) conviven en la misma máquina.

- **Producción con datos frescos de la demo** (recomendada): crear el dump de
  dev con `scripts/backup.ps1` y restaurarlo en `jadda_mysql_prod_data` con
  `scripts/restaurar-backup.ps1` — conserva URLs de Cloudinary, ventas y
  usuarios reales.
- **Producción vacía** (default): `docker compose -f docker-compose.prod.yml
  up -d --build` — `migrate` crea las 36 tablas + referencia + admin.
- `docker compose -f docker-compose.prod.yml down -v` borra SOLAMENTE el
  volumen prod (el dev sigue con sus datos).

## 3.3. Recuerda que Linux es case-sensitive

El servidor de producción contiene imágenes basadas en Linux: una import
`./css/navbar.css` (N minúscula) resolvía en Windows pero fallaba el `vite
build` dentro del contenedor porque el archivo real es `Navbar.css`. Corregidos
(y verificado con un barrido case-check en todo `src/` en la prueba). Si un
build nuevo falla en Linux y no en tu PC, sospecha primero de mayúsculas/rutas.

## 3.4. `.dockerignore` (backend y frontend)

Los Dockerfile.prod hacen `COPY . .`; sin `.dockerignore`, el `node_modules`
del HOST (creado con pnpm de Windows, con symlinks/junctions con rutas
`C:\Users\...`) se copia al contenedor y rompe el arranque (`Cannot find
module 'express'`). Ambos carpetas ya tienen `.dockerignore` que excluye
`node_modules`, `.env`, `dist`, `data`, `uploads`, `.git` — mantenerlo si se
agregan carpetas nuevas. Bonus: excluye `backend/.env` del contexto, así las
credenciales reales NUNCA quedan horneadas en la imagen (llegan por
`env_file`/compose).

## 4. Smoke tests post-arranque

```powershell
curl.exe -k https://localhost/                     # SPA (vía nginx)
curl.exe -k https://localhost/api/productos        # proxy → frontend interno → backend
curl.exe -s -o NUL -w "%{http_code}`n" "http://localhost/pedidos"   # 301 → https://localhost/pedidos (path conservado)
curl.exe -k https://localhost/admin                # 200 — fallback SPA de rutas privadas
# Sesión con cookie Secure REAL: login + perfil en la MISMA cadena de proxies
Set-Content -Path "$env:TEMP\login.json" -Value '{"email":"<admin>","password":"<pass>"}' -Encoding ascii
curl.exe -sk -c "$env:TEMP\cookie.txt" -H "Content-Type: application/json" `
  -H "Origin: https://localhost" --data-binary "@$env:TEMP\login.json" `
  -w "login:%{http_code}`n" https://localhost/api/auth/login
curl.exe -sk -b "$env:TEMP\cookie.txt" -H "Origin: https://localhost" `
  -w "perfil:%{http_code}`n" https://localhost/api/auth/perfil
Remove-Item "$env:TEMP\login.json","$env:TEMP\cookie.txt"
# → login:200 y perfil:200 prueban que la cookie Secure atraviesa borde+interno
docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}" jadda_frontend_prod
```

> El login/perfil no es cosmético: fue el test que destapó el bug de
> `X-Forwarded-Proto` de §3.1 (perfil devolvía 401 aunque el login fuera 200).

## 5. Checklist de seguridad que este perfil resuelve

- [x] OTP unificado en hash bcrypt (`registro`, `reenvio`, `recuperar`,
      `cambiar correo`) + `TOKEN` VARCHAR(255) (migración idempotente).
- [x] Archivos privados con verificación de propiedad por recurso
      (`server.js`: perfil abierto a autenticados; retos/devoluciones solo
      dueño/vendedor/admin).
- [x] Demo data aislada (variables `DEMO_DATA=false`/`NODE_ENV=production`).
- [x] Subidas: 25 MB c/u, 5 archivos, MIME real + coherencia ext/mime.
- [x] Google OAuth web usa userinfo con accessToken (implementación oficial).
- [x] HTTPS en la puerta pública (nginx) + cookies Secure.
- [x] Defensa CSRF por verificación de Origin en mutaciones (2026-10-21, exenta para el móvil nativo; guía §3).
- [x] `trust proxy` — `req.ip` real detrás del proxy para rate limiting (2026-10-21; guía §5).
- [x] Cabeceras de seguridad idénticas en nginx y Caddy + `server_tokens off` (2026-10-21; guía §6).
- [x] Auditoría de dependencias en CI (`pnpm audit`, informativa; guía §10).
- [ ] Rotación/rotado de la contraseña admin real (acción del cliente).
- [ ] Certificado CA real si se publica a Internet (self-signed cubre LAN).
- [ ] Prueba de carga (MC-12, pendiente del plan de calidad).

> Guía completa: [`05-guia-seguridad.md`](05-guia-seguridad.md) · Inventario vivo de brechas: [`../auditoria/estado-brechas.md`](../auditoria/estado-brechas.md)

## 6. Alternativa de reverse proxy: Caddy (entregable S03)

Este perfil usa **nginx** como puerta pública. Desde la semana S03 el repo incluye
la alternativa **Caddy** (`deploy/Caddyfile` + `deploy/docker-compose.caddy.yml`) que
publica los MISMOS servicios por los dominios elegidos (`www.jaddasports.com`,
`api.jaddasports.com`) con certificados automáticos — `tls internal` para práctica
en LAN, o Let's Encrypt si se quita esa línea tras comprar el dominio.

Regla: **un solo gateway** con los puertos 80/443 del host. Para cambiar de nginx a
Caddy en la misma máquina:

```bash
docker compose -f docker-compose.prod.yml stop nginx    # liberar 80/443
docker network ls                                       # red del stack prod (jadda-prod_default)
$env:PROXY_NET = "jadda-prod_default"                   # PowerShell (bash: export PROXY_NET=…)
docker compose -f deploy/docker-compose.caddy.yml up -d
```

Detalle completo y prueba con `curl --resolve`: [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md).

## 7. Volver a desarrollo

```bash
docker compose -f docker-compose.prod.yml down   # NO usa -v aquí
docker compose up -d                              # re-corrige las imágenes dev si el build prod las pisó
```
