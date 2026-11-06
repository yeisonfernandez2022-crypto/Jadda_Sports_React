# 06 — Despliegue en Oracle Cloud (VM Always Free)

> Estado: **PROCEDIMIENTO** — guía paso a paso para llevar la app a una VM
> propia en Oracle Cloud. Se documentará con evidencia real (smoke, capturas,
> tiempos) tras la primera ejecución, como se hizo con S04 para el PaaS
> anterior.
>
> Sustituye al despliegue en PaaS gratuito: aquí corre EL MISMO stack de
> `deploy/compose.prod.yaml` (MySQL incluido en la VM), sin sleep por
> inactividad y con control total del servidor.

## 1. Por qué Oracle Cloud

- **Always Free** no expira con la prueba de 30 días: VM ARM Ampere A1 con
  4 OCPU + 24 GB RAM y hasta 200 GB de disco, siempre gratis.
- Corre el mismo compose de producción: **cero cambios de código**.
- MySQL dentro de la VM (servicio `database` del compose): una sola pieza
  que respaldar con `scripts/respaldar.sh`. (Alternativa: mantener la BD
  gestionada externa — p. ej. Aiven — apuntando `DB_HOST`/`DB_SSL_*` a ella;
  añade un segundo proveedor y no es necesaria para arrancar.)
- Red saliente: en cuentas free SOLO el puerto 25 (SMTP) está bloqueado; el
  correo va por la **API HTTPS de Brevo** (`BREVO_API_KEY`), así que no
  afecta en nada.
- Las imágenes del stack (`node:22-alpine`, `nginx:alpine`, `mysql:8.0`)
  tienen builds **arm64 nativos**: todo corre nativo en la VM ARM.

## 2. Registro (una vez)

1. `oracle.com/cloud/free` → **Start for free**.
2. Tarjeta de crédito/débito: SOLO verificación de identidad (autorización
   temporal de ~$1 que se reintegra; en Always Free no se cobra nada). Sin
   tarjeta no se crea la cuenta.
3. **HOME REGION**: elegir con cuidado — NO se puede cambiar después. Para
   Colombia se recomienda `us-ashburn-1` (Virginia, menor latencia).
   Nota: la forma ARM A1 a veces reporta "Out of host capacity" en regiones
   muy usadas; si pasa, reintentar a otra hora o crear la VM con menos OCPU
   y escalarla después.
4. Confirmar el correo y esperar el aprovisionamiento (minutos).

## 3. Crear la VM

1. Consola → **Compute → Instances → Create instance**.
2. Name: `jadda-sports`. Image: **Ubuntu 22.04** (aarch64). Shape:
   `VM.Standard.A1.Flex` — **4 OCPU / 24 GB** (todo el Always Free en una
   sola VM).
3. Networking: VCN nueva (wizard), **subnet pública** y, en la sección de IP
   pública, **Reserved public IP** — la IP NO cambia al reiniciar la VM
   (imprescindible para apuntar el DNS después).
4. SSH keys: **Generate a key pair** → descargar la privada (`.key`) y
   guardarla: no se puede recuperar después.
5. Boot volume: 50–100 GB (el Always Free reparte 200 GB totales).
6. Create. Anotar la **Public IP address** de la instancia.

## 4. Abrir puertos (Security List)

La VCN nueva SOLO deja entrar el 22. En la subnet → **Security List →
Add Ingress Rules**:

| Source CIDR | Protocolo | Destination Port | Para qué |
| --- | --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` | HTTP (redirect a HTTPS) |
| `0.0.0.0/0` | TCP | `443` | HTTPS |

El 22 ya existe. Si se activa `ufw` dentro de la VM, permitir 80/443/22
**antes** de `ufw enable` (no bloquearse a uno mismo por SSH).

## 5. Preparar el servidor

```bash
ssh -i ruta/clave.key ubuntu@IP_PUBLICA

sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu   # cerrar sesión y volver a entrar
docker run --rm hello-world       # verificación
```

## 6. Clonar y levantar el stack

**Ruta automatizada** (tras el clon y el `.env`; sirve igual para actualizar
el código después: `git pull` + volver a correrlo):

```bash
bash scripts/desplegar-prod.sh
#   valida .env y Docker → bootstrap MySQL → up -d --build → healthchecks → smoke
#   flags: --sin-bootstrap (cuentas MySQL ya aplicadas) · --sin-smoke ·
#          BASE_URL=https://TU_DOMINIO (para el smoke con dominio real)
#   exit: 0 desplegado · 1 .env/argumentos · 2 bootstrap BD · 3 build/up ·
#         4 healthchecks · 5 smoke
```

Ruta manual equivalente:

```bash
cd /opt && sudo git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
cd Jadda_Sports_React

