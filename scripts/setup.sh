#!/usr/bin/env bash
# Configuración inicial: crea .env a partir de .env.example y completa lo que falte (secreto JWT y clave de Gemini).
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
if [[ "${provider:-gemini}" == "gemini" && -z "$(value_of GEMINI_API_KEY)" ]]; then
  echo "Falta la clave de Google Gemini (gratuita, sin tarjeta): https://aistudio.google.com/apikey"
  read -rsp "Pega tu clave (no se muestra al escribir): " api_key
  echo
  if [[ ! "$api_key" =~ ^[A-Za-z0-9_-]{20,}$ ]]; then
    echo "✘ La clave no parece válida (sin espacios, al menos 20 caracteres). Vuelve a ejecutar el script." >&2
    exit 1
  fi
  set_value GEMINI_API_KEY "$api_key"
  changed=true
fi

if $created; then
  echo "✔ .env creado. Siguiente paso (la primera vez tarda unos minutos):"
  echo "  docker compose up -d --build"
elif $changed; then
  echo "✔ .env completado (el resto se conserva). Arranca la aplicación con:"
  echo "  docker compose up -d --build"
else
  echo "✔ .env ya está configurado: no se modifica (tu clave se conserva)."
  echo "  Arranca la aplicación con:  docker compose up -d"
fi
