#!/usr/bin/env bash
# ============================================================================
#  JADDA SPORTS — scripts/respaldar.sh  (Entregable S02, adaptado de la práctica 01)
#  Respaldo lógico de la base de datos con mysqldump, corriendo DENTRO del
#  contenedor MySQL y trayendo el dump al anfitrión por stdout.
#  Equivalencia con la práctica 01 (PostgreSQL/pg_dump -Fc): aquí es MySQL/InnoDB.
#
#  Uso:
#     bash scripts/respaldar.sh [archivo_salida] [base_datos]
#     (por defecto: backups/mysql/<fecha>_jadda_sports_db.sql)
#
#  Contraseñas: se leen del propio contenedor (MYSQL_ROOT_PASSWORD), no se
#  escriben en el script ni en el historial de comandos.
# ============================================================================
set -euo pipefail

CONTENEDOR="${CONTENEDOR:-jadda_mysql}"
BD="${2:-${BD:-jadda_sports_db}}"
DIR_RESPALDO="${DIR_RESPALDO:-backups/mysql}"
FECHA="$(date +%Y%m%d_%H%M%S)"
ARCHIVO="${1:-${DIR_RESPALDO}/${FECHA}_${BD}.sql}"

echo "== JADDA SPORTS — RESPALDO DE BASE DE DATOS (S02) =="
echo "Contenedor: ${CONTENEDOR}  Base: ${BD}"

if ! docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true; then
  echo "[ERROR] El contenedor ${CONTENEDOR} no está corriendo (docker compose up -d)." >&2
  exit 1
fi

mkdir -p "$DIR_RESPALDO"
T0=$(date +%s)

# mysqldump dentro del contenedor; el STDIN/STDOUT fluye al anfitrión.
docker exec "$CONTENEDOR" sh -c 'exec mysqldump --single-transaction --routines --triggers --events -uroot -p"$MYSQL_ROOT_PASSWORD" "$1"' _ "$BD" > "$ARCHIVO"

T1=$(date +%s)
DURACION=$((T1 - T0))

# ------- Validación mínima de integridad -------
TAMANO=$(stat -c%s "$ARCHIVO" 2>/dev/null || wc -c < "$ARCHIVO" | tr -d ' ')
if [ "$TAMANO" -lt 1000 ]; then
  echo "[ERROR] El dump parece vacío (${TAMANO} bytes)." >&2
  exit 2
fi
if ! tail -1 "$ARCHIVO" | grep -q "Dump completed on"; then
  echo "[ERROR] El dump no tiene línea de cierre 'Dump completed on' (posible truncamiento)." >&2
  exit 3
fi
TABLAS=$(grep -c "^CREATE TABLE" "$ARCHIVO" || true)

SHA=$(sha256sum "$ARCHIVO" | cut -d' ' -f1)

echo "[OK]    Dump generado: ${ARCHIVO}"
echo "[OK]    Tamaño: ${TAMANO} bytes | CREATE TABLE: ${TABLAS} | Duración: ${DURACION}s"
echo "[OK]    SHA-256: ${SHA}"
echo "Cierre de verificación: $(tail -1 "$ARCHIVO")"
