# ============================================================
# restaurar-backend-tidb.ps1
# Restaura el backend dev a su configuracion ORIGINAL de TiDB Cloud
# (se roto por accidente al recrear el contenedor sin las vars TIDB_*).
#
# Que hace:
#   1. Pide la contrasena de TiDB ENMASCARADA (nunca pasa por chat ni logs).
#   2. Escribe TIDB_HOST / TIDB_PORT / TIDB_USER / TIDB_PASSWORD en el .env
#      de la RAIZ del repo (gitignoreado) para que docker compose interpole
#      SIEMPRE (fix duradero: las vars ya no dependen del shell).
#   3. Recrea jadda_backend con compose y levanta jadda_frontend.
#   4. Espera /health (liveness) hasta ~150 s y muestra /api/health (readiness).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\restaurar-backend-tidb.ps1
# ============================================================

$ErrorActionPreference = "Continue"   # docker escribe progreso en stderr y PS 5.1 lo marca como error nativo

$raiz    = Split-Path -Parent $PSScriptRoot
$envRaiz = Join-Path $raiz ".env"
$compose = Join-Path $raiz "docker-compose.yml"

# Datos NO secretos de la instancia TiDB (ya documentados en AGENTS.md)
$TIDB_HOST = "gateway01.us-west-2.prod.aws.tidbcloud.com"
$TIDB_PORT = "4000"
$TIDB_USER = "32fbrNNoTeU5pBd.root"

Write-Host "=== Restaurar backend dev -> TiDB Cloud ($TIDB_HOST : $TIDB_PORT) ==="

# --- 1. Contrasena enmascarada ---
$secure = Read-Host "Pega la contrasena de TiDB (entrada enmascarada)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$TIDB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ([string]::IsNullOrWhiteSpace($TIDB_PASSWORD)) {
  Write-Host "X Contrasena vacia - cancelado." -ForegroundColor Red
  exit 1
}

# --- 2. Escribir el .env raiz (UTF-8 sin BOM; conserva las demas claves) ---
$lineas = @()
if (Test-Path $envRaiz) {
  $lineas = [IO.File]::ReadAllLines($envRaiz) | Where-Object { $_ -notmatch '^TIDB_(HOST|PORT|USER|PASSWORD)\s*=' }
}
$lineas += "TIDB_HOST=$TIDB_HOST"
$lineas += "TIDB_PORT=$TIDB_PORT"
$lineas += "TIDB_USER=$TIDB_USER"
$lineas += "TIDB_PASSWORD=$TIDB_PASSWORD"
$utf8SinBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($envRaiz, (($lineas -join "`r`n") + "`r`n"), $utf8SinBom)
$TIDB_PASSWORD = $null
Write-Host "OK .env raiz actualizado con TIDB_HOST/PORT/USER/PASSWORD (gitignoreado; el valor no se imprime)"

# --- 3. Recrear el backend con compose (interpola el .env raiz) ---
Write-Host "-> Recreando jadda_backend..."
docker compose -f $compose up -d --force-recreate backend
if ($LASTEXITCODE -ne 0) {
  Write-Host "X docker compose (backend) fallo." -ForegroundColor Red
  exit 1
}

# --- 4. Esperar /health (liveness; la BD puede tardar en despertar) ---
$ok = $false
for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 5 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}
if (-not $ok) {
  Write-Host "! /health no respondio en ~150 s." -ForegroundColor Yellow
  Write-Host "  - Si TiDB estaba hibernando puede tardar hasta ~10-12 min (el backend reintenta el arranque en 5 ciclos con pausa de 30 s)."
  Write-Host "  - Si pegaste la contrasena MAL, el contenedor reinicia en bucle: mira 'docker logs jadda_backend' (Access denied)."
  Write-Host "  Verifica despues con:"
  Write-Host "    docker inspect --format '{{.State.Health.Status}}' jadda_backend"
  Write-Host "    docker compose -f '$compose' up -d frontend"
  exit 2
}
Write-Host "OK /health 200"

# --- 5. Levantar el frontend (depende de backend healthy) ---
docker compose -f $compose up -d frontend

# --- 6. Readiness (/api/health con estado de BD) ---
Start-Sleep -Seconds 2
try {
  $api = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -TimeoutSec 15 -UseBasicParsing
  Write-Host "OK /api/health: $($api.Content)"
} catch {
  Write-Host "! /api/health fallo: $($_.Exception.Message)" -ForegroundColor Yellow
}

$estado = docker inspect --format "{{.State.Health.Status}}" jadda_backend
Write-Host "Health de jadda_backend: $estado"
Write-Host "Listo. Frontend: http://localhost:5173  |  Backend: http://localhost:5000"
