# Configuración inicial (solo la primera vez): crea .env a partir de .env.example.
# Si .env ya existe NO lo modifica: para arrancar basta con `docker compose up -d`.
#
# Uso (PowerShell, desde la raíz del repositorio):
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$envPath = Join-Path (Get-Location) '.env'

if (Test-Path $envPath) {
    Write-Host '✔ .env ya existe: no se modifica (tu clave se conserva).' -ForegroundColor Green
    Write-Host '  Arranca la aplicación con:  docker compose up -d'
    exit 0
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host '✘ Docker no está instalado. Consulta la sección «Instalar Docker» del README.' -ForegroundColor Red
    exit 1
}

Write-Host 'Clave de Google Gemini (gratuita, sin tarjeta): https://aistudio.google.com/apikey'
$secure = Read-Host 'Pega tu clave (no se muestra al escribir)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ($apiKey -notmatch '^[A-Za-z0-9_-]{20,}$') {
    Write-Host '✘ La clave no parece válida (sin espacios, al menos 20 caracteres). No se ha creado .env.' -ForegroundColor Red
    exit 1
}

# Secreto JWT aleatorio de 48 bytes (base64). Compatible con Windows PowerShell 5.1 y PowerShell 7.
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$jwtSecret = [Convert]::ToBase64String($bytes)

$text = [IO.File]::ReadAllText((Join-Path (Get-Location) '.env.example'))
$text = $text -replace '(?m)^JWT_SECRET=[^\r\n]*', "JWT_SECRET=$jwtSecret"
$text = $text -replace '(?m)^GEMINI_API_KEY=[^\r\n]*', "GEMINI_API_KEY=$apiKey"
# UTF-8 sin BOM: docker compose no admite el BOM al principio del fichero.
[IO.File]::WriteAllText($envPath, $text, (New-Object System.Text.UTF8Encoding $false))

Write-Host '✔ .env creado. Siguiente paso (la primera vez tarda unos minutos):' -ForegroundColor Green
Write-Host '  docker compose up -d --build'