# Secretos: copiar plantilla y rellenar los 6 obligatorios (ver §7)
cp deploy/env.prod.example .env

# Bootstrap de usuarios MySQL ANTES del 1er arranque
# (misma mecánica del Quickstart Linux de deploy/README.md):
set -a; source .env; set +a
sed -e "s/__CAMBIAR_PASSWORD_MIGRATOR__/$MIGRATE_DB_PASSWORD/" \
    -e "s/__CAMBIAR_PASSWORD_APP__/$DB_PASSWORD/" \
    scripts/sql/usuarios-produccion.sql > /tmp/users.sql
docker compose --env-file .env -f deploy/compose.prod.yaml up -d database
docker cp /tmp/users.sql jadda_mysql_prod:/tmp/users.sql
docker exec jadda_mysql_prod sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "source /tmp/users.sql"'
rm -f /tmp/users.sql

# Resto del stack: migrate corre el DDL una vez (exit 0), backend espera
# `service_completed_successfully`, luego frontend y nginx:
docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build
docker compose --env-file .env -f deploy/compose.prod.yaml ps
```

## 7. Secretos

**Obligatorios** del compose (`deploy/env.prod.example` → `.env` raíz):
`MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`, `MIGRATE_DB_PASSWORD`, `SESSION_SECRET`
(`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
`ADMIN_EMAIL`, `ADMIN_PASSWORD`.

**Opcionales** en `backend/.env` (crear desde `backend/.env.example`):

| Variable | Para qué en Oracle |
| --- | --- |
| `BREVO_API_KEY` | Correo transaccional por API 443 (sin salida SMTP) |
| `CLOUDINARY_URL` | Medios; sin él las subidas van a disco local |
| `WOMPI_*` | Pasarela (sandbox); webhook → `https://TU_DOMINIO/api/pagos/webhook` |
| `GOOGLE_*` / `FACEBOOK_*` + callbacks | `https://TU_DOMINIO/api/auth/{google\|facebook}/callback` |
| `FRONTEND_URL` | `https://TU_DOMINIO` (links de correos) |
| `CORS_ORIGINS` | Vacío — todo es same-origin tras el nginx |
| `TRUST_PROXY` | `2` ya viene en el compose (borde → SPA → backend) |

## 8. TLS y dominio

- **Sin dominio (Fase A)**: el nginx de borde usa el par self-signed de
  `deploy/certs/` → la app responde en `https://IP` con aviso del navegador.
  Válido para pruebas; el webhook de Wompi y el OAuth social NO funcionan
  así (exigen HTTPS de dominio real).
- **Con dominio (Fase B, recomendado — ~$10/año, único costo real)**:
  1. Registrar el dominio y crear registros **A** (dominio y `www`) → IP
     pública reservada.
  2. Emitir el certificado con certbot **webroot** — el nginx de borde ya
     sirve `/.well-known/acme-challenge/` desde `deploy/webroot/` (mount
     `./webroot:/var/www:ro` del compose), así que NO hay que detener el
     stack ni para emitir ni para renovar:

     ```bash
     sudo apt -y install certbot
     sudo certbot certonly --webroot -w deploy/webroot \
       -d TU_DOMINIO -d www.TU_DOMINIO --email TU_CORREO --agree-tos \
       --deploy-hook 'cp -f /etc/letsencrypt/live/TU_DOMINIO/fullchain.pem /opt/Jadda_Sports_React/deploy/certs/cert.pem; cp -f /etc/letsencrypt/live/TU_DOMINIO/privkey.pem /opt/Jadda_Sports_React/deploy/certs/key.pem; docker exec jadda_web_prod nginx -s reload'
     # quedan publicados en deploy/certs/ y el borde recargado; el timer de
     # certbot repite el hook solo en cada renovación
     ```

     Flujo webroot paso a paso: `deploy/webroot/README.md`.
  3. Comprobar tras emitir: `docker exec jadda_web_prod nginx -t` y
     `curl -I https://TU_DOMINIO` (sin `-k`: cert válido y headers de
     seguridad del borde presentes).
  4. Alternativa: borde **Caddy** (`deploy/docker-compose.caddy.yml` +
     `Caddyfile` con el dominio propio) — TLS automático sin certbot
     (ajustar el Caddyfile de S03: apuntar a `frontend:80`, no :5173, y
     `PROXY_NET=jadda-prod_default`).

