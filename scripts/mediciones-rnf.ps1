# =====================================================================
# JADDA SPORTS - Mediciones de rendimiento (RNF) de endpoints clave
# Mide tiempos de respuesta reales contra el despliegue local (Docker)
# y genera un informe markdown en docs\calidad\resultados-mediciones.md
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\mediciones-rnf.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\mediciones-rnf.ps1 -Iteraciones 20
#
# Requisitos: frontend (5173) y backend (5000) en ejecucion.
# Credenciales admin: variables de entorno ADMIN_EMAIL/ADMIN_PASSWORD o
# los valores por defecto del seed.
# =====================================================================
param(
    [int]$Iteraciones = 10,
    [string]$FrontUrl = "http://localhost:5173",
    [string]$BackUrl = "http://localhost:5000"
)

$ErrorActionPreference = "Continue"
$adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { "yeison" }
$adminPass = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { "Losquiero7" }

function Medir-Endpoint {
    param([string]$Nombre, [scriptblock]$Accion, [int]$N)
    # Calentamiento (no se mide: JIT/caches/primera conexion)
    try { & $Accion | Out-Null } catch {}
    $tiempos = @()
    for ($i = 0; $i -lt $N; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try { & $Accion | Out-Null } catch {
            Write-Host "  AVISO: iteracion $($i+1) de '$Nombre' fallo: $($_.Exception.Message)" -ForegroundColor Yellow
        }
        $sw.Stop()
        $tiempos += $sw.Elapsed.TotalMilliseconds
        Start-Sleep -Milliseconds 120
    }
    $ordenadas = $tiempos | Sort-Object
    $p95idx = [Math]::Min($ordenadas.Count - 1, [Math]::Ceiling($ordenadas.Count * 0.95) - 1)
    [pscustomobject]@{
        Endpoint   = $Nombre
        Muestras   = $tiempos.Count
        Promedio   = [math]::Round(($tiempos | Measure-Object -Average).Average, 1)
        Min        = [math]::Round($ordenadas[0], 1)
        P95        = [math]::Round($ordenadas[$p95idx], 1)
        Max        = [math]::Round($ordenadas[-1], 1)
    }
}

Write-Host "== Mediciones RNF JADDA SPORTS ($Iteraciones iteraciones por endpoint) =="

# Sesion para el endpoint autenticado
$sesionLogin = $null
try {
    $rLogin = Invoke-WebRequest -Uri "$BackUrl/api/auth/login" -Method Post -Body (@{ email = $adminEmail; password = $adminPass } | ConvertTo-Json) -ContentType "application/json" -SessionVariable sesionLogin -UseBasicParsing -TimeoutSec 15
} catch { Write-Host "AVISO: no se pudo iniciar sesion para el endpoint autenticado." -ForegroundColor Yellow }

$resultados = @()
$resultados += Medir-Endpoint "GET / (frontend HTML)" { Invoke-WebRequest -Uri "$FrontUrl/" -UseBasicParsing -TimeoutSec 20 } $Iteraciones
$resultados += Medir-Endpoint "GET /api/productos (catalogo)" { Invoke-WebRequest -Uri "$FrontUrl/api/productos" -UseBasicParsing -TimeoutSec 20 } $Iteraciones
$resultados += Medir-Endpoint "GET /api/productos/1 (detalle)" { Invoke-WebRequest -Uri "$FrontUrl/api/productos/1" -UseBasicParsing -TimeoutSec 20 } $Iteraciones
$resultados += Medir-Endpoint "GET /api/productos/categorias" { Invoke-WebRequest -Uri "$FrontUrl/api/productos/categorias" -UseBasicParsing -TimeoutSec 20 } $Iteraciones
$resultados += Medir-Endpoint "POST /api/auth/login" { Invoke-WebRequest -Uri "$BackUrl/api/auth/login" -Method Post -Body (@{ email = $adminEmail; password = $adminPass } | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing -TimeoutSec 20 } $Iteraciones

if ($sesionLogin) {
    $s = Get-Variable sesionLogin -ValueOnly
    $resultados += Medir-Endpoint "GET /api/auth/perfil (autenticado)" { Invoke-WebRequest -Uri "$BackUrl/api/auth/perfil" -WebSession $s -UseBasicParsing -TimeoutSec 20 } $Iteraciones
}

# ---------- Informe ----------
$resultados | Format-Table -AutoSize

$carpetaDocs = Join-Path $PSScriptRoot "..\docs\calidad"
if (-not (Test-Path $carpetaDocs)) { New-Item -ItemType Directory -Path $carpetaDocs | Out-Null }
$informe = Join-Path $carpetaDocs "resultados-mediciones.md"

$lineas = @()
$lineas += "# Resultados de mediciones de rendimiento (RNF)"
$lineas += ""
$lineas += "- **Fecha:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lineas += "- **Entorno:** Windows local con Docker Desktop; frontend Vite preview/dev (:5173) y backend Express (:5000)"
$lineas += "- **Metodo:** $Iteraciones peticiones por endpoint tras 1 calentamiento; tiempos en milisegundos medidos con Stopwatch"
$lineas += ""
$lineas += "| Endpoint | Muestras | Promedio (ms) | Min (ms) | P95 (ms) | Max (ms) |"
$lineas += "|----------|----------|---------------|----------|----------|----------|"
foreach ($r in $resultados) {
    $lineas += "| $($r.Endpoint) | $($r.Muestras) | $($r.Promedio) | $($r.Min) | $($r.P95) | $($r.Max) |"
}
$lineas += ""
Set-Content -Path $informe -Value $lineas -Encoding utf8
Write-Host ""
Write-Host "Informe generado: $informe"
