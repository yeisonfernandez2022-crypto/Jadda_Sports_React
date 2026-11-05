#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  scripts/smoke-test.sh — comprobación de vida POST-despliegue (S04, paso 5)
# ═══════════════════════════════════════════════════════════════════════════
#  Revisa "aterrizaje" básico sin tocar datos ni necesidad de credenciales:
#    1. SPA          GET  $BASE_URL/                    → 200 y contiene id="root"
#    2. API catálogo GET  $BASE_URL/api/productos       → 200 y respuesta {ok:true}
#    3. Catálogos    GET  $BASE_URL/api/productos/categorias → 200
#    4. Login        POST $BASE_URL/api/auth/login       → 400/401 (rechaza malas)
#    5. Health       GET  $BACKEND_URL/health           → 200 (solo si se passes)
#  Solo depende de curl y grep (no de jq). Exit 0 si TODO pasa, 1 SI NO.
#
#  Uso:
#    bash scripts/smoke-test.sh https://TU_DOMINIO
#    bash scripts/smoke-test.sh https://mi-tienda.example.com \
#         https://api.mi-tienda.example.com
# ═══════════════════════════════════════════════════════════════════════════

set -u

if [ $# -lt 1 ]; then
  echo "uso: bash scripts/smoke-test.sh BASE_URL [BACKEND_URL]"
  echo "  BASE_URL     URL pública del SPA (front). Para la topología"
  echo "               clásica con nginx de borde, la MISMA raíz vale para API."
  echo "  BACKEND_URL  (opcional) Solo si el backend escucha en otra raíz"
  echo "               (topología de 2 raíces: SPA y API en dominios distintos)"
  exit 2
fi

BASE_URL="$1"
# Quita la barra final (evita dobles slashes al construir las rutas)
BASE_URL="${BASE_URL%/}"
BACKEND_URL=""
[ $# -ge 2 ] && BACKEND_URL="${2%/}"

pasa=0
falla=0

paso() {
  local texto="$1"
  if [ "$2" = "ok" ]; then
    pasa=$((pasa+1))
    echo "  [OK] $texto"
  else
    falla=$((falla+1))
    echo "  [FAIL] $texto"
  fi
}

echo "── smoke-test $BASE_URL ──"

# ── 1. SPA ──────────────────────────────────────────────────────────────────
codigo=$(curl -sk -o /dev/null -w '%{http_code}' "$BASE_URL/")
if [ "$codigo" = "200" ]; then
  paso "SPA responde 200" ok
else
  paso "SPA responde 200 (obtuvimos HTTP $codigo)" fal
fi
raiz=$(curl -sk "$BASE_URL/" | grep -c 'id="root"' || true)
if [ "${raiz:-0}" -ge 1 ]; then
  paso "servida: index con <div id=root> montado" ok
else
  paso "servida: index sin <div id=root> (¿dist preliminar?)" fal
fi

# ── 2. API de productos por el proxy ───────────────────────────────────────
codigo=$(curl -sk -o /dev/null -w '%{http_code}' "$BASE_URL/api/productos")
if [ "$codigo" = "200" ]; then
  paso "/api/productos 200" ok
else
  paso "/api/productos 200 (obtuvimos HTTP $codigo)" fal
fi
okflag=$(curl -sk "$BASE_URL/api/productos" | grep -c '"NOMBRE"' || true)
if [ "${okflag:-0}" -ge 1 ]; then
  paso "respuesta del API con productos ([] , formato del endpoint)" ok
else
  paso "respuesta del API con productos (no se ven NOMBRE — revisa logs del backend)" fal
fi

# ── 3. Catálogos ────────────────────────────────────────────────────────────
codigo=$(curl -sk -o /dev/null -w '%{http_code}' "$BASE_URL/api/productos/categorias")
if [ "$codigo" = "200" ]; then
  paso "/api/productos/categorias 200" ok
else
  paso "/api/productos/categorias 200 (obtuvimos HTTP $codigo)" fal
fi

# ── 4. login con credenciales erradas (debe RECHAZAR → 400/401) ────────────
codigo=$(curl -sk -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke.no.existe@prueba.invalid","password":"ClaveErrada123"}' \
  "$BASE_URL/api/auth/login")
if [ "$codigo" = "401" ] || [ "$codigo" = "400" ]; then
  paso "login rechaza credenciales erradas (HTTP $codigo)" ok
else
  paso "login rechaza credenciales erradas (obtuvimos HTTP $codigo — esperamos 400/401)" fal
fi

# ── 5. health del backend (solo si se pasa BACKEND_URL separado) ───────────
if [ -n "$BACKEND_URL" ]; then
  codigo=$(curl -sk -o /dev/null -w '%{http_code}' "$BACKEND_URL/health")
  if [ "$codigo" = "200" ]; then
    paso "backend /health 200" ok
  else
    paso "backend /health 200 (obtuvimos HTTP $codigo — el servicio puede estar arrancando; reintenta en ~30 s)" fal
  fi
fi

echo "── smoke-test terminó: $pasa OK / $falla FAIL ──"
if [ "$falla" -gt 0 ]; then
  exit 1
fi
exit 0