## 9. Verificación

```bash
bash scripts/smoke-test.sh https://TU_DOMINIO   # Fase A: https://IP también sirve (el script usa -k)
bash scripts/verificar-requisitos.sh            # su sección 8 comprueba los *_prod y el HTTPS del borde
docker compose --env-file .env -f deploy/compose.prod.yaml logs -f backend
```

Checklist: SPA 200 · `/api/productos` 200 · login rechaza credenciales
erradas · registro con OTP real (Brevo) · compra sandbox Wompi · backups
programados (`scripts/respaldar.sh` + cron).

## 10. Costos y límites

| Concepto | Valor |
| --- | --- |
| VM ARM A1 4 OCPU / 24 GB | $0 (Always Free) |
| Disco hasta 200 GB | $0 (Always Free) |
| IP pública reservada (asociada a la VM) | $0 |
| Transferencia saliente | 10 TB/mes incluidos |
| Dominio propio | ~$10/año (único costo real) |
| Puertos de salida bloqueados | 25 (SMTP) — el correo va por API Brevo 443 |
| Riesgo conocido | Oracle puede **reclamar VMs Always Free inactivas** (percentil 95 de CPU < 20 % durante 7 días): tráfico real o aceptar el riesgo |

## 11. Actualización y rollback

- Actualizar: `git pull && docker compose --env-file .env -f
  deploy/compose.prod.yaml up -d --build` (el DDL de `migrate` es
  idempotente y re-corre sin daño).
- Rollback: `git checkout <tag|commit> && up -d --build` — la BD no se toca
  (migraciones aditivas; ver S04 §5.2).
- Snapshot del disco: Consola → Compute → Custom images; para la BD,
  `scripts/respaldar.sh` (cron recomendado).

## 12. Respaldos y restauración (guía SENA 5)

El dump se toma DENTRO de `jadda_mysql_prod` — no hace falta mysqldump en el
anfitrión ni credenciales adicionales:

```bash
bash scripts/respaldar.sh                   # → backups/mysql/<fecha>_jadda_sports_db.sql
RETENER_DIAS=14 bash scripts/respaldar.sh   # además purga dumps con más de 14 días
```

Valida cada dump por tamaño y por la línea final `Dump completed on`.
Cron diario (`sudo crontab -e`):

```cron
30 23 * * * cd /opt/Jadda_Sports_React && RETENER_DIAS=14 bash scripts/respaldar.sh >> backups/backup.log 2>&1
```

Restaurar una BD concreta (pide teclear `RESTAURAR`; detiene
backend/migrate, importa y re-levanta el stack):

```bash
bash scripts/restaurar.sh backups/mysql/<fecha>_jadda_sports_db.sql
bash scripts/restaurar.sh --asumir backups/mysql/<fecha>_jadda_sports_db.sql   # para DR automatizado
```

Comprobar un dump SIN tocar la BD viva (BD temporal `${BD}_restcheck_$$`;
con `--estricto-filas` exige además filas idénticas):

```bash
bash scripts/verificar-restauracion.sh backups/mysql/<fecha>_jadda_sports_db.sql
```

Referencia de RPO/RTO: respaldo diario 23:30 → RPO ≈ 24 h; el dump de
referencia (≈35 tablas) se restauró en ~3 s en la prueba de
`02-plan-migracion-respaldos.md` (otro equipo puede variar). Probar la
restauración al menos una vez ANTES de que haga falta de verdad.

## 13. Backend y frontend como servicios (guía SENA 6)

El "servicio" del backend es el contenedor `jadda_backend_prod`: compose lo
define con `restart: unless-stopped`, así que Docker lo re-levanta solo si
el proceso muere o tras reinicio del anfitrión (mientras `docker.service`
arranque al boot, el default en Ubuntu):

```bash
systemctl is-enabled docker   # enabled = los contenedores arrancan al encender la VM
```

Unidad systemd OPCIONAL para gobernar el stack con `systemctl` (Compose
sigue siendo el gestor real — la unidad solo orquesta `up -d`/`down`):
`deploy/jadda-stack.service`, con 3 líneas marcadas `AJUSTAR`:

```bash
sudo cp deploy/jadda-stack.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jadda-stack.service   # levanta y queda "active (exited)"
# systemctl stop jadda-stack.service              # baja el stack
```

## 14. Frontend: build y estáticos del SPA (guía SENA 7)

