#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  scripts/restaurar.sh — restauración REAL de un dump en la BD (S02 / guía 06 §12)
# ═══════════════════════════════════════════════════════════════════════════
#  Reemplaza las tablas de la BD por el contenido del dump (mysqldump trae
#  DROP TABLE IF EXISTS + CREATE por tabla). Para PROBAR un dump SIN tocar la
#  BD activa usa scripts/verificar-restauracion.sh.
#
#  Uso:
#     bash scripts/restaurar.sh backups/mysql/20261105_010000_jadda_sports_db.sql
#     CONTENEDOR=jadda_mysql bash scripts/restaurar.sh dump.sql     # stack dev
#
#  Variables opcionales:
#     CONTENEDOR      contenedor MySQL (default jadda_mysql_prod)
#     BD              base de datos a restaurar (default jadda_sports_db)
#     BACKEND_CONTENEDORES  contenedores que se DETIENEN durante el import y
#                     se re-levantan al terminar (default "jadda_backend_prod";
#                     en dev: BACKEND_CONTENEDORES=jadda_backend)
#
#  Protecciones: valida tamaño y la línea de cierre del dump, pide escribir
#  la palabra RESTAURAR y detiene el backend para que el app no escriba
#  durante el import. SNAPSHOT del estado previo recomendado: correr antes
#     bash scripts/respaldar.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

CONTENEDOR="${CONTENEDOR:-jadda_mysql_prod}"
BD="${BD:-jadda_sports_db}"
BACKEND_CONTENEDORES="${BACKEND_CONTENEDORES:-jadda_backend_prod}"

[[ $# -ge 1 ]] || { echo "uso: bash scripts/restaurar.sh ARCHIVO_DUMP.sql"; echo "  (opcional: --asumir para saltarse la confirmación interactiva)"; exit 2; }
ASUMIR=0
DUMP=""
for arg in "$@"; do
  case "$arg" in
    --asumir) ASUMIR=1 ;;
    *) DUMP="$arg" ;;
  esac
done
[[ -f "$DUMP" ]] || { echo "[ERROR] no existe el dump: $DUMP" >&2; exit 1; }

echo "══════════════════════════════════════════════════════════════════"
echo "  RESTAURACIÓN de la BD — contenedor=${CONTENEDOR} base=${BD}"
echo "    dump:  ${DUMP}"
echo "    ¡El contenido ACTUAL de ${BD} será REEMPLAZADO por el dump!"
echo "══════════════════════════════════════════════════════════════════"

docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true \
  || { echo "[ERROR] ${CONTENEDOR} no está corriendo." >&2; exit 1; }

TAMANO="$(wc -c < "$DUMP" | tr -d '[:space:]')"
[[ "$TAMANO" -ge 1000 ]] || { echo "[ERROR] el dump pesa ${TAMANO} bytes: parece vacío." >&2; exit 2; }
tail -1 "$DUMP" | grep -q "Dump completed on" \
  || { echo "[ERROR] el dump no tiene la línea de cierre 'Dump completed on' (truncado?)." >&2; exit 2; }

if [[ "$ASUMIR" -ne 1 ]]; then
  read -r -p "Escribe RESTAURAR para confirmar (cualquier otra cosa cancela): " resp
  [[ "$resp" == "RESTAURAR" ]] || { echo "Cancelado: la BD no se tocó."; exit 3; }
fi

# 1. Detener backends activos de la lista (solo los que estén corriendo)
DETENIDOS=()
for c in $BACKEND_CONTENEDORES; do
  if docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null | grep -q true; then
    echo "[..] deteniendo ${c} (evita escrituras durante el import)"
    docker stop "$c" >/dev/null
    DETENIDOS+=("$c")
  fi
done

LIMPIAR_TMP() {
  docker exec "$CONTENEDOR" sh -c 'rm -f /tmp/jadda_restore.sql' >/dev/null 2>&1 || true
}
trap LIMPIAR_TMP EXIT

# 2. Importar (docker cp al anfitrión → /tmp del contenedor → mysql source)
echo "[..] copiando el dump al contenedor..."
docker cp "$DUMP" "$CONTENEDOR:/tmp/jadda_restore.sql"
echo "[..] importando (--default-character-set=utf8mb4) inicio $(date '+%H:%M:%S')..."
TIEMPO="$(date +%s)"
if ! docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -e "source /tmp/jadda_restore.sql" "$1"' _ "$BD"; then
  echo "[ERROR] el import falló: la BD puede quedar parcial — revisa el dump." >&2
  exit 4
fi
LIMPIAR_TMP
DURACION="$(($(date +%s) - TIEMPO))"

# 3. Re-levantar lo detenido
if [[ ${#DETENIDOS[@]} -gt 0 ]]; then
  for c in "${DETENIDOS[@]}"; do
    echo "[..] re-levantando ${c}"
    docker start "$c" >/dev/null
  done
fi

TABLAS="$(docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=$1"' _ "$BD" 2>/dev/null | tr -d '[:space:]')"
echo "══════════════════════════════════════════════════════════════════"
echo "  RESTAURACIÓN OK — ${BD} con ${TABLAS} tablas en ${DURACION}s"
echo "  Backend re-levantado: ${DETENIDOS[*]:-ninguno de la lista estaba corriendo}"
echo "  Sugerencia: docker logs -f jadda_backend_prod (post-restore) + smoke"
echo "══════════════════════════════════════════════════════════════════"
