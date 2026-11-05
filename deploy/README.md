# deploy/ — Artefactos de producción (entregable S04)

Este directorio concentra TODO lo que vive en el servidor Linux y el
despliegue en nube. La topología, los comandos paso a paso y los límites de
cada opción están documentados en:

- `docs/entregables/entregable-s04-procedimiento-despliegue.md` — **S04** en
  detalle (VM + nube, con evidencia de cada corrida).
- `docs/implantacion/04-despliegue-produccion.md` — detalles del build prod y
  troubleshooting (línea a línea).
- `docs/entregables/entregable-s02-planes.md` — respaldo/restauración de la
  BD (`scripts/respaldar.sh`, `scripts/restaurar-backup.ps1`).

## Contenido

| Archivo                   | Qué es                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `compose.prod.yaml`       | Topología de producción Linux (5 servicios, sin puertos publicados salvo nginx 80/443)  |
| `env.prod.example`        | Plantilla de secretos: copiar a la raíz del repo clonado como `.env` y rellenar          |
| `nginx.conf`              | Nginx de BORDE: 80 → HTTPS 443 + proxy al frontend interno (única puerta pública)        |
| `certs/`                  | `cert.pem`/`key.pem` del TLS del borde (self-signed para offline-LAN o del CA propio)    |
| `docker-compose.caddy.yml` + `Caddyfile` | Alternativa de borde con Caddy (entregable S03 §4.6, con `tls internal` y dominio) |

## Quickstart Linux (VM / servidor propio)

```bash
# 0. Requisitos: Docker Engine + plugin compose (scripts/verificar-requisitos.sh)
git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
cd Jadda_Sports_React

# 1. Secretos: copiar la plantilla y rellenar (el compose exige 6 variables ${VAR:?})
cp deploy/env.prod.example .env
# (las contraseñas de jadda_migrator / jadda_app DEBEN coincidir con
#  scripts/sql/usuarios-produccion.sql — ver S04 paso 3)

# 2. Certificado del borde (si no hay CA real: self-signed para LAN)
#    (deploy/certs ya trae un par; para regenerarlo:)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/certs/key.pem -out deploy/certs/cert.pem \
  -subj "/CN=localhost"

# 3. Crear los usuarios MySQL de la app ANTES del 1er arranque.
#    OJO: docker compose lee el .env respecto al DIRECTORIO del compose
#    (`deploy/`), NO al CWD — por eso SIEMPRE se pasa `--env-file .env`.
docker compose --env-file .env -f deploy/compose.prod.yaml up -d database
#    (mysql arriba; sustituye los placeholders con las claves del .env y
#     aplica el bootstrap; los 3 comandos siguientes usan bash/Linux)
sed -e "s/__CAMBIAR_PASSWORD_MIGRATOR__/$MIGRATE_DB_PASSWORD/" \
    -e "s/__CAMBIAR_PASSWORD_APP__/$DB_PASSWORD/" \
    scripts/sql/usuarios-produccion.sql > /tmp/users.sql
docker cp /tmp/users.sql jadda_mysql_prod:/tmp/users.sql
docker exec jadda_mysql_prod sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "source /tmp/users.sql"'
rm -f /tmp/users.sql

# 4. Levantar el resto: migrate corre el DDL una vez (exit 0), backend
#    espera `service_completed_successfully`, luego frontend y nginx.
docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build
docker compose -f deploy/compose.prod.yaml --env-file .env ps

# 5. Smoke de vida
bash scripts/smoke-test.sh https://localhost
```

Entra al panel con la cuenta admin `ADMIN_EMAIL`/`ADMIN_PASSWORD` del `.env`.

## Quickstart nube gratuita (Oracle Cloud, VM Always Free)

La nube es una VM propia (Oracle Cloud Always Free, ARM Ampere A1) que corre
EL MISMO stack de `deploy/compose.prod.yaml` con su MySQL incluido — sin
PaaS, sin sleep por inactividad. Guía completa: `docs/implantacion/06-despliegue-oracle.md`.

```bash
# 1. Cuenta en oracle.com/cloud/free (tarjeta solo para verificación, ~$1
#    reembolsable). HOME REGION definitiva — no se puede cambiar.
# 2. Compute → Instances: shape VM.Standard.A1.Flex (4 OCPU / 24 GB), Ubuntu
#    22.04, subnet pública + IP pública RESERVADA. Descargar la clave SSH.
# 3. Security List de la VCN: Ingress TCP 80 y 443 desde 0.0.0.0/0.
# 4. En la VM (ssh ubuntu@IP):
sudo apt update && sudo apt -y install docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu   # cerrar sesión y volver a entrar
# 5. Clonar y levantar:
git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
cd Jadda_Sports_React
cp deploy/env.prod.example .env   # rellenar los 6 secretos obligatorios
#    (bootstrap de usuarios MySQL: pasos del Quickstart Linux de arriba)
docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build
# 6. Smoke:
bash scripts/smoke-test.sh https://IP_O_DOMINIO
```

- Correo: `BREVO_API_KEY` en `backend/.env` (la VM no necesita salida SMTP —
  Oracle free solo bloquea el puerto 25).
- TLS: self-signed funciona de una (`https://IP`, aviso del navegador); con
  dominio propio → Let's Encrypt (certbot) o borde Caddy, y ahí sí webhook
  de Wompi (`https://TU_DOMINIO/api/pagos/webhook`) y OAuth.
- Webhook de Wompi (si se usa la pasarela):
  `https://TU_DOMINIO/api/pagos/webhook`.

## Alternativa de borde (Caddy)

`docker-compose.caddy.yml` + `Caddyfile` sirven como reverse proxy del S03
(dominio `www`/`api` + TLS gestionado por Caddy) cuando se necesita un dominio
propio y no el nginx clásico — ver su documentación en el entregable S03.
