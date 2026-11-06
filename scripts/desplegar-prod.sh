#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  scripts/desplegar-prod.sh — despliegue IDEMPOTENTE del stack de producción
# ═══════════════════════════════════════════════════════════════════════════
#  Ruta automatizada del §6 de docs/implantacion/06-despliegue-oracle.md.
#  Sirve para el PRIMER despliegue Y para actualizar el código (git pull +
#  volver a correrlo): qué hace, en orden —
#
#    1. Valida que exista `.env` en la raíz con las 6 variables obligatorias
#       rellenas (sin placeholders) y que Docker/Compose estén disponibles.
#    2. Levanta la BD (servicio `database`) y aplica scripts/sql/
#       usuarios-produccion.sql con las claves del .env: crea las cuentas
#       jadda_migrator / jadda_app con CREATE USER IF NOT EXISTS (repetir no
#       cambia claves ya existentes — si rotaste una, hazlo con ALTER USER
#       desde mysql del contenedor). El SQL temporal vive en /tmp del
#       CONTENEDOR (docker cp) y se autodestruye: la clave nunca queda en
#       disco del anfitrión ni en el historial del shell.
#    3. `up -d --build` del stack completo: migrate corre el DDL una vez
#       (exit 0), el backend espera sus healthchecks, nginx queda como única
#       puerta pública 80/443.
#    4. Espera `jadda_backend_prod` healthy y corre el smoke
#       (scripts/smoke-test.sh — su curl ya usa -k, así que el certificado
#       self-signed de la Fase A no lo rompe).
#
#  Uso (el script vuelve solo a la raíz del repo):
#     bash scripts/desplegar-prod.sh
#     bash scripts/desplegar-prod.sh --sin-bootstrap   # saltar el paso 2 (ya aplicado)
#     bash scripts/desplegar-prod.sh --sin-smoke       # saltar el paso 4
#     BASE_URL=https://tudominio.com bash scripts/desplegar-prod.sh
#
#  BASE_URL (default https://localhost) es la raíz que usa el smoke: al
#  publicar el dominio real, despliega con BASE_URL=https://TU_DOMINIO.
#
#  Códigos de salida: 0 OK · 1 precondiciones · 2 BD/bootstrap · 3 stack ·
#  4 backend unhealthy · 5 smoke FAIL.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SIN_BOOTSTRAP=0
SIN_SMOKE=0
for arg in "$@"; do
  case "$arg" in
    --sin-bootstrap) SIN_BOOTSTRAP=1 ;;
    --sin-smoke) SIN_SMOKE=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "[ERROR] opción desconocida: $arg (usa --help)" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."

say() { echo "$*"; }
die() { echo "[ERROR] $*" >&2; exit "${EXIT_CODE:-1}"; }

# ─────────────────────────── 1. Precondiciones ────────────────────────────
say "== Precondiciones =="
command -v docker >/dev/null 2>&1 || die "docker no está instalado (guía 06 §5)"
docker info >/dev/null 2>&1       || die "el daemon de Docker no responde (¿permiso docker? ¿servicio arriba?)"
docker compose version >/dev/null 2>&1 || die "'docker compose' no disponible (apt install docker-compose-v2)"
[[ -f .env ]] || die "no existe .env en la raíz (cp deploy/env.prod.example .env y rellénalo)"
[[ -f deploy/compose.prod.yaml ]]    || die "falta deploy/compose.prod.yaml"

# Leer del .env SOLO las 6 obligatorias (tolera comillas y CRLF; NO hace
# source del archivo entero para no ejecutar contenido ajeno)
MYSQL_ROOT_PASSWORD=""; DB_PASSWORD=""; MIGRATE_DB_PASSWORD=""
SESSION_SECRET=""; ADMIN_EMAIL=""; ADMIN_PASSWORD=""
while IFS= read -r line; do
  line="${line%$'\r'}"
  case "$line" in
    MYSQL_ROOT_PASSWORD=*|DB_PASSWORD=*|MIGRATE_DB_PASSWORD=*|SESSION_SECRET=*|ADMIN_EMAIL=*|ADMIN_PASSWORD=*) ;;
    *) continue ;;
  esac
  clave="${line%%=*}"
  valor="${line#*=}"
  [[ "$valor" == '"'*'"' ]] && valor="${valor:1:${#valor}-2}"
  [[ "$valor" == "'"*"'" ]] && valor="${valor:1:${#valor}-2}"
  case "$clave" in
    MYSQL_ROOT_PASSWORD)  MYSQL_ROOT_PASSWORD="$valor" ;;
    DB_PASSWORD)          DB_PASSWORD="$valor" ;;
    MIGRATE_DB_PASSWORD)  MIGRATE_DB_PASSWORD="$valor" ;;
    SESSION_SECRET)       SESSION_SECRET="$valor" ;;
    ADMIN_EMAIL)          ADMIN_EMAIL="$valor" ;;
    ADMIN_PASSWORD)       ADMIN_PASSWORD="$valor" ;;
  esac
done < .env

FALTAN=()
declare -a PARES=(
  "MYSQL_ROOT_PASSWORD|root de MySQL del contenedor"
  "DB_PASSWORD|cuenta app (jadda_app)"
  "MIGRATE_DB_PASSWORD|cuenta migradora (jadda_migrator)"
  "SESSION_SECRET|secreto de sesiones"
  "ADMIN_EMAIL|correo del admin sembrado"
  "ADMIN_PASSWORD|contraseña del admin sembrado"
)
for par in "${PARES[@]}"; do
  var="${par%%|*}"; desc="${par#*|}"
  [[ -n "${!var:-}" ]] || FALTAN+=("$var ($desc)")
  case "${!var:-}" in *__CAMBIAR__*) FALTAN+=("$var ($desc): placeholder sin reemplazar") ;; esac
