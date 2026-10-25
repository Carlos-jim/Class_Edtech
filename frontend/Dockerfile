# --- Build ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx ng build --configuration production

# --- Runtime: nginx sin privilegios (usuario no root, puerto 8080) ---
FROM nginxinc/nginx-unprivileged:1.29-alpine
# Plantilla: BACKEND_UPSTREAM se resuelve al arrancar (ver docker-compose).
ENV BACKEND_UPSTREAM=backend:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 8080
