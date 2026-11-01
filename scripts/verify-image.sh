#!/usr/bin/env bash
# Verifica la imagen de producción (CA12, CA13, CA14, CA15 y foco de revisión #3).
# Uso: bash scripts/verify-image.sh   (requiere Docker; sale con código != 0 si algo falla)
set -euo pipefail

IMAGE="${IMAGE:-inmo-mls-front:verify}"
PORT="${PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"
NAME="inmo-mls-front-verify"
failures=0

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; failures=$((failures + 1)); }
check() { # check "descripción" comando...
  local description="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "$description"; else fail "$description"; fi
}

run_container() { # run_container TENANT_CODE
  cleanup
  docker run -d --name "$NAME" -p "${PORT}:8080" \
    -e APP_ENV=staging \
    -e API_BASE_PATH=/v1 \
    -e PLATFORM_API_BASE_PATH=/plataforma/v1 \
    -e TENANT_CODE="$1" \
    -e API_UPSTREAM=http://127.0.0.1:9 \
    -e API_TENANT_HOST=co.api.example.test \
    -e PLATFORM_API_UPSTREAM=http://127.0.0.1:9 \
    -e PLATFORM_API_HOST=admin.api.example.test \
    "$IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    if curl -fsS "$BASE/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "El contenedor no respondió en /health" >&2
  docker logs "$NAME" >&2 || true
  return 1
}

header() { # header URL NOMBRE  → valor del header (minúsculas)
  curl -sI -H 'Accept-Encoding: identity' "$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d: -f2- | tr 'A-Z' 'a-z' || true
}

echo "== Construyendo la imagen"
docker build -t "$IMAGE" .

echo "== Arrancando con TENANT_CODE=co"
run_container co

echo "== CA12: operación básica"
check "GET /health responde 200" curl -fsS "$BASE/health"
check "el proceso corre como usuario no root" test "$(docker exec "$NAME" id -u)" != "0"
check "index.html sin caché (no-cache)" bash -c "[[ \"$(header "$BASE/" cache-control)\" == *no-cache* ]]"
ASSET="$(curl -fsS "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)"
check "se encontró un asset con hash en index.html" test -n "$ASSET"
check "asset con hash: cache de 1 año e immutable" bash -c "v=\"$(header "$BASE$ASSET" cache-control)\"; [[ \"\$v\" == *max-age=31536000* && \"\$v\" == *immutable* ]]"
check "fallback SPA: ruta inexistente devuelve index.html" bash -c "curl -fsS $BASE/una/ruta/inexistente | grep -q '<div id=\"root\">'"
check "gzip activo para JS" bash -c "curl -sI -H 'Accept-Encoding: gzip' $BASE$ASSET | tr -d '\r' | grep -qi '^content-encoding: gzip'"
check "no hay source maps en la imagen" test "$(docker exec "$NAME" find /usr/share/nginx/html -name '*.map' | wc -l)" = "0"

echo "== Foco #3 y CA14: /config.js"
check "/config.js se sirve como JavaScript (no HTML)" bash -c "[[ \"$(header "$BASE/config.js" content-type)\" == *javascript* ]]"
check "/config.js sin caché (no-store)" bash -c "[[ \"$(header "$BASE/config.js" cache-control)\" == *no-store* ]]"
check "/config.js contiene TENANT_CODE=co" bash -c "curl -fsS $BASE/config.js | grep -q 'TENANT_CODE.*\"co\"'"

echo "== CA13: cabeceras de seguridad"
CSP="$(header "$BASE/" content-security-policy)"
check "CSP presente" test -n "$CSP"
check "CSP sin unsafe-inline en script-src" bash -c "! echo \"$CSP\" | tr ';' '\n' | grep -i 'script-src' | grep -q 'unsafe-inline'"
check "CSP con frame-ancestors 'none'" bash -c "echo \"$CSP\" | grep -q \"frame-ancestors 'none'\""
check "Referrer-Policy" test -n "$(header "$BASE/" referrer-policy)"
check "Permissions-Policy" test -n "$(header "$BASE/" permissions-policy)"
check "X-Content-Type-Options nosniff" bash -c "[[ \"$(header "$BASE/" x-content-type-options)\" == *nosniff* ]]"
check "Strict-Transport-Security" test -n "$(header "$BASE/" strict-transport-security)"
check "cabeceras también en /config.js" test -n "$(header "$BASE/config.js" x-content-type-options)"

echo "== Proxy (backend inalcanzable)"
check "/v1/me se proxea y falla con 502/504 (no devuelve index.html)" bash -c "c=\$(curl -s -o /dev/null -w '%{http_code}' $BASE/v1/me); [[ \$c == 502 || \$c == 504 ]]"
check "/plataforma/v1/x se proxea y falla con 502/504" bash -c "c=\$(curl -s -o /dev/null -w '%{http_code}' $BASE/plataforma/v1/x); [[ \$c == 502 || \$c == 504 ]]"

echo "== Proxy (upstream de eco): ruta y Host que recibe el backend"
python3 -I scripts/echo-upstream.py 19000 &
UPSTREAM_PID=$!
trap 'kill $UPSTREAM_PID >/dev/null 2>&1 || true; cleanup' EXIT
sleep 1
cleanup
# Con proxy_pass por variable, Nginx resuelve nombres solo con DNS_RESOLVER (no usa /etc/hosts):
# aquí se usa la IP de la pasarela del bridge para llegar al upstream del host.
GATEWAY="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')"
docker run -d --name "$NAME" -p "${PORT}:8080" \
  -e API_UPSTREAM="http://${GATEWAY}:19000" -e API_TENANT_HOST=co.api.example.test \
  -e PLATFORM_API_UPSTREAM="http://${GATEWAY}:19000" -e PLATFORM_API_HOST=admin.api.example.test \
  "$IMAGE" >/dev/null
for _ in $(seq 1 30); do curl -fsS "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
check "/v1/me llega como /v1/me con Host del país" bash -c "curl -fsS $BASE/v1/me | grep -q 'path=/v1/me host=co.api.example.test'"
check "/plataforma/v1/admin/x llega como /v1/admin/x con Host de plataforma" bash -c "curl -fsS $BASE/plataforma/v1/admin/x | grep -q 'path=/v1/admin/x host=admin.api.example.test'"
kill "$UPSTREAM_PID" >/dev/null 2>&1 || true

echo "== CA14: misma imagen, otra configuración"
run_container ar
check "/config.js cambia a TENANT_CODE=ar sin reconstruir" bash -c "curl -fsS $BASE/config.js | grep -q 'TENANT_CODE.*\"ar\"'"

echo
if [ "$failures" -gt 0 ]; then echo "$failures comprobación(es) fallaron"; exit 1; fi
echo "Todas las comprobaciones pasaron"
