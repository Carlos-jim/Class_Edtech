#!/usr/bin/env bash
# Configuración inicial: crea .env a partir de .env.example y genera el secreto JWT. No pide la clave de Gemini:
# si falta, indica dónde pegarla.
# Lo que ya está configurado no se toca: ejecutarlo de nuevo es seguro.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "✘ Docker no está instalado. Consulta la sección «Instalar Docker» del README." >&2
  exit 1
fi

umask 077 # .env solo legible por el usuario
created=false
if [[ ! -f .env ]]; then
  cp .env.example .env
  created=true
fi

# Valor de una variable en .env (vacío si no está o no tiene valor)
value_of() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | tr -d '\r' || true; }

# Sustituye (o añade) una variable en .env conservando el resto del fichero
set_value() {
  local tmp
  tmp=$(mktemp)
  grep -vE "^$1=" .env > "$tmp" || true
  echo "$1=$2" >> "$tmp"
  cat "$tmp" > .env
  rm -f "$tmp"
}

changed=false
if [[ -z "$(value_of JWT_SECRET)" ]]; then
  # Secreto JWT aleatorio de 48 bytes (base64), sin depender de openssl.
  set_value JWT_SECRET "$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
  changed=true
fi

provider=$(value_of LLM_PROVIDER)
missing_key=false
if [[ "${provider:-gemini}" == "gemini" && -z "$(value_of GEMINI_API_KEY)" ]]; then
  missing_key=true
fi

if $created; then
  echo "✔ .env creado."
elif $changed; then
  echo "✔ .env completado (el resto se conserva)."
fi

if $missing_key; then
  echo
  echo "Falta tu clave de Google Gemini (gratuita, sin tarjeta): https://aistudio.google.com/apikey"
  echo "  1. Abre $(pwd)/.env con un editor."
  echo "  2. Pega la clave tras GEMINI_API_KEY= (sin espacios ni comillas) y guarda."
  echo "  3. Arranca la aplicación:  docker compose up -d --build"
else
  echo "✔ Todo configurado. Arranca la aplicación con:  docker compose up -d --build"
fi
