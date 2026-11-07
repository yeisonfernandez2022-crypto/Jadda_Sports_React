# 05 — Despliegue en Oracle Cloud (VM Always Free)

> Estado: **PROCEDIMIENTO** — guía paso a paso para llevar la app a una VM
> propia en Oracle Cloud. Se documentará con evidencia real (smoke, capturas,
> tiempos) tras la primera ejecución, como se hizo con S04 para el PaaS
> anterior.
>
> Sustituye al despliegue en PaaS gratuito: aquí corre EL MISMO stack de
> `deploy/compose.prod.yaml` (MySQL incluido en la VM), sin sleep por
> inactividad y con control total del servidor.

## 1. Por qué Oracle Cloud

- **Always Free** no expira con la prueba de 30 días: VM ARM Ampere A1
  flexible (cuota total: 4 OCPU + 24 GB RAM, hasta 200 GB de disco).
- **Este despliegue usa 1 OCPU + 6 GB** — dimensionado con mediciones
  reales del stack en prod local: 486 MiB en reposo (504 MiB pico con
  carga), 0.4 vCPU sostienen ~374 rps con p95 114–124 ms y el build de
  imágenes pica ~1.5–2 GB. Sobran ~2.5× de CPU y ~12× de RAM; queda
  3/4 de la cuota Always Free libre para una segunda VM si hiciera
  falta.
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
   `VM.Standard.A1.Flex` — **1 OCPU / 6 GB** (suficiente según las
   mediciones; pedir menos OCPU reduce el riesgo de
   "Out of host capacity").
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
| `GOOGLE_*` + callback | `https://TU_DOMINIO/api/auth/google/callback` |
| `FRONTEND_URL` | `https://TU_DOMINIO` (links de correos) |
| `CORS_ORIGINS` | Vacío — todo es same-origin tras el nginx |
| `TRUST_PROXY` | `2` ya viene en el compose (borde → SPA → backend) |

## 8. TLS y dominio

- **Sin dominio (Fase A)**: el nginx de borde usa el par self-signed de
  `deploy/certs/` → la app responde en `https://IP` con aviso del navegador.
  Válido para pruebas; el webhook de Wompi y el OAuth social NO funcionan
  así (exigen HTTPS de dominio real).
- **Con dominio (Fase B, recomendado — ~$10/año, único costo real)**:
  1. Registrar el dominio y crear registro **A** → IP pública reservada.
  2. Emitir certificados Let's Encrypt: `certbot certonly --standalone`
     (detiene el nginx unos segundos) o modo webroot; copiar
     `fullchain.pem`/`privkey.pem` a `deploy/certs/cert.pem`/`key.pem` y
     programar la renovación con cron.
  3. Alternativa: borde **Caddy** (`deploy/docker-compose.caddy.yml` +
     `Caddyfile` con el dominio propio) — TLS automático sin certbot
     (ajustar el Caddyfile de S03: apuntar a `frontend:80`, no :5173, y
     `PROXY_NET=jadda-prod_default`).

## 9. Verificación

```bash
bash scripts/smoke-test.sh https://TU_DOMINIO
docker compose --env-file .env -f deploy/compose.prod.yaml logs -f backend
```

Checklist: SPA 200 · `/api/productos` 200 · login rechaza credenciales
erradas · registro con OTP real (Brevo) · compra sandbox Wompi · backups
programados (`scripts/respaldar.sh` + cron).

## 10. Costos y límites

| Concepto | Valor |
| --- | --- |
| VM ARM A1 1 OCPU / 6 GB | $0 (Always Free) |
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
