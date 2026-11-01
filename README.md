# Innmo MLS — Frontend

Panel interno (SPA) del MLS: React + TypeScript + Vite, servido por Nginx y con el backend detrás de un proxy de mismo origen.

- Documentación de diseño: [`docs/superpowers/`](docs/superpowers) (specs, ADR y planes).
- Contexto del backend: [`docs/backend/contexto-para-frontend.md`](docs/backend/contexto-para-frontend.md) y [`docs/backend/openapi.json`](docs/backend/openapi.json).

## Requisitos

- Node 24 (`.nvmrc`) y pnpm 12.
- Docker (para la imagen y el e2e).
- El backend corriendo en `http://localhost:3000` (ver el contexto del backend).

## Desarrollo

```bash
pnpm install
pnpm dev        # http://app.localtest.me:5173
```

**Use `app.localtest.me`, no `localhost`**: la cookie de sesión del backend lleva `Domain=localtest.me` y se comparte entre `app.` y `<país>.api.`. El host del front debe estar en `FRONTEND_ORIGINS` del backend.

> En algunas máquinas (por ejemplo WSL) `app.localtest.me` resuelve a `::1` (IPv6) y no a `127.0.0.1`. Si no abre, revise `getent hosts app.localtest.me`.

El servidor de desarrollo hace de proxy para que el navegador solo hable con su propio origen:

| Ruta del navegador | Destino                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `/v1/*`            | `API_TARGET` con `X-Tenant: <TENANT_CODE>`                                        |
| `/plataforma/v1/*` | `API_TARGET`, reescrito a `/v1/*`, con `Host: <PLATFORM_HOST>` (plano de control) |

Variables del servidor de desarrollo (opcionales, ver `.env.example`; cópielas a `.env.local`): `API_TARGET`, `TENANT_CODE`, `PLATFORM_HOST`.

La configuración de runtime de la app en desarrollo sale de `public/config.js`.

### Scripts

| Comando                     | Qué hace                                                       |
| --------------------------- | -------------------------------------------------------------- |
| `pnpm test`                 | Vitest + Testing Library + MSW (MSW bloquea lo no mockeado)    |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                              |
| `pnpm typecheck`            | TypeScript estricto                                            |
| `pnpm build`                | Build de producción (sin source maps)                          |
| `pnpm api:generate`         | Regenera tipos y schemas Zod desde `docs/backend/openapi.json` |
| `pnpm ci:verify`            | Los mismos pasos que el CI, en local                           |

### Contrato del backend

`src/lib/api/generated` se genera con `@hey-api/openapi-ts` (solo tipos y Zod, sin cliente) y **se versiona**. El resto del código importa de la fachada `src/lib/api/schemas.ts`.

Para actualizarlo: copie el nuevo `openapi.json` a `docs/backend/openapi.json`, ejecute `pnpm api:generate` y revise el diff (el CI falla si el código generado no coincide).

### Reglas del proyecto

- Estructura por features; una feature no importa de otra (lo hace cumplir ESLint).
- Un solo cliente HTTP: `src/lib/http`. Prohibido `fetch` fuera de ahí.
- La autorización se decide con permisos, nunca comparando el rol (regla de ESLint).
- Commits en español con Conventional Commits (`feat(http): …`); lo verifica commitlint.

## Docker

```bash
docker build -t inmo-mls-front .
docker compose up --build          # http://localhost:8080
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Una sola imagen sirve para cualquier entorno: la configuración se inyecta al arrancar el contenedor.

### Variables de entorno

**Públicas** (van a `/config.js`, viajan al navegador — no ponga secretos):

| Variable                 | Por defecto      | Descripción                             |
| ------------------------ | ---------------- | --------------------------------------- |
| `APP_ENV`                | `production`     | `development`, `staging` o `production` |
| `API_BASE_PATH`          | `/v1`            | Prefijo de la API del país              |
| `PLATFORM_API_BASE_PATH` | `/plataforma/v1` | Prefijo de la API de plataforma         |
| `TENANT_CODE`            | `co`             | País por defecto                        |
| `SENTRY_DSN`             | vacío            | Opcional                                |

**De Nginx** (no viajan al navegador):

| Variable                | Descripción                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| `API_UPSTREAM`          | URL del backend del país, p. ej. `http://core-api:3000`                    |
| `API_TENANT_HOST`       | `Host` que se envía al backend del país (el país se resuelve por Host)     |
| `PLATFORM_API_UPSTREAM` | URL del backend para el plano de control                                   |
| `PLATFORM_API_HOST`     | `Host` del plano de control, p. ej. `admin.api.<dominio>`                  |
| `DNS_RESOLVER`          | Resolvedor DNS de Nginx. Por defecto `127.0.0.11` (DNS embebido de Docker) |

Notas:

- Nginx resuelve los nombres de `*_UPSTREAM` **solo por DNS** (no por `/etc/hosts`): en Docker, ponga el backend en la misma red y use el nombre del servicio, o use una IP. Fuera de Docker, ajuste `DNS_RESOLVER`.
- La imagen corre como usuario no root, con CSP estricta y cabeceras de seguridad. Solo gzip: la imagen base de Nginx no incluye Brotli.

### Verificar la imagen

```bash
bash scripts/verify-image.sh   # requiere Docker y python3
```

Comprueba usuario no root, caché, fallback SPA, `/config.js`, cabeceras de seguridad y el proxy (ruta y `Host`).

## E2E (solo local, en Docker)

El e2e con Playwright corre contra la imagen servida por Nginx. **No corre en CI** (el CI usa tests con MSW).

```bash
pnpm install   # el contenedor usa el node_modules del host
docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm --build playwright
```

El humo de F0 no necesita backend. El e2e con login y 2FA llega en F1 y requerirá cuentas de prueba creadas con `ops-cli` del backend.

## CI

GitHub Actions (`.github/workflows/ci.yml`): lint, formato, tipos, tests, build, contrato generado al día, `pnpm audit --audit-level=high` y `docker build`.
