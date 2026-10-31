# Fase 0 — Fundación — Diseño

- **Fecha:** 2026-10-31
- **Estado:** borrador para aprobación
- **Rama de trabajo:** `fase-00-fundacion` (worktree)
- **Padre:** [Roadmap del frontend](./2026-10-31-roadmap-frontend-design.md) y ADR 0001–0005
- **Backend:** `docs/backend/contexto-para-frontend.md` y `docs/backend/openapi.json` (OpenAPI 3.0.0, 40 rutas, 36 schemas)

**Decidido** = lo acordó el usuario. **Mi propuesta** = decisión mía, revisable.

---

## 1. Objetivo

Dejar un proyecto que **arranca, se prueba y se despliega** sin ninguna pantalla de negocio: la base técnica sobre la que se construyen F1–F6. Al terminar, un desarrollador clona el repo, corre `pnpm dev` y ve una página base en `app.localtest.me:5173` con tema claro/oscuro, hablando con el backend a través de un proxy de mismo origen.

## 2. Alcance

### Dentro

1. **Proyecto:** Vite + React + TypeScript `strict`, `pnpm`, Node LTS (el entorno tiene Node 24).
2. **UI base:** Tailwind CSS + shadcn/ui inicializado por CLI, tokens de tema **claro y oscuro** (ADR: dirección visual del roadmap §6), conmutador de tema persistido. Solo los componentes que use la página base.
3. **Router:** TanStack Router (ADR-0002), árbol de rutas por archivos con code splitting, y una ruta de ejemplo `/` y una `404`.
4. **Estado del servidor:** TanStack Query con `QueryClient` configurado (reintentos, `staleTime`, sin reintentar 4xx).
5. **Cliente HTTP único** (`lib/http`): dos hosts (país y plataforma, ADR-0005), `credentials: 'include'`, errores tipados desde `ProblemDetails`, y puntos de enganche para el manejo global de 401/403 que implementa F1.
6. **Contrato:** copia versionada `docs/backend/openapi.json` → generación de **tipos y schemas Zod** con `@hey-api/openapi-ts` (cliente desactivado), script `pnpm api:generate`. **Decidido** (opción C y herramienta A).
7. **Configuración de runtime:** `lib/config.ts` con Zod sobre `window.__APP_CONFIG__` (ADR-0005), pantalla de error si es inválida.
8. **Tooling:** ESLint (con regla de límites entre features y prohibición de comparar roles), Prettier, Husky + lint-staged, commitlint (Conventional Commits en español).
9. **Tests base:** Vitest + Testing Library + MSW (unitarios e integración) y Playwright (e2e **solo local**, en Docker, humo).
10. **Docker:** `Dockerfile` multi-stage, `nginx.conf`, entrypoint con `envsubst`, `.dockerignore`, `docker-compose.yml` (e2e/arranque), `docker-compose.prod.yml`.
11. **CI:** GitHub Actions (**Decidido**): lint, tipos, tests con MSW, build, `docker build`, `pnpm audit`.
12. **README** con levantar en dev, build y arranque en prod, variables de entorno y procedimiento de e2e local.

### Fuera de alcance (se hace en otras fases)

- Login, logout, sesión, 2FA, manejo global real de 401/403 → **F1**.
- Catálogo de permisos, `can()`/`<Can>`, navegación por permisos, layout admin, `DataTable` → **F2**.
- React Hook Form: se instala en F1 cuando haya el primer formulario (dependencias mínimas).
- Cualquier pantalla de negocio.
- e2e contra el backend real con login y 2FA → F1 (requiere cuentas de prueba, Q10 del roadmap).
- Sentry u observabilidad → F9.

## 3. Historias de usuario

Los usuarios de F0 son desarrolladores.

- **H1.** Como desarrollador, quiero clonar el repo y levantar la app con `pnpm install && pnpm dev` en `app.localtest.me:5173`, para empezar a trabajar sin pasos manuales ocultos.
- **H2.** Como desarrollador, quiero que los tipos y schemas del backend se regeneren con un comando cuando cambie `openapi.json`, para no escribirlos a mano.
- **H3.** Como desarrollador, quiero un único cliente HTTP que sepa llamar al host del país o al de plataforma y devuelva errores tipados, para no repetir `fetch` ni parsear errores en cada feature.
- **H4.** Como desarrollador, quiero que un commit o un PR falle si rompe lint, tipos, tests o build, para detectar errores antes de integrar.
- **H5.** Como operador, quiero una sola imagen Docker que funcione en dev, staging y producción cambiando solo variables de entorno, para no reconstruir por entorno.
- **H6.** Como desarrollador, quiero correr un smoke e2e en Docker contra la app servida por Nginx, para validar el despliegue real.

## 4. Criterios de aceptación (verificables)

