#!/bin/sh
# Genera /config.js desde las variables de entorno (solo las cinco públicas).
# Se escribe en /tmp/runtime porque el usuario no root no puede escribir en el docroot;
# Nginx lo sirve con `alias` (ver default.conf.template).
set -eu

mkdir -p /tmp/runtime
envsubst '${APP_ENV} ${API_BASE_PATH} ${PLATFORM_API_BASE_PATH} ${TENANT_CODE} ${SENTRY_DSN}' \
  < /etc/nginx/config.js.template \
  > /tmp/runtime/config.js

echo "40-config-js.sh: /config.js generado (TENANT_CODE=${TENANT_CODE})"
