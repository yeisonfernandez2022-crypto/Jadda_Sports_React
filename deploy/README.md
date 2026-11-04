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

# 3. Levantar (build + migración una vez + arranque ordenado)
docker compose -f deploy/compose.prod.yaml up -d --build
docker compose -f deploy/compose.prod.yaml ps

# 4. Smoke de vida
bash scripts/smoke-test.sh https://localhost
```

Entra al panel con la cuenta admin `ADMIN_EMAIL`/`ADMIN_PASSWORD` del `.env`.

## Quickstart nube gratuita (Render Blueprint + Aiven MySQL Free)

1. Pushear el repo a GitHub (Render despliega desde ahí, `render.yaml` de la raíz).
2. Crear la BD en Aiven (MySQL FREE pool 1, forzar TLS) y guardar host/usuario
   (`dbadmin`)/contraseña/`DB_NAME` + descargar el PEM del CA raíz.
3. Render → **New → Blueprint** → repo → completar los prompts `sync:false`
   (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME, DB_SSL_CA = PEM completo, ADMIN_EMAIL
   y ADMIN_PASSWORD) → **Apply**. El Blueprint ya pide `SESSION_SECRET`
   generado automáticamente.
4. Esperar builds → smoke:

```bash
bash scripts/smoke-test.sh https://jadda-frontend.onrender.com \
     https://jadda-backend.onrender.com
```

- El frontend proxea `/api` y `/images` al backend por DNS interno
  (`jadda-backend:10000`) — same-origin en todo el tránsito, sin CORS.
- Plan free: el servicio **duerme tras ~15 min sin tráfico** y la 1ª visita
  tarda ~30 s en despertar (documentado en S04 §5.3).
- Webhook de Wompi (si se usa la pasarela):
  `https://jadda-backend.onrender.com/api/pagos/webhook`.

## Alternativa de borde (Caddy)

`docker-compose.caddy.yml` + `Caddyfile` sirven como reverse proxy del S03
(dominio `www`/`api` + TLS gestionado por Caddy) cuando se necesita un dominio
propio y no el nginx clásico — ver su documentación en el entregable S03.