| # | Criterio | Cómo se verifica |
|---|---|---|
| CA1 | `pnpm install && pnpm dev` sirve la app en `http://app.localtest.me:5173` y muestra la página base | Manual + e2e de humo |
| CA2 | `tsc --noEmit` pasa con `strict` y sin `any` implícitos | `pnpm typecheck` en verde |
| CA3 | `pnpm lint` y `pnpm format:check` pasan; importar de una feature a otra falla el lint | Test de la regla con un archivo de ejemplo |
| CA4 | Un `eslint` rule impide `role ===`/`!==` contra literales de rol | Test de la regla |
| CA5 | `pnpm api:generate` produce tipos y Zod en `src/lib/api/generated`; correrlo dos veces no cambia el resultado; el directorio está marcado como generado | Script + diff vacío |
| CA6 | El cliente HTTP, con MSW, devuelve datos validados con Zod y lanza `ApiError` con `code`, `status`, `requestId`, `details` ante un `application/problem+json` | Tests unitarios |
| CA7 | El cliente HTTP elige el prefijo `/v1` (país) o `/plataforma/v1` (plataforma) según la llamada y envía `credentials: 'include'` | Tests unitarios |
| CA8 | Una respuesta que no cumple el schema produce un error de validación distinguible de un error de red y de un error del backend | Tests unitarios |
| CA9 | `lib/config.ts` falla con mensaje claro si `window.__APP_CONFIG__` falta o es inválido, y la app muestra la pantalla de error de configuración | Test + e2e |
| CA10 | El tema alterna claro/oscuro, respeta la preferencia del sistema al primer arranque y persiste la elección | Test de componente + e2e |
| CA11 | `pnpm test` (Vitest) pasa y no toca la red real (MSW bloquea lo no mockeado) | CI |
| CA12 | `docker build` produce una imagen que corre como usuario **no root**, responde `/health`, sirve `index.html` sin caché y assets con hash con `immutable` de 1 año, y hace fallback de SPA | Script de verificación + e2e |
| CA13 | La respuesta de Nginx incluye CSP sin `unsafe-inline` en scripts, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, HSTS | e2e / `curl` |
| CA14 | Al arrancar el contenedor con variables distintas, `/config.js` cambia sin reconstruir la imagen | Prueba con dos configuraciones |
| CA15 | El build de producción no publica source maps y `pnpm audit` no reporta vulnerabilidades altas o críticas | CI |
| CA16 | El workflow de GitHub Actions corre lint, tipos, tests, build, `docker build` y audit en cada PR | Ejecución del workflow |
| CA17 | El smoke e2e (Playwright en Docker) pasa contra la imagen servida por Nginx | `docker compose` e2e |
| CA18 | Un commit con mensaje fuera de Conventional Commits es rechazado por el hook | Prueba manual del hook |

## 5. Endpoints usados

F0 **no consume endpoints de negocio**. Usa:

- `GET /health` (del backend, para comprobar conectividad en el e2e local; público, sin tenant). Nginx expone además su propio `/health` para el healthcheck del contenedor.
- `docs/backend/openapi.json` como **entrada** de la generación, no como llamada en runtime.

Cobertura del contrato para la generación (revisado en `openapi.json`):

| Endpoint | Esquema de respuesta 200 | Tratamiento en F0 |
|---|---|---|
| `GET /v1/properties` | no declarado | Zod a mano en F5 (`B-11`) |
| `GET /v1/properties/{id}/media` | no declarado | Zod a mano en F5 (`B-11`) |
| `POST /v1/media/{id}/complete` | no declarado | Zod a mano (`B-11`) |
| `GET/PUT /v1/admin/tenants/{code}/config` | no declarado | Zod a mano en F6 (`B-11`); nuevo respecto al contexto |
| `/v1/auth/{path}` | comodín (Better Auth) | Cliente `better-auth/react` en F1 |

## 6. Decisiones de diseño

### 6.1 Gestor y versiones
**Mi propuesta:** `pnpm` (el backend también lo usa), Node LTS fijado en `.nvmrc` y `engines`, versiones exactas con lockfile. React y Vite en su última versión estable al crear el proyecto; las versiones concretas las fija el plan tras verificarlas.

### 6.2 Cliente HTTP
```
lib/http/
  client.ts      # createHttpClient({ host: 'country' | 'platform' })
  errors.ts      # ApiError (problem+json), NetworkError, ValidationError
  interceptors.ts# puntos de enganche: onUnauthorized, onForbidden (F1 los implementa)
  request.ts     # request<T>(schema, init) -> parsea con Zod
```
- Rutas relativas: `/v1/...` (país) y `/plataforma/v1/...` (plataforma). El navegador nunca conoce el dominio del backend.
- Siempre `credentials: 'include'`, `Accept: application/json`.
- El **tenant no lo envía el cliente**: lo fija el proxy (`X-Tenant` en dev, `Host` en prod).
- Errores: `ApiError` expone `code`, `status`, `title`, `requestId`, `details`, `errors[]` (validación). La UI decide con `code`, no con `title` (contexto §10).
- Una respuesta que no cumple el schema lanza `ValidationError`, distinta de `NetworkError` y de `ApiError`.
- Dinero: `amountMinor` se mantiene como `string`; no se convierte a `number`.

