#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  scripts/verificar-restauracion.sh — PROBAR un dump sin tocar la BD activa
# ═══════════════════════════════════════════════════════════════════════════
#  Importa el dump en una BD TEMPORAL de EFÍMERA dentro del mismo contenedor
#  de MySQL y la compara contra la BD real (mismo conjunto de tablas y, por
#  tabla común, COUNT(*) exacto). Al final SIEMPRE borra la BD temporal:
#  el volumen/productivo queda intacto.
#
#  Uso (recomendado: correr justo después de generar el dump, con tráfico
#  detenido, para que el conteo de filas no se mueva del estado del dump):
#     bash scripts/verificar-restauracion.sh backups/mysql/<fecha>_jadda_sports_db.sql
#     CONTENEDOR=jadda_mysql bash scripts/verificar-restauracion.sh dump.sql   # dev
#
#  Variables opcionales:
#     CONTENEDOR   default jadda_mysql_prod
#     BD           default jadda_sports_db
#
#  Salida: 0 = conjunto de tablas idéntico (+ filas idénticas, si hubo); 1 =
#  tablas (o filas, con --estricto-filas); 2 = error operacional.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

CONTENEDOR="${CONTENEDOR:-jadda_mysql_prod}"
BD="${BD:-jadda_sports_db}"
STRICTO_FILAS=0

usage() { echo "uso: bash scripts/verificar-restauracion.sh ARCHIVO_DUMP.sql [--estricto-filas]"; exit 2; }
[[ $# -ge 1 ]] || usage
DUMP=""; ASUMIR=0
for arg in "$@"; do
  case "$arg" in
    --estricto-filas) STRICTO_FILAS=1 ;;
    --asumir) ASUMIR=1 ;;
    -h|--help) sed -n '/^#  Uso/,/^#  Salida/p' "$0" | sed 's/^#//'; exit 0 ;;
    *) DUMP="$arg" ;;
  esac
done
[[ -f "$DUMP" ]] || { echo "[ERROR] no existe el dump: $DUMP" >&2; exit 2; }

docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true \
  || { echo "[ERROR] ${CONTENEDOR} no está corriendo." >&2; exit 2; }

TAMANO="$(wc -c < "$DUMP" | tr -d '[:space:]')"
[[ "$TAMANO" -ge 1000 ]] || { echo "[ERROR] el dump pesa ${TAMANO} bytes: parece vacío." >&2; exit 2; }
tail -1 "$DUMP" | grep -q "Dump completed on" \
  || { echo "[ERROR] el dump no cierra con 'Dump completed on' (truncado?)." >&2; exit 2; }

if [[ "$ASUMIR" -ne 1 ]]; then
  echo "El dump se probará en una BD TEMPORAL y se BORRARÁ al final; la BD activa NO se toca."
  read -r -p "Escribe VERIFICAR para continuar: " resp
  [[ "$resp" == "VERIFICAR" ]] || { echo "Cancelado."; exit 3; }
fi

TMP_BD="${BD}_restcheck_$$"
LIMPIAR_TODO() {
  docker exec "$CONTENEDOR" sh -c 'rm -f /tmp/jadda_verify.sql' >/dev/null 2>&1 || true
  docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS $1"' _ "$TMP_BD" >/dev/null 2>&1 || true
}
trap LIMPIAR_TODO EXIT

echo "[..] importando el dump en BD temporal ${TMP_BD}..."
docker cp "$DUMP" "$CONTENEDOR:/tmp/jadda_verify.sql"
if ! docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -e "CREATE DATABASE $1 CHARACTER SET utf8mb4"' _ "$TMP_BD"; then
  echo "[ERROR] no se pudo crear la BD temporal" >&2; exit 2
fi
if ! docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -e "use $1; source /tmp/jadda_verify.sql"' _ "$TMP_BD" >/dev/null; then
  echo "[ERROR] el import en la BD temporal falló (el dump está inconsistente)" >&2
  exit 2
fi
docker exec "$CONTENEDOR" sh -c 'rm -f /tmp/jadda_verify.sql' >/dev/null 2>&1 || true

# ── Conjunto de tablas: real vs dump ──
TABLAS_REAL="$(docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=$1 ORDER BY TABLE_NAME"' _ "$BD")"
TABLAS_TEMP="$(docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=$1 ORDER BY TABLE_NAME"' _ "$TMP_BD")"

DIFERENCIAS="$(comm -3 <(echo "$TABLAS_REAL") <(echo "$TABLAS_TEMP") || true)"
if [[ -z "$(echo -n "$DIFERENCIAS" | tr -d '[:space:]')" ]]; then
  echo "[OK] conjunto de tablas idéntico: $(echo "$TABLAS_TEMP" | grep -c .) tablas"
else
  echo "[FAIL] el conjunto de tablas difiere (izquierda='solo en ${BD}', derecha='solo en dump'):"
  echo "$DIFERENCIAS"
  exit 1
fi

# ── Filas por tabla (COUNT(*) real) ──
IMPAR=0; RESUMEN=""
while IFS= read -r tabla; do
  [[ -n "$tabla" ]] || continue
  c_real="$(docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM $1.$2"' _ "$BD" "$tabla" 2>/dev/null)"
  c_temp="$(docker exec "$CONTENEDOR" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM $1.$2"' _ "$TMP_BD" "$tabla" 2>/dev/null)"
  if [[ "$c_real" == "$c_temp" ]]; then
    RESUMEN+="  ${tabla}: ${c_temp} filas ✓"$'\n'
  else
    IMPAR=1
    RESUMEN+="  ${tabla}: dump=${c_temp} vs activa=${c_real} ✗"$'\n'
  fi
done < <(echo "$TABLAS_TEMP")

echo "Comparación de filas por tabla:"
printf '%s' "$RESUMEN"
if [[ "$IMPAR" -eq 1 ]]; then
  if [[ "$STRICTO_FILAS" -eq 1 ]]; then
    echo "[FAIL] filas distintas (--estricto-filas). Corre la verificación con tráfico detenido tras generar el dump."
    exit 1
  fi
  echo "[AVISO] filas distintas: si la app escribió entre el dump y el check es ESPERADO. Re-corre con --estricto-filas tras respaldar con tráfico detenido."
else
  echo "[OK] filas idénticas en TODAS las tablas: el dump restaura 1:1 el estado activo."
fi
exit 0
