#!/usr/bin/env bash
# =============================================================================
# JADDA SPORTS - Verificación de requisitos mínimos (Entregable S01)
#
# Uso:
#   bash scripts/verificar-requisitos.sh
#   MIN_CPU=4 MIN_RAM_GB=8 MIN_DISK_GB=40 bash scripts/verificar-requisitos.sh
#
# Verifica CPU, RAM, disco, arquitectura, sistema operativo, Docker/Compose,
# archivos base del repositorio y, si los contenedores están arriba, los
# servicios y puertos de la plataforma. No modifica el sistema.
#
# Salida: código 0 si no hay fallos; 1 si algún requisito obligatorio falla.
# =============================================================================
set -u

MIN_CPU="${MIN_CPU:-4}"
MIN_RAM_GB="${MIN_RAM_GB:-8}"
MIN_DISK_GB="${MIN_DISK_GB:-40}"
MIN_DOCKER_MAJOR="${MIN_DOCKER_MAJOR:-24}"
MIN_COMPOSE_MAJOR="${MIN_COMPOSE_MAJOR:-2}"

if [ -t 1 ]; then
  VERDE="\033[0;32m"; AMARILLO="\033[0;33m"; ROJO="\033[0;31m"; AZUL="\033[0;36m"; SIN="\033[0m"
else
  VERDE=""; AMARILLO=""; ROJO=""; AZUL=""; SIN=""
fi

OK=0
WARN=0
FAIL=0

ok()   { OK=$((OK + 1));   printf "  ${VERDE}[OK]${SIN}   %s\n" "$1"; }
warn() { WARN=$((WARN + 1)); printf "  ${AMARILLO}[AVISO]${SIN} %s\n" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf "  ${ROJO}[FALLA]${SIN} %s\n" "$1"; }
info() { printf "  ${AZUL}[INFO]${SIN}  %s\n" "$1"; }
seccion() { printf "\n${AZUL}%s${SIN}\n" "$1"; }

mayor_que() {
  # $1 = versión instalada, $2 = mínimo; devuelve 0 si instalada >= mínimo
  awk -v a="$1" -v b="$2" 'BEGIN { exit (a + 0 >= b + 0) ? 0 : 1 }'
}

es_windows() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

leer_version_docker() {
  docker --version 2>/dev/null | sed -E 's/.*version ([0-9]+(\.[0-9]+)*).*/\1/'
}

leer_version_compose() {
  docker compose version --short 2>/dev/null | sed -E 's/^v?([0-9]+(\.[0-9]+)*).*/\1/'
}

contenedor_activo() {
  command -v docker >/dev/null 2>&1 || return 1
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$1"
}

puerto_escucha() {
  local puerto="$1"
  if es_windows; then
    netstat -ano 2>/dev/null | awk '$4 == "LISTENING" { print $2 }' | grep -Eq "[:.]${puerto}$"
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk 'NR > 1 { print $4 }' | grep -Eq "[:.]${puerto}$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk 'NR > 2 { print $4 }' | grep -Eq "[:.]${puerto}$"
  else
    return 2
  fi
}

http_ok() {
  local url="$1"
  local timeout="${2:-10}"
  command -v curl >/dev/null 2>&1 || return 2
  curl -fsS -o /dev/null --max-time "$timeout" "$url" 2>/dev/null
}

printf "=====================================================================\n"
printf " JADDA SPORTS - VERIFICACION DE REQUISITOS MINIMOS (S01)\n"
printf " Fecha: %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
printf " Equipo: %s\n" "${JADDA_HOST_LABEL:-$(hostname 2>/dev/null || echo 'no disponible')}"
printf "=====================================================================\n"
printf " Umbrales: CPU >= %s nucleos | RAM >= %s GB | Disco libre >= %s GB\n" \
  "$MIN_CPU" "$MIN_RAM_GB" "$MIN_DISK_GB"
printf "           Docker >= %s | Docker Compose >= v%s\n" \
  "$MIN_DOCKER_MAJOR" "$MIN_COMPOSE_MAJOR"

# -----------------------------------------------------------------------------
seccion "1. Sistema operativo y arquitectura"
# -----------------------------------------------------------------------------
UNAME_S="$(uname -s 2>/dev/null || echo desconocido)"
ARQ="$(uname -m 2>/dev/null || echo desconocida)"
KERNEL="$(uname -r 2>/dev/null || echo desconocido)"

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  SO="${PRETTY_NAME:-$UNAME_S}"
elif es_windows && command -v powershell.exe >/dev/null 2>&1; then
  SO="$(powershell.exe -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption" 2>/dev/null | tr -d '\r')"
  BUILD="$(powershell.exe -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).BuildNumber" 2>/dev/null | tr -d '\r')"
  SO="${SO:-Windows} build ${BUILD:-desconocido}"