### 6.3 Configuración de runtime (ADR-0005)
`window.__APP_CONFIG__` validado por Zod: `APP_ENV`, `API_BASE_PATH`, `PLATFORM_API_BASE_PATH`, `TENANT_CODE`, `SENTRY_DSN` (opcional). En desarrollo, `public/config.js` de ejemplo; en el contenedor se genera con `envsubst`. **Mi propuesta:** `config.js` con `Cache-Control: no-store`.

### 6.4 Tema y UI base
shadcn por CLI con tokens CSS en `:root` y `.dark`, tema por clase en `<html>`, script inline mínimo **evitado** por la CSP: el tema se aplica con un script externo pequeño (`/theme-init.js`, mismo origen) antes del render para evitar parpadeo. Tipografía de sistema para F0; la dirección visual fina se aplica con `design-taste-frontend` cuando haya pantallas reales (F1+).

### 6.5 Proxy
- **Dev (Vite):** `host: 'app.localtest.me'`, `port: 5173`. `/v1` → `http://localhost:3000` con `X-Tenant: co`. `/plataforma/v1` → `http://localhost:3000` reescribiendo a `/v1` y fijando `Host: admin.api.localtest.me`, porque el plano de control se enruta por `Host` (el `X-Tenant` no lo sustituye). Esta parte se **verifica en F1/F6 con el backend corriendo** (Q11).
- **Prod (Nginx):** ver ADR-0005.

### 6.6 Tests
- **Vitest + Testing Library + MSW:** unitarios e integración. MSW en modo `onUnhandledRequest: 'error'`.
- **Playwright:** servicio en `docker compose` (`docker-compose.e2e.yml`) con la imagen oficial de Playwright, contra la imagen de producción servida por Nginx. Humo: carga la página base, el tema alterna, un `config.js` inválido muestra el error, las cabeceras de seguridad están presentes. **No corre en CI** (**Decidido**: e2e solo local por ahora, CI con MSW).

### 6.7 Calidad
ESLint (flat config) con: reglas de React/hooks, `@typescript-eslint` estricto, `no-restricted-imports` para el límite entre features, una regla propia o `no-restricted-syntax` contra `role ===`. Prettier. Husky: `pre-commit` (lint-staged) y `commit-msg` (commitlint). Commits en español, convención del contexto §15.

### 6.8 CI
Un workflow `ci.yml`: `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` → `build` → `docker build` → `pnpm audit --audit-level=high`. Caché del almacén de pnpm. Permisos mínimos del token. **No** corre e2e.

### 6.9 Estructura inicial
La del ADR-0001, con carpetas vacías solo cuando tengan contenido (sin `.gitkeep` de relleno): `app/`, `routes/`, `components/ui/`, `components/shared/` (vacío hasta F2), `lib/{http,api/generated,config.ts}`, `config/`.

## 7. Requisitos visuales
- Tokens claro y oscuro, contraste AA en ambos.
- Página base sobria y sin decoración: nombre del producto, estado de conexión del backend (opcional) y conmutador de tema.
- Densidad alta como línea de base de los tokens (espaciados compactos).

## 8. Requisitos de seguridad
- Sin secretos en el frontend; `config.js` solo con datos públicos.
- Sin `dangerouslySetInnerHTML`; sin tokens en `localStorage`/`sessionStorage` (el tema es la única preferencia persistida, y no es sensible).
- CSP estricta y cabeceras de seguridad en Nginx desde F0.
- Contenedor no root; imagen mínima; sin source maps públicos.
- `pnpm audit` y dependencias mínimas.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| `@hey-api/openapi-ts` no genera lo esperado del contrato | Spike como **primera tarea del plan**; plan B: `orval` en modo Zod (**Decidido**) |
| Zod generado con OpenAPI 3.0 no cubre algún caso (por ejemplo `string` de dinero) | Revisar la salida del spike y ajustar con transformaciones documentadas |
| Proxy de plataforma por `Host` no funciona como supuse | Verificar con el backend corriendo; no bloquea F0 |
| La CSP sin `unsafe-inline` rompe estilos/inyección de Tailwind o shadcn | Probar en el e2e de cabeceras; hoja de estilos externa en producción |
| Versiones de dependencias | El plan las verifica contra el registro antes de fijarlas |

## 10. Preguntas abiertas

| # | Pregunta | Estado |
|---|---|---|
| Q11 | ¿El proxy de plataforma funciona en dev fijando `Host: admin.api.localtest.me` contra `localhost:3000`? | Se verifica con el backend corriendo (F1/F6); no bloquea F0 |
| Q12 | Presupuesto de bundle definitivo (propuesto: ≤ 200 kB gzip de JS inicial). | Se mide con la página base y se fija en el plan |
| Q13 | Nombre del paquete y dominio base para pruebas del contenedor. | Mi propuesta: `inmo-mls-front`, `localtest.me` |

## 11. Lo que queda al implementador
Versiones exactas de dependencias, nombres de archivos internos de `lib/http`, configuración fina de ESLint/Prettier, contenido exacto de la página base, y el orden de las tareas del plan.
