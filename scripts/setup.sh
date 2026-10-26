#!/usr/bin/env bash
# Configuración inicial (solo la primera vez): crea .env a partir de .env.example.
# Si .env ya existe NO lo modifica: para arrancar basta con `docker compose up -d`.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo "✔ .env ya existe: no se modifica (tu clave de Groq se conserva)."
  echo "  Arranca la aplicación con:  docker compose up -d"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✘ Docker no está instalado. Consulta la sección «Instalar Docker» del README." >&2
  exit 1
fi

echo "Clave de Groq (gratuita, sin tarjeta): https://console.groq.com/keys"
read -rsp "Pega tu clave (gsk_...; no se muestra al escribir): " groq_key
echo
if [[ ! "$groq_key" =~ ^gsk_[A-Za-z0-9]+$ ]]; then
  echo "✘ La clave debe empezar por gsk_ y no contener espacios. No se ha creado .env." >&2
  exit 1
fi

# Secreto JWT aleatorio de 48 bytes (base64), sin depender de openssl.
jwt_secret=$(head -c 48 /dev/urandom | base64 | tr -d '\n')

umask 077 # .env solo legible por el usuario
sed -e "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" \
    -e "s|^GROQ_API_KEY=.*|GROQ_API_KEY=${groq_key}|" \
    .env.example > .env

echo "✔ .env creado. Siguiente paso (la primera vez tarda unos minutos):"
echo "  docker compose up -d --build"
