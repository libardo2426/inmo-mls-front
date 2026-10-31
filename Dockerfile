# syntax=docker/dockerfile:1

# ---- deps: instala dependencias con el lockfile ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---- build: genera los estáticos ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- runtime: Nginx sin root ----
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

# Variables de Nginx (no viajan al navegador). Las del navegador van en /config.js.
ENV DNS_RESOLVER=127.0.0.11 \
    NGINX_ENVSUBST_FILTER='^(API_|PLATFORM_API_|DNS_)' \
    APP_ENV=production \
    API_BASE_PATH=/v1 \
    PLATFORM_API_BASE_PATH=/plataforma/v1 \
    TENANT_CODE=co \
    SENTRY_DSN=

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/config.js.template /etc/nginx/config.js.template
COPY --chmod=0755 docker/entrypoint/40-config-js.sh /docker-entrypoint.d/40-config-js.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health || exit 1