done
[[ ${#FALTAN[@]} -eq 0 ]] || die "faltan variables obligatorias en .env: ${FALTAN[*]}"
[[ "$DB_PASSWORD" == "$MIGRATE_DB_PASSWORD" ]] && echo "[AVISO] DB_PASSWORD y MIGRATE_DB_PASSWORD son IGUALES: usa claves distintas (app DML-only vs migrador DDL)."
say "[OK] .env con las 6 obligatorias; docker/compose disponibles."

# ──────────────── 2. BD: levantar + cuentas de menor privilegio ─────────────
EXIT_CODE=2
TMP_SQL=""
if [[ "$SIN_BOOTSTRAP" -ne 1 ]]; then
  say "== BD: up -d database =="
  if ! docker compose --env-file .env -f deploy/compose.prod.yaml up -d database; then
    die "docker compose up database falló (ver salida de arriba)"
  fi

  say "Esperando MySQL (jadda_mysql_prod healthy)..."
  health="none"
  for _ in $(seq 1 120); do
    health="$(docker inspect -f '{{.State.Health.Status}}' jadda_mysql_prod 2>/dev/null || echo none)"
    case "$health" in
      healthy)   break ;;
      unhealthy) docker logs --tail 40 jadda_mysql_prod || true
                 die "MySQL quedó unhealthy" ;;
    esac
    sleep 2
  done
  [[ "$health" == "healthy" ]] || die "MySQL no llegó a healthy en ~4 min (docker logs jadda_mysql_prod)"

  # SQL con claves reales SOLO dentro del contenedor (nunca en disco del
  # anfitrión ni en el historial)
  TMP_SQL="$(mktemp -d)"
  trap 'rm -rf "$TMP_SQL"; docker exec jadda_mysql_prod sh -c "rm -f /tmp/users.sql" >/dev/null 2>&1 || true' EXIT
  sql="$(< scripts/sql/usuarios-produccion.sql)"
  sql="${sql//__CAMBIAR_PASSWORD_MIGRATOR__/$MIGRATE_DB_PASSWORD}"
  sql="${sql//__CAMBIAR_PASSWORD_APP__/$DB_PASSWORD}"
  printf '%s\n' "$sql" > "$TMP_SQL/users.sql"
  chmod 600 "$TMP_SQL/users.sql"
  docker cp "$TMP_SQL/users.sql" jadda_mysql_prod:/tmp/users.sql
  if ! docker exec jadda_mysql_prod sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /tmp/users.sql' >/dev/null; then
    die "al aplicar usuarios-produccion.sql (¿MYSQL_ROOT_PASSWORD correcta en .env?)"
  fi
  say "[OK] Cuentas jadda_migrator/jadda_app aseguradas (idempotente — repetir NO cambia claves existentes)."
else
  say "== BD: --sin-bootstrap, se salta la aplicación de cuentas =="
  trap 'docker exec jadda_mysql_prod sh -c "rm -f /tmp/users.sql" >/dev/null 2>&1 || true' EXIT
fi

# ─────────────────────────── 3. Stack completo ────────────────────────────
EXIT_CODE=3
say "== Stack: up -d --build (migrate → backend → frontend → nginx) =="
if ! docker compose --env-file .env -f deploy/compose.prod.yaml up -d --build; then
  die "docker compose up --build falló (ver salida de arriba)"
fi

# ───────────────────── 4. Healthcheck + smoke ─────────────────────────────
EXIT_CODE=4
say "Esperando backend (jadda_backend_prod healthy)..."
estado="none"
for _ in $(seq 1 150); do
  estado="$(docker inspect -f '{{.State.Health.Status}}' jadda_backend_prod 2>/dev/null || echo none)"
  case "$estado" in
    healthy)   break ;;
    unhealthy) docker logs --tail 80 jadda_backend_prod || true
               die "el backend quedó unhealthy" ;;
  esac
  sleep 2
done
[[ "$estado" == "healthy" ]] || die "el backend no llegó a healthy en ~5 min (docker logs jadda_backend_prod)"
web="$(docker inspect -f '{{.State.Running}}' jadda_web_prod 2>/dev/null || echo false)"
[[ "$web" == "true" ]] || die "el nginx del borde (jadda_web_prod) no está corriendo"
say "[OK] backend healthy · nginx del borde activo."

EXIT_CODE=5
if [[ "$SIN_SMOKE" -ne 1 ]]; then
  say "== Smoke post-despliegue (${BASE_URL:-https://localhost}) =="
  if ! bash scripts/smoke-test.sh "${BASE_URL:-https://localhost}"; then
    die "el smoke reportó fallos: revisa los pasos de arriba (logs: docker logs jadda_backend_prod)"
  fi
else
  say "== Smoke omitido (--sin-smoke) =="
fi

say ""
say "══════════════════════════════════════════════════════════════"
say " DESPLIEGUE OK"
say "   App:       ${BASE_URL:-https://localhost}  (Fase A: el navegador avisa del cert self-signed)"
say "   Panel:     ${BASE_URL:-https://localhost}/admin  (con ADMIN_EMAIL/ADMIN_PASSWORD del .env)"
say "   Siguiente: dominio + TLS Fase B → §8 de docs/implantacion/06-despliegue-oracle.md"
say "══════════════════════════════════════════════════════════════"
exit 0
