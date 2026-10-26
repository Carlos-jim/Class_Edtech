# Configuración inicial: crea .env a partir de .env.example y genera el secreto JWT. No pide la clave de Gemini:
# si falta, abre .env para pegarla.
# Lo que ya está configurado no se toca: ejecutarlo de nuevo es seguro.
#
# Uso (PowerShell, desde la raíz del repositorio):
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$envPath = Join-Path (Get-Location) '.env'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host '✘ Docker no está instalado. Consulta la sección «Instalar Docker» del README.' -ForegroundColor Red
    exit 1
}

$created = -not (Test-Path $envPath)
if ($created) {
    $text = [IO.File]::ReadAllText((Join-Path (Get-Location) '.env.example'))
} else {
    $text = [IO.File]::ReadAllText($envPath)
}

# Valor de una variable en .env (vacío si no está o no tiene valor)
function Get-EnvValue([string]$name) {
    $match = [regex]::Matches($text, "(?m)^$name=([^\r\n]*)")
    if ($match.Count -eq 0) { return '' }
    return $match[$match.Count - 1].Groups[1].Value.Trim()
}

# Sustituye (o añade) una variable conservando el resto del fichero
function Set-EnvValue([string]$name, [string]$value) {
    if ($text -match "(?m)^$name=") {
        $script:text = [regex]::Replace($text, "(?m)^$name=[^\r\n]*", { param($m) "$name=$value" })
    } else {
        $script:text = $text.TrimEnd() + "`n$name=$value`n"
    }
}

$changed = $false
if (-not (Get-EnvValue 'JWT_SECRET')) {
    # Secreto JWT aleatorio de 48 bytes (base64). Compatible con Windows PowerShell 5.1 y PowerShell 7.
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    Set-EnvValue 'JWT_SECRET' ([Convert]::ToBase64String($bytes))
    $changed = $true
}

$provider = Get-EnvValue 'LLM_PROVIDER'
$missingKey = (-not $provider -or $provider -eq 'gemini') -and -not (Get-EnvValue 'GEMINI_API_KEY')

if ($created -or $changed) {
    # UTF-8 sin BOM: docker compose no admite el BOM al principio del fichero.
    [IO.File]::WriteAllText($envPath, $text, (New-Object System.Text.UTF8Encoding $false))
}

if ($created) {
    Write-Host '✔ .env creado.' -ForegroundColor Green
} elseif ($changed) {
    Write-Host '✔ .env completado (el resto se conserva).' -ForegroundColor Green
}

if ($missingKey) {
    Write-Host ''
    Write-Host 'Falta tu clave de Google Gemini (gratuita, sin tarjeta): https://aistudio.google.com/apikey' -ForegroundColor Yellow
    Write-Host "  1. Abre $envPath (se intenta abrir solo en el Bloc de notas)."
    Write-Host '  2. Pega la clave tras GEMINI_API_KEY= (sin espacios ni comillas) y guarda.'
    Write-Host '  3. Arranca la aplicación:  docker compose up -d --build'
    try { Start-Process notepad.exe -ArgumentList "`"$envPath`"" } catch { }
} else {
    Write-Host '✔ Todo configurado. Arranca la aplicación con:  docker compose up -d --build' -ForegroundColor Green
}
