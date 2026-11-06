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
#
#  Retención opcional (guía 06 §12): exporta RETENER_DIAS=<entero> para que
#  tras un respaldo exitoso se BORREN los dumps de ESA base de datos
#  (patrón *_<BD>.sql de DIR_RESPALDO) con fecha anterior a N días.
#  Sin la variable NO se borra nada. Ejecutar:
#     RETENER_DIAS=7 bash scripts/respaldar.sh
#     RETENER_DIAS=7 CONTENEDOR=jadda_mysql_prod bash scripts/respaldar.sh
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
if [[ "$TAMANO" -lt 1000 ]]; then
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

# ------- Retención opcional: purga dumps antiguos de ESTA base de datos -------
if [[ -n "${RETENER_DIAS:-}" ]]; then
  if [[ ! "$RETENER_DIAS" =~ ^[0-9]+$ ]] || [[ "$RETENER_DIAS" -eq 0 ]]; then
    echo "[AVISO] RETENER_DIAS='${RETENER_DIAS}' no es un entero positivo: no se purga nada."
  else
    LIMITE="$(($(date -u +%s) - RETENER_DIAS * 86400))"
    PURGADOS=0
    REVISADOS=0
    shopt -s nullglob
    for f in "${DIR_RESPALDO}"/*_"${BD}".sql; do
      STAMPS="${f##*/}"
      STAMPS="${STAMPS%%_*}"
      # Solo nombres con la convención AAAAMMDD_HHMM_SS del propio script
      [[ "$STAMPS" =~ ^[0-9]{8}$ ]] || continue
      TS="$(date -ud "${STAMPS:0:4}-${STAMPS:4:2}-${STAMPS:6:2} 00:00:00" +%s 2>/dev/null)" || continue
      REVISADOS=1
      if [[ "$TS" -lt "$LIMITE" ]]; then
        rm -f -- "$f" && PURGADOS=$((PURGADOS + 1))
      fi
    done
    shopt -u nullglob
    if [[ "$REVISADOS" -eq 1 ]]; then
      echo "[OK]    Retención RETENER_DIAS=${RETENER_DIAS}: dumps antiguos de ${BD} purgados: ${PURGADOS}"
    else
      echo "[AVISO] Retención RETENER_DIAS=${RETENER_DIAS}: sin dumps con nombre de fecha en ../${DIR_RESPALDO}"
    fi
  fi
fi
