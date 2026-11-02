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
| `/v1/*`            | `API_TARGET` (con su `Host`) y `X-Tenant: <TENANT_CODE>`                          |
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

### Agregar un ítem de menú con su permiso

1. Si el permiso no está en `src/lib/permissions/catalog.ts`, agréguelo (un test lo compara con la tabla del backend).
2. Declare el ítem en `src/config/navigation.ts` con `to`, `label`, `icon` y `permission` (y `minScope` si hace falta). Solo se agregan ítems con pantalla real.
3. En la ruta, exija el mismo permiso: `beforeLoad: ({ context }) => assertCan(context.me, 'agency.list')`. Sin permiso, el shell muestra «sin permiso».

Son ayudas de UX; el servidor es la autoridad.

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

El humo (`e2e/smoke.spec.ts`) y los vectores TOTP (`e2e/totp.spec.ts`) no necesitan backend. El flujo de autenticación (`e2e/auth.spec.ts`) **solo corre contra un backend real** y se omite si faltan las variables:

```bash
E2E_BACKEND=1 E2E_ADMIN_EMAIL=admin@ejemplo.test E2E_ADMIN_PASSWORD='una-clave-larga-1' \
  docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm playwright
```

Requisitos del backend para ese e2e:

- Un admin MLS **sin 2FA** (el test lo activa). Ver «Crear una cuenta de admin».
- `FRONTEND_ORIGINS` debe incluir `http://app.localtest.me:8080`: el navegador del contenedor entra por ese host (alias de `web`), de modo que el `Origin` y la cookie (`Domain=<BASE_DOMAIN>`) coinciden con lo que acepta Better Auth.
- `API_UPSTREAM` debe apuntar al backend (en el host, la IP de la pasarela de Docker, p. ej. `http://172.17.0.1:3000`).

La revisión de agencias (`e2e/agencias.spec.ts`) también necesita un backend real, un admin MLS **con 2FA ya activo** y al menos una solicitud pendiente. Además de las variables anteriores usa `E2E_ADMIN_TOTP_SECRET` (la clave en texto que mostró la activación). **No envía ninguna acción de revisión**: solo comprueba el listado, el detalle y que rechazar exige motivo y nombre.

> Estado: el flujo contra el backend en marcha **aún no se ha verificado** (autenticación ni revisión de agencias); el e2e de humo y el de TOTP sí corren en Docker.

Los resultados de Playwright se escriben en `/tmp/pw-results` dentro del contenedor (`PW_OUTPUT_DIR`), así no quedan archivos de root en el repositorio.

## Crear una cuenta de admin (desarrollo y e2e)

`ops-cli` no crea usuarios. Con el backend en marcha (`pnpm dev:up`, migraciones, `ops tenant provision co` y `ops tenant activate co`, `pnpm nx serve core-api`):

```bash
# 1) Registrar la cuenta
curl -X POST http://localhost:3000/v1/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'X-Tenant: co' -H 'Origin: http://app.localtest.me:5173' \
  -d '{"email":"admin@ejemplo.test","name":"Admin","password":"una-clave-larga-1"}'

# 2) Darle membresía de admin en el país (desde el repositorio del backend)
pnpm ops member add co admin@ejemplo.test --role admin
```

El admin empieza **sin 2FA**: al iniciar sesión el panel lo lleva a `/activar-2fa`, donde escanea el QR con una app de autenticación y guarda los códigos de respaldo. Los correos de recuperación de contraseña llegan a Mailpit (`http://localhost:8025`).

## Revisión de agencias (F3)

Quien tenga `agency.list` (admin y `compliance`) ve **Agencias** en el menú: listado por estado (el filtro vive en la URL, `?status=`; por defecto `pending`) y detalle de cada solicitud. Solo con `agency.approve`, `agency.request_changes` o `agency.reject` y con la solicitud `pending` aparecen los botones **Aprobar**, **Devolver con cambios** (motivo obligatorio) y **Rechazar** (motivo obligatorio y escribir el nombre comercial; se terminan las membresías y la persona no ve el motivo). Las acciones sensibles exigen 2FA.

Datos de prueba (desde el repositorio del backend): `pnpm ops agency add co --trade-name "Inmobiliaria Demo" --legal-name "Demo S.A.S." …` y `pnpm ops agency list co`.

El nombre del municipio sale de `GET /v1/territory/units/{país}/{nivel}?codes=…&limit=100` (pedido B-16, PR #78 del backend). Si el backend aún no tiene ese filtro, el detalle muestra el código del municipio y todo lo demás funciona.

## Despliegue: autenticación

- `FRONTEND_ORIGINS` (backend): lista separada por comas de los orígenes https desde los que se sirve el panel; Better Auth rechaza con 403 cualquier otro `Origin`.
- `PASSWORD_RESET_URL` (backend): `https://<panel>/restablecer`; el correo añade `#token=…` y el panel lo lee y lo borra de la URL.
- `TRUST_PROXY_HOPS=1` (backend) cuando hay un proxy delante, para que el límite de intentos use la IP real del cliente.

## CI

GitHub Actions (`.github/workflows/ci.yml`): lint, formato, tipos, tests, build, contrato generado al día, `pnpm audit --audit-level=high` y `docker build`.
