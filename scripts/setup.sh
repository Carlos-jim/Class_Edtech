#!/usr/bin/env bash
# Configuración inicial (solo la primera vez): crea .env a partir de .env.example.
# Si .env ya existe NO lo modifica: para arrancar basta con `docker compose up -d`.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo "✔ .env ya existe: no se modifica (tu clave se conserva)."
  echo "  Arranca la aplicación con:  docker compose up -d"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✘ Docker no está instalado. Consulta la sección «Instalar Docker» del README." >&2
  exit 1
fi

echo "Clave de Google Gemini (gratuita, sin tarjeta): https://aistudio.google.com/apikey"
read -rsp "Pega tu clave (no se muestra al escribir): " api_key
echo
if [[ ! "$api_key" =~ ^[A-Za-z0-9_-]{20,}$ ]]; then
  echo "✘ La clave no parece válida (sin espacios, al menos 20 caracteres). No se ha creado .env." >&2
  exit 1
fi

# Secreto JWT aleatorio de 48 bytes (base64), sin depender de openssl.
jwt_secret=$(head -c 48 /dev/urandom | base64 | tr -d '\n')

umask 077 # .env solo legible por el usuario
sed -e "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" \
    -e "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=${api_key}|" \
    .env.example > .env

echo "✔ .env creado. Siguiente paso (la primera vez tarda unos minutos):"
echo "  docker compose up -d --build"
