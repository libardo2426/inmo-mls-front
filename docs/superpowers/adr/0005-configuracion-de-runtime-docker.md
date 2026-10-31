# ADR-0005 — Configuración de runtime en Docker

- **Estado:** Propuesto
- **Fecha:** 2026-10-31

## Contexto

Vite hornea `import.meta.env` en el build. Queremos **una sola imagen** para dev, staging y producción. El navegador debe hablar solo con el origen del frontend (sin CORS). El backend tiene dos hosts de API: el del país (`<país>.api.<dominio>`) y el de plataforma (`admin.api.<dominio>`). Fuera de producción, el país se elige con `X-Tenant`; en producción se resuelve por `Host`. Para que las cookies y el chequeo de `Origin` funcionen, el frontend debe correr en `app.<dominio>` (en local, `app.localtest.me:5173`, **no** `localhost`).

## Decisión

### Mismo origen con dos prefijos

El navegador llama solo a rutas relativas:

| Prefijo en el navegador | Upstream |
|---|---|
| `/v1/*` | API del país (`API_UPSTREAM`), con el país fijado por el proxy |
| `/plataforma/v1/*` | API de plataforma (`PLATFORM_API_UPSTREAM`), reescrito a `/v1/*` |

El segundo prefijo es **mi propuesta** para distinguir hosts sin que el navegador conozca el dominio; se confirma en F0.

- **Dev (Vite `server.proxy`):** `host: 'app.localtest.me'`, puerto 5173. `/v1` → `http://localhost:3000` con header `X-Tenant: co`; `/plataforma/v1` → host de plataforma local.
- **Producción (Nginx):** `proxy_pass` a cada upstream. Para `/v1`, `proxy_set_header Host $API_TENANT_HOST` (p. ej. `co.api.<dominio>`), porque `X-Tenant` **no** funciona en producción. Para `/plataforma/v1`, `Host: admin.api.<dominio>`.
- Las cookies viajan con `Domain=<BASE_DOMAIN>`; el proxy no debe reescribirlas.

### `config.js` generado al arrancar

1. El contenedor ejecuta un entrypoint que, con `envsubst`, genera `/config.js` desde variables de entorno.
2. `index.html` carga `/config.js` **antes** de la app; define `window.__APP_CONFIG__`.
3. `lib/config.ts` lo **valida con Zod** y falla de forma visible (pantalla de error de configuración) si es inválido.
4. `config.js` no se cachea (`Cache-Control: no-store`). Solo contiene datos **públicos**.

Variables de **frontend** (viajan en `config.js`): `APP_ENV`, `API_BASE_PATH` (`/v1`), `PLATFORM_API_BASE_PATH` (`/plataforma/v1`), `TENANT_CODE` (país por defecto, informativo), `SENTRY_DSN` (opcional, ver Q9).

Variables de **Nginx** (no viajan al navegador): `API_UPSTREAM`, `API_TENANT_HOST`, `PLATFORM_API_UPSTREAM`, `PLATFORM_API_HOST`. Se aplican con las plantillas de la imagen `nginx-unprivileged`.

### Imagen

- `Dockerfile` multi-stage: `deps` → `build` (Node LTS alpine) → `runtime` (`nginxinc/nginx-unprivileged`, usuario no root).
- `nginx.conf`: fallback SPA, assets con hash 1 año e `index.html` sin caché, gzip/brotli, headers de seguridad y CSP estricta (sin `unsafe-inline` en scripts), `/health`, y los dos `location` de proxy.
- Como `config.js` es un script del mismo origen, la CSP lo permite con `script-src 'self'` sin `unsafe-inline`.
- `.dockerignore` completo; `docker-compose.yml` (dev, Vite con `--host` y volumen); `docker-compose.prod.yml` (restart, healthcheck, límites).
- Red con el backend: si corre en Docker, red compartida y nombre de servicio; si no, `API_UPSTREAM` configurable.

## Alternativas consideradas

- **Variables `VITE_*` en build:** una imagen por entorno; rompe "una imagen, muchos entornos".
- **Que el navegador llame directo a `co.api.<dominio>`:** exige CORS y `credentials`; contradice el mismo origen y complica la CSP.
- **País en la URL del frontend:** descartado (el admin MLS opera un solo país); el cliente HTTP recibe el tenant como contexto.

## Consecuencias

- (+) Una imagen para todos los entornos; sin CORS en producción.
- (+) El cambio a multi-país es agregar un selector, no cambiar el despliegue.
- (−) Nginx debe fijar el `Host` correcto por país; con varios países se necesitaría un mapeo (futuro).
- (−) Hay que confirmar que Better Auth acepta el `Origin` y la cookie a través del proxy (Q4), y que `admin.api` comparte la sesión (Q3).