El SPA se sirve como estáticos del build (`tsc -b && vite build`) hechos
DENTRO de la imagen (`frontend/Dockerfile.prod` multi-stage node →
nginx:alpine): `jadda_frontend_prod` expone esos archivos y su nginx interno
enruta `/api/` e `/images/` hacia el backend, inyectando los placeholders
(`BACKEND_ORIGEN`, `DNS_RESOLVER`).

Puntos del template que importan (`frontend/nginx.spa.conf.template`):

| Comportamiento | Dónde en el template |
| --- | --- |
| Root de los estáticos del build | `root /usr/share/nginx/html;` |
| Fallback SPA (rutas de React sin `.html`) | `try_files $uri /index.html;` |
| API proxificada al backend interno | `location /api/ { proxy_pass $backend_origen; … }` |
| Imágenes proxificadas | `location /images/ { … }` |
| Upstream resuelto en RUNTIME (el backend puede no existir aún al arrancar) | `resolver ${DNS_RESOLVER}` + `proxy_pass $backend_origen;` |

Para publicar con dominio real no cambia el build: el nginx del borde hace
pass-through hacia estos estáticos (§8/§15).

## 15. Dominio, nginx y HTTPS (guía SENA 8) — checklist

1. **DNS**: registros **A** (dominio y `www`) → IP pública reservada de la
   VM (Consola → Instancia → Adjuntar IP reservada si aún no lo está).
2. **Firewalls**: Security List de la VCN TCP 80/443 (§3) y, en el host,
   solo 80/443 + SSH: `sudo ufw status`.
3. **Sintaxis del borde antes de recargar**: `docker exec jadda_web_prod nginx -t`.
4. **Let's Encrypt por webroot + deploy-hook**: §8 paso 2 (`deploy/webroot/README.md`).
5. **Comprobar HTTPS real** (sin `-k`): `curl -I https://TU_DOMINIO` →
   respuesta del borde con `Strict-Transport-Security` y
   `X-Content-Type-Options: nosniff`.
6. **Smoke completo con el dominio real**: `bash scripts/smoke-test.sh https://TU_DOMINIO`.
7. **Renovación ya registrada** (el timer de certbot repite el hook solo).
8. **URLs externas con el dominio real**: webhook de Wompi
   `https://TU_DOMINIO/api/pagos/webhook` y callbacks OAuth
   `https://TU_DOMINIO/api/auth/{google|facebook}/callback` en sus consolas.

## 16. Mapa de las 8 guías → dónde viven en el repo

| Guía SENA | Tema | Dónde |
| --- | --- | --- |
| 1 | Verificar requisitos del equipo | `scripts/verificar-requisitos.sh` (acepta arm64; su §8 = producción) |
| 2 | Plan de migración y respaldos | `docs/implantacion/02-plan-migracion-respaldos.md` (Windows + Linux) |
| 3 | Despliegue local (dev) | `docs/implantacion/03-guia-despliegue.md` |
| 4 | Despliegue en producción | §5-§7 de esta guía + `deploy/compose.prod.yaml` + `scripts/desplegar-prod.sh` |
| 5 | Respaldo y restauración | §12 — `scripts/respaldar.sh` / `restaurar.sh` / `verificar-restauracion.sh` |
| 6 | Backend como servicio | §13 — compose `restart: unless-stopped` + `deploy/jadda-stack.service` |
| 7 | Frontend como estáticos | §14 — `frontend/Dockerfile.prod` + nginx interno |
| 8 | Dominio + HTTPS | §8 (Fase B) + §15 (checklist) |

## 17. Operación diaria y pendientes externos

| Tarea | Comando |
| --- | --- |
| Actualizar el código | `git pull && bash scripts/desplegar-prod.sh --sin-bootstrap` |
| Salud completa | `bash scripts/verificar-requisitos.sh` (sección 8) |
| Estado de contenedores | `docker compose --env-file .env -f deploy/compose.prod.yaml ps` |
| Logs del backend | `docker compose --env-file .env -f deploy/compose.prod.yaml logs -f backend` |
| Backups diarios | cron del §12 |
| Ensayo de DR | `verificar-restauracion.sh` sobre el dump del día (§12) |

Pendientes EXTERNOS del operador (no van en el repo):

- Registrar el dominio y el registro DNS A (§15-1); HOME REGION de Oracle
  ya elegida al crear la cuenta.
- Credenciales de producción reales en el `.env`/`backend/.env`:
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (rotar si la demo fue compartida), llaves
  **live** de Wompi, `CLOUDINARY_URL`, `BREVO_API_KEY`.
- SSL/hardening específico del dominio real una vez emitido el TLS (§15).
