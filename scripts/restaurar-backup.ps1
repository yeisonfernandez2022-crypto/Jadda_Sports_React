# =====================================================================
# JADDA SPORTS - Restaurar un respaldo de base de datos
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\restaurar-backup.ps1 -RutaBackup backups\mysql\jadda_sports_db_20260824_120000.zip
#   # Probar el respaldo en una BD temporal (sin tocar la real):
#   powershell -ExecutionPolicy Bypass -File scripts\restaurar-backup.ps1 -RutaBackup <archivo.zip> -BaseDatosPrueba jadda_restore_test
#
# Advertencia: restaurar sobre jadda_sports_db REEMPLAZA todos los datos
# actuales por el contenido del respaldo.
# Nota tecnica: el .sql se copia al contenedor con docker cp y se importa
# desde ahi (transferencia byte-perfecta, sin re-codificacion).
# =====================================================================
param(
    [Parameter(Mandatory = $true)][string]$RutaBackup,
    [string]$BaseDatosPrueba = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RutaBackup)) {
    Write-Host "ERROR: no existe el archivo $RutaBackup" -ForegroundColor Red
    exit 1
}

function Invoke-DockerSh([string]$comando) {
    # Ejecuta un comando sh dentro de jadda_mysql y devuelve un objeto con
    # el codigo de salida y la salida estandar, sin que los warnings de
    # stderr (password en CLI) detengan el script.
    $eapAnterior = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $salida = docker exec jadda_mysql sh -c $comando 2>$null
    $codigo = $LASTEXITCODE
    $ErrorActionPreference = $eapAnterior
    return [pscustomobject]@{ Codigo = $codigo; Salida = @($salida) }
}

# Extraer el .sql si viene comprimido
$sqlTemporal = Join-Path $env:TEMP "jadda_restore.sql"
if ($RutaBackup -like "*.zip") {
    Write-Host "Extrayendo $RutaBackup ..."
    $carpetaExt = Join-Path $env:TEMP ("jadda_restore_ext_" + [guid]::NewGuid().ToString("N").Substring(0,8))
    Expand-Archive -Path $RutaBackup -DestinationPath $carpetaExt -Force
    $extraido = Get-ChildItem $carpetaExt -Filter "*.sql" | Select-Object -First 1
    if (-not $extraido) {
        Write-Host "ERROR: el zip no contiene un dump .sql." -ForegroundColor Red
        exit 1
    }
    Move-Item $extraido.FullName $sqlTemporal -Force
    Remove-Item $carpetaExt -Recurse -Force
} else {
    Copy-Item $RutaBackup $sqlTemporal -Force
}

$destino = if ($BaseDatosPrueba -ne "") { $BaseDatosPrueba } else { "jadda_sports_db" }

# Validar el nombre de BD (solo letras/numeros/guion bajo) para poder
# interpolarlo seguro en los comandos sh del contenedor.
if ($destino -notmatch '^[A-Za-z0-9_]+$') {
    Write-Host "ERROR: nombre de base de datos invalido: $destino" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host " Se va a RESTAURAR el respaldo en la base de datos: $destino"
if ($BaseDatosPrueba -eq "") { Write-Host " ADVERTENCIA: los datos actuales seran REEMPLAZADOS." -ForegroundColor Red }
Write-Host " Archivo: $RutaBackup"
Write-Host "=============================================================" -ForegroundColor Yellow
$resp = Read-Host "Escribe SI para continuar"
if ($resp -ne "SI") { Write-Host "Cancelado."; Remove-Item $sqlTemporal -Force -ErrorAction SilentlyContinue; exit 0 }

# IMPORTANTE (PowerShell 5.1): al pasar argumentos a docker.exe se pierden
# las comillas dobles internas del string, por eso todo SQL va entre
# comillas SIMPLES de sh ([char]39) y la contrasena se expande sin
# comillas (-p$VAR). Se construyen DESPUES de validar $destino.
$q = [char]39
$crearBd      = "exec mysql -uroot -p`$MYSQL_ROOT_PASSWORD -e ${q}CREATE DATABASE IF NOT EXISTS $destino${q}"
$importar     = "exec mysql -uroot -p`$MYSQL_ROOT_PASSWORD $destino < /tmp/jadda_restore.sql"
# Conteo de tablas sin literales de string en SQL (USE/SHOW TABLES evitan
# el problema de escapar comillas alrededor del nombre).
$contarTablas = "exec mysql -uroot -p`$MYSQL_ROOT_PASSWORD -N -e ${q}USE $destino; SHOW TABLES${q}"

# Crear la BD destino si no existe (necesario para pruebas)
$rCrear = Invoke-DockerSh $crearBd
if ($rCrear.Codigo -ne 0) {
    Write-Host "ERROR: no se pudo crear/verificar la BD '$destino' (codigo $($rCrear.Codigo))" -ForegroundColor Red
    exit 1
}

# Copiar el dump dentro del contenedor e importarlo
docker cp $sqlTemporal "jadda_mysql:/tmp/jadda_restore.sql"
$rImport = Invoke-DockerSh $importar
if ($rImport.Codigo -ne 0) {
    Write-Host "ERROR: mysql devolvio codigo $($rImport.Codigo)" -ForegroundColor Red
    [void](Invoke-DockerSh 'rm -f /tmp/jadda_restore.sql')
    exit 1
}
[void](Invoke-DockerSh 'rm -f /tmp/jadda_restore.sql')

$rContar = Invoke-DockerSh $contarTablas
$totalTablas = @($rContar.Salida | Where-Object { $_ -and $_.Trim() }).Count
Write-Host ""
Write-Host "Restauracion completada. Tablas en '$destino': $totalTablas" -ForegroundColor Green

if ($BaseDatosPrueba -ne "") {
    Write-Host "(BD de prueba: eliminandola para dejar todo limpio...)"
    [void](Invoke-DockerSh ("exec mysql -uroot -p`$MYSQL_ROOT_PASSWORD -e ${q}DROP DATABASE IF EXISTS $BaseDatosPrueba${q}"))
}
Remove-Item $sqlTemporal -Force -ErrorAction SilentlyContinue
exit 0