else
  SO="$UNAME_S"
fi

info "Sistema operativo: $SO"
if es_windows; then
  info "Arquitectura: $ARQ | Entorno de script: Git Bash/MSYS2"
else
  info "Arquitectura: $ARQ | Kernel: $KERNEL"
fi

case "$ARQ" in
  x86_64|amd64|AMD64) ok "Arquitectura x86-64 soportada" ;;
  *) fail "Arquitectura '$ARQ' no soportada (se requiere x86-64)" ;;
esac

if [ "$UNAME_S" = "Linux" ] || es_windows; then
  ok "Plataforma compatible con Docker (Linux/WSL2 o Windows con Docker Desktop)"
else
  warn "Plataforma '$UNAME_S' no es la objetivo; verifique compatibilidad de Docker"
fi

# -----------------------------------------------------------------------------
seccion "2. Procesador"
# -----------------------------------------------------------------------------
if command -v nproc >/dev/null 2>&1; then
  CPU="$(nproc)"
elif command -v getconf >/dev/null 2>&1; then
  CPU="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 0)"
else
  CPU=0
fi
info "Nucleos logicos disponibles: $CPU"
if [ "$CPU" -ge "$MIN_CPU" ]; then
  ok "CPU cumple el minimo (>= $MIN_CPU nucleos)"
else
  fail "CPU insuficiente: $CPU < $MIN_CPU nucleos"
fi

# -----------------------------------------------------------------------------
seccion "3. Memoria RAM"
# -----------------------------------------------------------------------------
RAM_GB=""
if [ -r /proc/meminfo ]; then
  RAM_KB="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
  [ -n "$RAM_KB" ] && RAM_GB="$(awk -v kb="$RAM_KB" 'BEGIN { printf "%.1f", kb / 1024 / 1024 }')"
elif es_windows && command -v powershell.exe >/dev/null 2>&1; then
  RAM_GB="$(powershell.exe -NoProfile -Command "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)" 2>/dev/null | tr -d '\r')"
elif command -v sysctl >/dev/null 2>&1; then
  RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  RAM_GB="$(awk -v b="$RAM_BYTES" 'BEGIN { printf "%.1f", b / 1024 / 1024 / 1024 }')"
fi

if [ -n "$RAM_GB" ] && [ "$RAM_GB" != "0" ]; then
  info "RAM total: ${RAM_GB} GB"
  if mayor_que "$RAM_GB" "$MIN_RAM_GB"; then
    ok "RAM cumple el minimo (>= ${MIN_RAM_GB} GB)"
  else
    fail "RAM insuficiente: ${RAM_GB} GB < ${MIN_RAM_GB} GB"
  fi
else
  fail "No fue posible detectar la memoria RAM total"
fi

# -----------------------------------------------------------------------------
seccion "4. Disco"
# -----------------------------------------------------------------------------
DISCO_KB="$(df -Pk . 2>/dev/null | awk 'NR == 2 { print $4 }')"
if [ -n "${DISCO_KB:-}" ]; then
  DISCO_GB="$(awk -v kb="$DISCO_KB" 'BEGIN { printf "%.1f", kb / 1024 / 1024 }')"
  info "Espacio libre en la unidad del repositorio: ${DISCO_GB} GB"
  if mayor_que "$DISCO_GB" "$MIN_DISK_GB"; then
    ok "Disco cumple el minimo (>= ${MIN_DISK_GB} GB libres)"
  else
    fail "Disco insuficiente: ${DISCO_GB} GB libres < ${MIN_DISK_GB} GB"
  fi
else
  fail "No fue posible determinar el espacio libre en disco"
fi

