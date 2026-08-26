# =====================================================================
# JADDA SPORTS - Script de respaldo (backup) completo
# Genera: dump SQL de la base de datos + archivo zip con las imagenes
# subidas (productos/perfiles/retos/devoluciones). Rota respaldos
# antiguos segun la retencion configurada.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -RetencionDias 14
#
# Requisitos: contenedores Docker del proyecto en ejecucion (jadda_mysql).
# Nota tecnica: el dump se genera DENTRO del contenedor y se copia con
# docker cp para preservar los bytes exactos (sin BOM ni re-codificacion).
# =====================================================================
param(
    [int]$RetencionDias = 7,
    [string]$CarpetaDestino = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"
$fecha = Get-Date -Format "yyyyMMdd_HHmmss"
$carpetaMysql    = Join-Path $CarpetaDestino "mysql"
$carpetaImagenes = Join-Path $CarpetaDestino "imagenes"
$logFile = Join-Path $CarpetaDestino "backup.log"

foreach ($c in @($CarpetaDestino, $carpetaMysql, $carpetaImagenes)) {
    if (-not (Test-Path $c)) { New-Item -ItemType Directory -Path $c | Out-Null }
}

function Log([string]$msg) {
    $linea = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $linea
    Add-Content -Path $logFile -Value $linea
}

# ---------- Verificar contenedor ----------
$estado = docker ps --filter "name=jadda_mysql" --format "{{.Status}}" 2>$null
if (-not $estado) {
    Log "ERROR: el contenedor jadda_mysql no esta corriendo. Ejecuta: docker compose up -d"
    exit 1
}
Log "Contenedor jadda_mysql activo ($estado)"

# ---------- 1. Dump de la base de datos ----------
Log "Generando dump SQL (mysqldump --single-transaction)..."
# Se baja temporalmente ErrorActionPreference porque PowerShell 5.1 convierte
# el warning de stderr de mysqldump en error terminante.
$eapAnterior = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker exec jadda_mysql sh -c 'exec mysqldump -uroot -p$MYSQL_ROOT_PASSWORD --single-transaction --routines --triggers jadda_sports_db > /tmp/jadda_dump.sql' 2>$null
$ErrorActionPreference = $eapAnterior
if ($LASTEXITCODE -ne 0) {
    Log "ERROR: mysqldump fallo dentro del contenedor."
    exit 1
}
$sqlTemporal = Join-Path $env:TEMP "jadda_backup_$fecha.sql"
docker cp "jadda_mysql:/tmp/jadda_dump.sql" $sqlTemporal
if (-not (Test-Path $sqlTemporal)) {
    Log "ERROR: no se pudo copiar el dump desde el contenedor."
    exit 1
}

$tamanoDump = (Get-Item $sqlTemporal).Length
if ($tamanoDump -lt 10KB) {
    Log "ERROR: el dump generado es sospechosamente pequeno ($tamanoDump bytes). Revisa credenciales."
    exit 1
}

$zipSql = Join-Path $carpetaMysql "jadda_sports_db_$fecha.zip"
Compress-Archive -Path $sqlTemporal -DestinationPath $zipSql -Force
Remove-Item $sqlTemporal -Force
docker exec jadda_mysql sh -c 'rm -f /tmp/jadda_dump.sql' 2>$null
Log "BD respaldada: $(Split-Path $zipSql -Leaf) ($([math]::Round($tamanoDump/1MB,2)) MB sin comprimir)"

# ---------- 2. Imagenes subidas (viven fuera del volumen MySQL) ----------
$rutaImagenes = Join-Path $PSScriptRoot "..\frontend\public\images"
if (-not (Test-Path $rutaImagenes)) {
    Log "AVISO: no se encontro la carpeta de imagenes ($rutaImagenes); se omite ese respaldo."
} else {
    $zipImg = Join-Path $carpetaImagenes "imagenes_$fecha.zip"
    Compress-Archive -Path (Join-Path $rutaImagenes "*") -DestinationPath $zipImg -Force
    $tamanoZipImg = [math]::Round((Get-Item $zipImg).Length/1MB,2)
    Log "Imagenes respaldadas: $(Split-Path $zipImg -Leaf) ($tamanoZipImg MB)"
}

# ---------- 3. Rotacion: eliminar respaldos mas viejos que RetencionDias ----------
$corte = (Get-Date).AddDays(-$RetencionDias)
foreach ($carpeta in @($carpetaMysql, $carpetaImagenes)) {
    Get-ChildItem $carpeta -Filter *.zip | Where-Object { $_.LastWriteTime -lt $corte } | ForEach-Object {
        Remove-Item $_.FullName -Force
        Log "Rotacion: eliminado $($_.Name) (mas de $RetencionDias dias)"
    }
}

Log "Backup completado con exito."
exit 0
