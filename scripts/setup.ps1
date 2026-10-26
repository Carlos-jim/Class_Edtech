# Configuración inicial: crea .env a partir de .env.example y completa lo que falte (secreto JWT y clave de Gemini).
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
if ((-not $provider -or $provider -eq 'gemini') -and -not (Get-EnvValue 'GEMINI_API_KEY')) {
    Write-Host 'Falta la clave de Google Gemini (gratuita, sin tarjeta): https://aistudio.google.com/apikey'
    $secure = Read-Host 'Pega tu clave (no se muestra al escribir)' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $raw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    # Al pegar en la consola pueden colarse caracteres de control (Ctrl+V), espacios o comillas: se quitan.
    $apiKey = ($raw -replace '[\x00-\x20\x7F"''`]', '')
    if ($apiKey.Length -lt 20 -or $apiKey -notmatch '^[\x21-\x7E]+$') {
        Write-Host "✘ No se ha recibido una clave válida ($($apiKey.Length) caracteres útiles de $($raw.Length) recibidos)." -ForegroundColor Red
        Write-Host '  Si al pegar no aparece nada, pega con clic derecho (o Ctrl+Mayús+V) en lugar de Ctrl+V,'
        Write-Host '  o edita .env con el Bloc de notas y pon la clave tras GEMINI_API_KEY= (sin espacios ni comillas).'
        exit 1
    }
    Set-EnvValue 'GEMINI_API_KEY' $apiKey
    $changed = $true
}

if ($created -or $changed) {
    # UTF-8 sin BOM: docker compose no admite el BOM al principio del fichero.
    [IO.File]::WriteAllText($envPath, $text, (New-Object System.Text.UTF8Encoding $false))
}

if ($created) {
    Write-Host '✔ .env creado. Siguiente paso (la primera vez tarda unos minutos):' -ForegroundColor Green
    Write-Host '  docker compose up -d --build'
} elseif ($changed) {
    Write-Host '✔ .env completado (el resto se conserva). Arranca la aplicación con:' -ForegroundColor Green
    Write-Host '  docker compose up -d --build'
} else {
    Write-Host '✔ .env ya está configurado: no se modifica (tu clave se conserva).' -ForegroundColor Green
    Write-Host '  Arranca la aplicación con:  docker compose up -d'
}