# -----------------------------------------------------------------------------
seccion "5. Docker y Docker Compose"
# -----------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  DOCKER_VERSION="$(leer_version_docker)"
  DOCKER_MAJOR="${DOCKER_VERSION%%.*}"
  info "Docker CLI: ${DOCKER_VERSION:-desconocida}"
  if mayor_que "$DOCKER_MAJOR" "$MIN_DOCKER_MAJOR"; then
    ok "Docker cumple el minimo (>= ${MIN_DOCKER_MAJOR})"
  else
    fail "Docker insuficiente: ${DOCKER_VERSION} (minimo ${MIN_DOCKER_MAJOR})"
  fi

  if docker info >/dev/null 2>&1; then
    ok "Docker daemon disponible"
  else
    fail "Docker daemon no responde (inicie Docker Desktop/servicio)"
  fi

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_VERSION="$(leer_version_compose)"
    COMPOSE_MAJOR="${COMPOSE_VERSION%%.*}"
    info "Docker Compose: v${COMPOSE_VERSION:-desconocida}"
    if mayor_que "$COMPOSE_MAJOR" "$MIN_COMPOSE_MAJOR"; then
      ok "Docker Compose cumple el minimo (>= v${MIN_COMPOSE_MAJOR})"
    else
      fail "Docker Compose insuficiente: v${COMPOSE_VERSION} (minimo v${MIN_COMPOSE_MAJOR})"
    fi
  else
    fail "Docker Compose no disponible (plugin 'docker compose')"
  fi
else
  fail "Docker no esta instalado o no esta en el PATH"
fi

# -----------------------------------------------------------------------------
seccion "6. Archivos base del repositorio"
# -----------------------------------------------------------------------------
for archivo in \
  docker-compose.yml \
  backend/package.json \
  backend/database/setup.js \
  backend/.env.example \
  frontend/package.json \
  frontend/public/images \
  scripts/backup.ps1 \
  scripts/verificar-requisitos.sh; do
  if [ -e "$archivo" ]; then
    ok "Existe $archivo"
  else
    fail "Falta $archivo"
  fi
done

if [ -f backend/.env ]; then
  ok "Existe backend/.env (configuracion local)"
else
  warn "No existe backend/.env; copielo de backend/.env.example antes de desplegar"
fi

if [ -f backend/.env ] && grep -Eq '^CLOUDINARY_URL=cloudinary://' backend/.env; then
  info "CLOUDINARY_URL configurada (almacenamiento en la nube)"
elif [ -n "${CLOUDINARY_URL:-}" ]; then
  info "CLOUDINARY_URL definida en el entorno"
else
  info "Cloudinary no configurado; las subidas usaran almacenamiento local"
fi

# -----------------------------------------------------------------------------
seccion "7. Servicios y puertos de JADDA (si estan desplegados)"
# -----------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  for contenedor in jadda_mysql jadda_backend jadda_frontend; do
    if contenedor_activo "$contenedor"; then
      ok "Contenedor $contenedor activo"
    else
      warn "Contenedor $contenedor no esta activo"
    fi
  done

  if contenedor_activo jadda_mysql; then
    MYSQL_VERSION="$(docker exec jadda_mysql mysql --version 2>/dev/null | sed -E 's/.*Ver ([0-9]+(\.[0-9]+)*).*/\1/')"
    [ -n "$MYSQL_VERSION" ] && info "MySQL: $MYSQL_VERSION" || warn "No se pudo leer la version de MySQL"
  fi

  if contenedor_activo jadda_backend; then
    NODE_VERSION="$(docker exec jadda_backend node --version 2>/dev/null | tr -d 'v\r')"
    [ -n "$NODE_VERSION" ] && info "Node.js (backend): $NODE_VERSION" || warn "No se pudo leer la version de Node.js"
  fi

  if http_ok "http://localhost:5173/" 75; then
    ok "Frontend responde en http://localhost:5173"
  else
    warn "Frontend no responde en :5173"
  fi

  if http_ok "http://localhost:5173/api/productos" 10; then
    ok "API responde a traves del proxy en /api/productos"
  else
    warn "API no responde a traves del proxy en :5173/api/productos"
  fi
else
  info "Docker no disponible: se omite la verificacion de servicios"
fi

for puerto in 5173 5000 3306; do
  if puerto_escucha "$puerto"; then
    info "Puerto $puerto: en escucha"
  else
    info "Puerto $puerto: libre o no detectable"
  fi
done

# -----------------------------------------------------------------------------
seccion "RESUMEN"
# -----------------------------------------------------------------------------
printf "  OK: %s | AVISOS: %s | FALLAS: %s\n" "$OK" "$WARN" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf "  ${VERDE}RESULTADO: CUMPLE LOS REQUISITOS MINIMOS${SIN}\n"
  [ "$WARN" -gt 0 ] && printf "  ${AMARILLO}(revise los avisos antes de desplegar)${SIN}\n"
  exit 0
else
  printf "  ${ROJO}RESULTADO: NO CUMPLE - corrija los requisitos marcados como FALLA${SIN}\n"
  exit 1
fi
