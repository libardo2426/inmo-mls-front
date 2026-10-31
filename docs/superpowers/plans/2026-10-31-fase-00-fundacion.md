# Fase 0 — Fundación — Plan de implementación

> **Para quien ejecute:** usar `superpowers:executing-plans` (inline, en la sesión actual). **No** usar `subagent-driven-development`. Los pasos usan casillas `- [ ]`. Ejecutar por **lotes** (§Lotes) y detenerse al final de cada uno para el visto bueno del usuario.

**Meta:** dejar un proyecto React + TypeScript que arranca, se prueba y se despliega (imagen Nginx), sin pantallas de negocio.

**Arquitectura:** SPA con estructura por features (ADR-0001), TanStack Router (ADR-0002), un cliente HTTP único con dos hosts (país/plataforma) y configuración de runtime validada con Zod (ADR-0005). Tipos y schemas Zod generados desde `docs/backend/openapi.json`.

**Stack:** pnpm · Node LTS · Vite · React · TypeScript `strict` · Tailwind + shadcn/ui · TanStack Router/Query · Zod · `@hey-api/openapi-ts` · Vitest + Testing Library + MSW · Playwright (solo local, en Docker) · ESLint · Prettier · Husky + lint-staged + commitlint · Docker (`nginxinc/nginx-unprivileged`) · GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-31-fase-00-fundacion-design.md` (criterios CA1–CA18). Padre: `2026-10-31-roadmap-frontend-design.md` y ADR 0001–0005.

## Restricciones globales

- TypeScript `strict`; alias `@/` → `src/`. Sin `any` implícito.
- Dependencias **mínimas**; antes de fijar cada versión, verificarla contra el registro (`pnpm view <pkg> version`). Versiones exactas + lockfile. **No** instalar React Hook Form (es de F1) ni `better-auth` (F1).
- Un solo cliente HTTP; ningún `fetch` fuera de `src/lib/http`.
- Prohibido `dangerouslySetInnerHTML`, tokens en `localStorage`/`sessionStorage` (el tema `innmo-theme` es la única preferencia persistida), y `unsafe-inline` en `script-src`.
- `amountMinor` es **string**; nunca `number`.
- Textos de UI en español (`es-CO`), centralizados en `src/lib/i18n/es.ts` desde la primera pantalla.
- Commits en español, Conventional Commits con alcance (`feat(http): …`). **Los pasos "Commit" se ejecutan solo al cerrar un lote y con el visto bueno del usuario** (nunca push/merge sin aprobación).
- Rama `fase-00-fundacion` en worktree (skill `using-git-worktrees`). Para componentes shadcn usar la skill `shadcn` y su CLI; no reescribir a mano uno existente.

## Foco de revisión (entradas que el spec implica y ninguna prueba base cubriría)

1. **Respuesta 204 / cuerpo vacío** (`approve`, `terminate`): el cliente no debe fallar al parsear JSON → Task 5.
2. **Error no JSON** (502/504 HTML de Nginx cuando el backend cae): debe dar `ApiError` genérico, no excepción de parseo → Task 5.
3. **`/config.js` con fallback de SPA:** si Nginx lo reescribe a `index.html`, la app carga HTML como script → Task 9.
4. **`localStorage` bloqueado o que lanza** (modo privado): el tema no debe romper el render → Task 6.
5. **Importes grandes** (`amountMinor` de hasta 18 dígitos): el schema generado debe conservarlos como string sin perder precisión → Task 3.

---

## Lotes

| Lote | Tareas | Resultado visible |
|---|---|---|
| L1 | 0, 1, 2, 3 | Proyecto, tooling y contrato generado |
| L2 | 4, 5, 6 | Config, cliente HTTP y tema |
| L3 | 7, 8, 9 | App con router, proxy de dev e imagen Docker |
| L4 | 10, 11, 12 | E2E local, CI, README y verificación |

---

### Task 0: Preparar rama y worktree

**Files:** ninguno nuevo.

- [ ] **Step 1:** pedir al usuario OK para commitear en `master` los documentos ya aprobados (`docs/superpowers/**`, `docs/backend/openapi.json`) con el mensaje `docs: spec del roadmap, ADR y spec/plan de la fase 0`.
- [ ] **Step 2:** invocar `using-git-worktrees` y crear la rama `fase-00-fundacion`. Confirmar con `git branch --show-current` → `fase-00-fundacion`.

---

### Task 1: Esqueleto del proyecto

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore`, `.editorconfig`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/lib/i18n/es.ts`, `src/test/setup.ts`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: scripts `dev`, `build`, `preview`, `typecheck` (`tsc -b --noEmit`), `test` (`vitest run`), `test:watch`, `lint`, `format`, `format:check`, `api:generate`, `ci:verify`; alias `@/`; `App(): JSX.Element`.

- [ ] **Step 1: Test que falla** — `App.test.tsx`: `render(<App />)` y `expect(screen.getByRole('heading', { name: 'Innmo MLS' })).toBeInTheDocument()`.
- [ ] **Step 2:** `pnpm test` → FAIL (`App` no existe / no hay proyecto).
- [ ] **Step 3:** crear el proyecto con `create-vite` (plantilla `react-ts`) en un directorio temporal, copiar al repo y ajustar: `strict: true`, alias `@/`, `engines.node` y `.nvmrc` con el Node LTS (el entorno usa 24), `packageManager` con la versión de pnpm, `build.sourcemap: false`, `server.host: 'app.localtest.me'`, `server.port: 5173`, entorno de test `jsdom` con `setupFiles: ['src/test/setup.ts']` (jest-dom). Dependencias de test: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. `App` devuelve un `<h1>` con el nombre del producto tomado de `src/lib/i18n/es.ts` (`es.app.name = 'Innmo MLS'`).
- [ ] **Step 4:** `pnpm test` → PASS; `pnpm typecheck` y `pnpm build` → sin errores.
- [ ] **Step 5:** Commit (al cerrar L1): `chore(proyecto): esqueleto Vite + React + TypeScript estricto`.

---

### Task 2: Calidad y reglas propias

**Files:**
- Create: `eslint.config.js`, `.prettierrc`, `.prettierignore`, `commitlint.config.js`, `.husky/pre-commit`, `.husky/commit-msg`, `eslint-rules/no-role-comparison.js`, `eslint-rules/feature-boundaries.js`
- Modify: `package.json` (lint-staged, scripts)
- Test: `eslint-rules/no-role-comparison.test.js`, `eslint-rules/feature-boundaries.test.js`

**Interfaces:**
- Produces: `no-role-comparison` (regla ESLint local, `create(context)`); `featureBoundaryConfig(features: string[]): FlatConfig[]` que, por cada `features/<f>/**`, prohíbe importar `@/features/<otra>/**` y rutas relativas hacia otra feature. `eslint.config.js` la usa leyendo `src/features/*` si existe.

- [ ] **Step 1: Tests que fallan**
  - `no-role-comparison.test.js` (con `RuleTester`): inválidos `membership.role === 'broker'`, `user.role !== "admin"`, `role == 'agent'`; válidos `can('property.read')`, `label = membership.role` y `role === otherVariable`… (solo se prohíbe comparar contra **literales de string**).
  - `feature-boundaries.test.js` (API `ESLint.lintText`): `featureBoundaryConfig(['agencies','members'])`; código `import x from '@/features/members/api'` con `filePath: 'src/features/agencies/a.ts'` → 1 error; el mismo import desde `src/features/members/b.ts` → 0 errores; importar `@/lib/http` desde cualquier feature → 0 errores.
- [ ] **Step 2:** ejecutar los tests → FAIL.
- [ ] **Step 3:** implementar las dos reglas, `eslint.config.js` (flat; `typescript-eslint` estricto, `react-hooks`, `react-refresh`; ignora `src/lib/api/generated`, `dist`), Prettier, lint-staged (`eslint --fix` y `prettier --write` sobre staged), Husky (`pre-commit` → lint-staged; `commit-msg` → `commitlint --edit`), commitlint extendiendo `config-conventional` con `subject-case` desactivado (commits en español).
- [ ] **Step 4:** `pnpm test` y `pnpm lint` → PASS. Verificar CA18: `echo "mensaje malo" | pnpm exec commitlint` → falla; `echo "feat(http): agrega cliente" | pnpm exec commitlint` → pasa.
- [ ] **Step 5:** Commit (L1): `chore(calidad): eslint, prettier, husky, commitlint y reglas propias`.

---

### Task 3: Contrato generado (spike + generación)

**Files:**
- Create: `openapi-ts.config.ts`, `src/lib/api/schemas.ts`, `src/lib/api/generated/**` (generado, **se versiona**), `src/lib/api/__fixtures__/me.json`
- Modify: `package.json` (`api:generate`), `.prettierignore`
- Test: `src/lib/api/schemas.test.ts`

**Interfaces:**
- Produces (fachada estable; el resto del código **solo importa de aquí**): `meResponseSchema`, `problemDetailsSchema`, `propertyDetailResponseSchema` (schemas Zod) y sus tipos `MeResponse`, `ProblemDetails`, `PropertyDetailResponse`. Si el generador nombra distinto, `schemas.ts` re-exporta con estos nombres.

- [ ] **Step 1 (spike, acotado):** instalar `@hey-api/openapi-ts` y probar contra `docs/backend/openapi.json` con plugins de tipos y Zod, **sin cliente**. Éxito = genera schemas para `MeResponse`, `ProblemDetails` y `PropertyDetailResponse`. Si falla o la salida no es utilizable, **detenerse y avisar al usuario**: plan B decidido es `orval` en modo Zod.
- [ ] **Step 2: Test que falla** — `schemas.test.ts`: (a) `meResponseSchema.parse(me.json)` pasa (fixture = ejemplo de §6 del contexto); (b) falla si `membership.permissions` tiene un alcance fuera de `own|agency|network`; (c) `problemDetailsSchema` acepta `{type,title,status,instance,code,requestId,details}` y `errors[]` de validación; (d) **importe grande:** el `amountMinor` `"999999999999999999"` de un `listPrices` en `propertyDetailResponseSchema` se conserva idéntico y de tipo `string`; un `number` se rechaza.
- [ ] **Step 3:** `pnpm test src/lib/api` → FAIL (no hay fachada).
- [ ] **Step 4:** configurar `openapi-ts.config.ts` (entrada `docs/backend/openapi.json`, salida `src/lib/api/generated`), script `api:generate`, y escribir `schemas.ts`. Cabecera "GENERADO, no editar" en el directorio.
- [ ] **Step 5:** `pnpm test` → PASS. **Idempotencia (CA5):** `pnpm api:generate && git diff --exit-code src/lib/api/generated` tras generar dos veces → sin cambios.
- [ ] **Step 6:** Commit (L1): `feat(contrato): generación de tipos y Zod desde openapi.json`.

> Cierre del **Lote 1**: mostrar al usuario resultados de `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y esperar visto bueno.

---

### Task 4: Configuración de runtime

**Files:**
- Create: `src/lib/config.ts`, `public/config.js`, `src/app/ConfigErrorScreen.tsx`
- Modify: `index.html` (cargar `/config.js` antes del módulo), `src/lib/i18n/es.ts`
- Test: `src/lib/config.test.ts`, `src/app/ConfigErrorScreen.test.tsx`

**Interfaces:**
- Produces: `appConfigSchema` (Zod), `type AppConfig = { APP_ENV: 'development'|'staging'|'production'; API_BASE_PATH: string; PLATFORM_API_BASE_PATH: string; TENANT_CODE: string; SENTRY_DSN?: string }`; `parseConfig(raw: unknown): AppConfig`; `loadConfig(win?: { __APP_CONFIG__?: unknown }): AppConfig`; `class ConfigError extends Error { issues: string[] }`; `ConfigErrorScreen({ error }: { error: ConfigError })`.

- [ ] **Step 1: Tests que fallan** — `parseConfig`: acepta el objeto válido; `API_BASE_PATH` debe empezar con `/` y no terminar en `/`; `SENTRY_DSN: ''` se normaliza a `undefined`; falta de `TENANT_CODE` lanza `ConfigError` cuyo `issues` incluye `TENANT_CODE`; `loadConfig({})` lanza `ConfigError` con mensaje que menciona `/config.js`. `ConfigErrorScreen` muestra el título (de `es.ts`), la lista de `issues` y **no** muestra stack traces.
- [ ] **Step 2:** `pnpm test src/lib/config` → FAIL.
- [ ] **Step 3:** implementar. `public/config.js` de desarrollo: `window.__APP_CONFIG__ = { APP_ENV: 'development', API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1', TENANT_CODE: 'co' }`.
- [ ] **Step 4:** tests → PASS. Commit (L2): `feat(config): configuración de runtime validada con Zod`.

---

### Task 5: Cliente HTTP

**Files:**
- Create: `src/lib/http/errors.ts`, `src/lib/http/request.ts`, `src/lib/http/client.ts`, `src/lib/http/handlers.ts`, `src/lib/http/index.ts`, `src/test/server.ts`
- Modify: `src/test/setup.ts` (MSW `server.listen({ onUnhandledRequest: 'error' })`, `resetHandlers`, `close`)
- Test: `src/lib/http/client.test.ts`

**Interfaces:**
- Consumes: `AppConfig` (Task 4), `problemDetailsSchema` (Task 3).
- Produces:
  - `type HostKind = 'country' | 'platform'`
  - `class ApiError extends Error { status: number; code: string; title: string; requestId?: string; details?: Record<string, unknown>; errors?: { path: string; code: string; message: string }[] }`
  - `class NetworkError extends Error { cause: unknown }`
  - `class ValidationError extends Error { issues: z.ZodIssue[]; url: string }`
  - `setHttpHandlers(h: { onUnauthorized?: (e: ApiError) => void; onForbidden?: (e: ApiError) => void }): void`
  - `createHttpClient(opts: { config: Pick<AppConfig,'API_BASE_PATH'|'PLATFORM_API_BASE_PATH'>; fetchImpl?: typeof fetch }): { request: <S extends z.ZodTypeAny>(o: { host: HostKind; path: string; method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'; query?: Record<string, string | number | undefined>; body?: unknown; schema: S; signal?: AbortSignal }) => Promise<z.infer<S>> }`

- [ ] **Step 1: Tests que fallan** (`client.test.ts`, MSW + `fetchImpl` espía donde se inspeccionan opciones):
  - país: `GET` a `host:'country', path:'/me'` llama `/v1/me`; plataforma llama `/plataforma/v1/admin/tenants/co/config`; `credentials` es `'include'` y `Accept: application/json`.
  - `query` omite valores `undefined` (`?limit=20` sin `cursor`).
  - 200 con JSON válido devuelve el dato parseado.
  - **204 sin cuerpo** con `schema: z.undefined()` resuelve `undefined` sin error de parseo.
  - `application/problem+json` 409 → `ApiError` con `status`, `code`, `title`, `requestId` y `details.propertyId`.
  - 400 `validation_failed` con `errors[]` → `ApiError.errors` poblado.
  - **502 con cuerpo HTML** → `ApiError` con `status: 502` y `code: 'unknown'` (no error de parseo).
  - JSON 200 que no cumple el schema → `ValidationError` (no `ApiError` ni `NetworkError`).
  - `fetch` que rechaza → `NetworkError`; `AbortController.abort()` → se relanza el `AbortError` original.
  - 401 invoca `onUnauthorized` una vez y aun así lanza `ApiError`; 403 invoca `onForbidden` con el error (`code: 'two_factor_required'`).
- [ ] **Step 2:** `pnpm test src/lib/http` → FAIL.
- [ ] **Step 3:** implementar. Detectar `problem+json` por `content-type`; para cuerpo vacío o no JSON, mapear solo por `status`. No añadir reintentos aquí (los decide TanStack Query, Task 7).
- [ ] **Step 4:** tests → PASS; `pnpm lint` confirma que no hay `fetch` fuera de `src/lib/http` (regla `no-restricted-globals` para `fetch` fuera de ese directorio, añadida a `eslint.config.js`). Commit (L2): `feat(http): cliente único con dos hosts y errores tipados`.

---

### Task 6: Tema claro/oscuro y UI base

**Files:**
- Create: `components.json`, `src/index.css`, `src/lib/utils.ts`, `src/components/ui/button.tsx` (vía CLI), `src/app/theme/ThemeProvider.tsx`, `src/app/theme/theme-storage.ts`, `src/app/theme/ThemeToggle.tsx`, `public/theme-init.js`
- Modify: `index.html` (cargar `/theme-init.js` en `<head>`), `src/lib/i18n/es.ts`
- Test: `src/app/theme/ThemeProvider.test.tsx`, `src/app/theme/theme-init.test.ts`

**Interfaces:**
- Produces: `type Theme = 'light'|'dark'|'system'`; `ThemeProvider({ children })`; `useTheme(): { theme: Theme; resolved: 'light'|'dark'; setTheme(t: Theme): void }`; `ThemeToggle()`; clave de almacenamiento `innmo-theme`.

- [ ] **Step 1: Tests que fallan**
  - Sin valor guardado y `matchMedia('(prefers-color-scheme: dark)')` verdadero → `resolved === 'dark'` y `<html>` tiene la clase `dark`.
  - `setTheme('light')` quita `dark` y guarda `innmo-theme = 'light'`.
  - **`localStorage` que lanza** (`getItem`/`setItem` simulados con `throw`) → el provider no rompe, usa `'system'` y `setTheme` funciona en memoria.
  - `ThemeToggle` tiene nombre accesible (de `es.ts`) y alterna entre claro y oscuro.
  - `theme-init.test.ts`: evaluar `public/theme-init.js` en jsdom con `innmo-theme = 'dark'` agrega la clase `dark`; con `localStorage` que lanza, no lanza.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** invocar la skill `shadcn`, ejecutar `shadcn init` (Tailwind) y `shadcn add button`. Definir tokens en `:root` y `.dark` con **contraste AA** y espaciados compactos como línea base (densidad alta). `theme-init.js` es script externo (sin inline, por la CSP).
- [ ] **Step 4:** tests → PASS; `pnpm build` genera CSS. Commit (L2): `feat(ui): tailwind, shadcn y tema claro/oscuro`.

> Cierre del **Lote 2**: mostrar `pnpm test`, `lint`, `typecheck`, `build` y esperar visto bueno.

---

### Task 7: Router, Query y arranque de la app

**Files:**
- Create: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routeTree.gen.ts` (generado, versionado), `src/app/providers.tsx`, `src/app/router.tsx`, `src/app/query-client.ts`, `src/app/bootstrap.tsx`
- Modify: `vite.config.ts` (plugin de TanStack Router con code splitting), `src/main.tsx`, `src/app/App.tsx` (se elimina; la página base pasa a `src/routes/index.tsx`), `src/lib/i18n/es.ts`
- Test: `src/app/query-client.test.ts`, `src/app/bootstrap.test.tsx`

**Interfaces:**
- Consumes: `loadConfig`/`ConfigError`/`ConfigErrorScreen` (Task 4), `createHttpClient` (Task 5), `ThemeProvider`/`ThemeToggle` (Task 6).
- Produces: `shouldRetry(failureCount: number, error: unknown): boolean`; `createQueryClient(): QueryClient`; `renderApp(container: HTMLElement, win: Window & { __APP_CONFIG__?: unknown }): void`; contexto `useAppConfig(): AppConfig`.

- [ ] **Step 1: Tests que fallan**
  - `shouldRetry`: `false` para `ApiError` con `status` 400–499; `true` para `ApiError` 5xx y `NetworkError` hasta 2 reintentos (`failureCount < 2`); `false` para `ValidationError`.
  - `renderApp` con config válida en `/` muestra el `<h1>` "Innmo MLS" y el conmutador de tema; en `/ruta-que-no-existe` muestra "Página no encontrada" (texto de `es.ts`); con `__APP_CONFIG__` inválido renderiza `ConfigErrorScreen` y **no** monta el router.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** implementar. `QueryClient` con `staleTime` de 30 s, `retry: shouldRetry`, sin refetch en foco por defecto. Rutas por archivos con `autoCodeSplitting`. Layout raíz sin sidebar (llega en F2). Página base sobria: nombre del producto y conmutador.
- [ ] **Step 4:** `pnpm test` → PASS; `pnpm build` → PASS; comprobar que el bundle inicial se mide y registrar el tamaño gzip (presupuesto propuesto ≤ 200 kB, Q12).
- [ ] **Step 5:** Commit (L3): `feat(app): router, query client y página base`.

---

### Task 8: Proxy de desarrollo

**Files:**
- Create: `vite.proxy.ts`, `.env.example`
- Modify: `vite.config.ts`
- Test: `vite.proxy.test.ts`

**Interfaces:**
- Produces: `buildProxy(env: { API_TARGET: string; TENANT_CODE: string; PLATFORM_HOST: string }): Record<string, { target: string; headers: Record<string,string>; rewrite?: (path: string) => string }>`.

- [ ] **Step 1: Test que falla** — con `{ API_TARGET:'http://localhost:3000', TENANT_CODE:'co', PLATFORM_HOST:'admin.api.localtest.me' }`: la clave `/v1` apunta al target con header `X-Tenant: co`; la clave `/plataforma/v1` apunta al mismo target, su `rewrite('/plataforma/v1/admin/tenants/co/config')` devuelve `/v1/admin/tenants/co/config` y envía `Host: admin.api.localtest.me`.
- [ ] **Step 2:** FAIL → implementar → PASS. Valores por defecto en `.env.example` (`API_TARGET=http://localhost:3000`, `TENANT_CODE=co`, `PLATFORM_HOST=admin.api.localtest.me`). Nota en el archivo: el proxy de plataforma se confirma con el backend corriendo (Q11).
- [ ] **Step 3:** Commit (L3): `feat(dev): proxy de mismo origen hacia país y plataforma`.

---

### Task 9: Imagen Docker + Nginx

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker/nginx/default.conf.template`, `docker/nginx/security-headers.conf`, `docker/entrypoint/40-config-js.sh`, `docker/config.js.template`, `scripts/verify-image.sh`
- Test: `scripts/verify-image.sh` (script de verificación; falla con código ≠ 0)

**Interfaces:**
- Produces: imagen `inmo-mls-front:local`; variables del contenedor `APP_ENV`, `API_BASE_PATH`, `PLATFORM_API_BASE_PATH`, `TENANT_CODE`, `SENTRY_DSN` (van a `/config.js`) y `API_UPSTREAM`, `API_TENANT_HOST`, `PLATFORM_API_UPSTREAM`, `PLATFORM_API_HOST` (solo Nginx).

- [ ] **Step 1: Verificación que falla** — `scripts/verify-image.sh` construye la imagen, la arranca con un conjunto de variables y comprueba con `curl`/`docker exec`:
  - `GET /health` → 200; el proceso corre con UID ≠ 0.
  - `GET /` → `Cache-Control` con `no-cache`; un asset con hash de `/assets/` → `Cache-Control` con `max-age=31536000` e `immutable`.
  - `GET /una/ruta/inexistente` → 200 con HTML de la app (fallback SPA).
  - **`GET /config.js` → `Content-Type` JavaScript (nunca HTML), `Cache-Control: no-store` y contiene el `TENANT_CODE` pasado.** Reiniciar el contenedor con otro `TENANT_CODE` y comprobar que cambia sin reconstruir (CA14).
  - Cabeceras: CSP sin `unsafe-inline` en `script-src`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`.
  - `GET /v1/me` con upstream inalcanzable → 502/504 (se proxea; **no** devuelve `index.html`).
  - No hay archivos `*.map` en la imagen.
- [ ] **Step 2:** ejecutarlo → FAIL (no hay imagen).
- [ ] **Step 3:** implementar: `Dockerfile` multi-stage `deps` → `build` (Node LTS alpine, `pnpm install --frozen-lockfile`) → `runtime` (`nginxinc/nginx-unprivileged`). `default.conf.template` con `location = /config.js { try_files $uri =404; add_header Cache-Control "no-store"; }` **antes** del fallback, `location /v1/` y `location /plataforma/v1/` (esta última reescribe a `/v1/` y fija `proxy_set_header Host $PLATFORM_API_HOST`; `/v1/` fija `Host $API_TENANT_HOST`; sin tocar cookies), `/health`, gzip. **Brotli:** solo si la imagen base incluye el módulo (verificarlo); si no, gzip y anotarlo en el README. `40-config-js.sh` genera `/config.js` con `envsubst` limitado a las cinco variables públicas. CSP con `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`.
- [ ] **Step 4:** `bash scripts/verify-image.sh` → todas las comprobaciones en verde.
- [ ] **Step 5:** Commit (L3): `feat(docker): imagen multi-stage con Nginx y config de runtime`.

> Cierre del **Lote 3**: mostrar tests, build y salida de `verify-image.sh`; esperar visto bueno.

---

### Task 10: Compose y e2e local (Playwright en Docker)

**Files:**
- Create: `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.e2e.yml`, `e2e/playwright.config.ts`, `e2e/smoke.spec.ts`
- Test: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: imagen de Task 9.
- Produces: `docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm playwright` ejecuta el humo contra la imagen servida por Nginx; `docker-compose.prod.yml` (`restart: unless-stopped`, `healthcheck` sobre `/health`, límites de CPU/memoria).

- [ ] **Step 1: Tests que fallan** (`smoke.spec.ts`):
  - carga `/` y ve el encabezado "Innmo MLS"; no hay errores de consola ni violaciones de CSP (`securitypolicyviolation`).
  - el conmutador alterna a oscuro, `<html>` tiene `dark`, y tras recargar persiste.
  - con `page.route('**/config.js', …)` devolviendo una config inválida, se ve la pantalla de error de configuración.
  - `request.get('/')` incluye las cabeceras de seguridad de CA13.
- [ ] **Step 2:** ejecutar → FAIL (sin compose).
- [ ] **Step 3:** escribir los tres compose. `docker-compose.yml` levanta `web` (imagen de producción, puerto `8080`, variables con `API_UPSTREAM` configurable para backend en el host o en red compartida). `docker-compose.e2e.yml` añade el servicio `playwright` (imagen oficial de Playwright) con `BASE_URL=http://web:8080`.
- [ ] **Step 4:** correr el e2e → PASS. (No corre en CI: **Decidido**.)
- [ ] **Step 5:** Commit (L4): `test(e2e): humo con Playwright en Docker y compose`.

---

### Task 11: CI y README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`
- Modify: `package.json` (`ci:verify`)

**Interfaces:**
- Produces: script `ci:verify` que ejecuta en orden `lint`, `typecheck`, `test`, `build`, `api:generate` + `git diff --exit-code src/lib/api/generated`, `audit` (`pnpm audit --audit-level=high`). El workflow ejecuta los mismos pasos y además `docker build`.

- [ ] **Step 1:** escribir `ci.yml`: disparadores `pull_request` y `push` a `main`; `permissions: contents: read`; `pnpm/action-setup` + `actions/setup-node` con caché de pnpm; `pnpm install --frozen-lockfile`; los pasos de `ci:verify`; `docker build`. Sin e2e.
- [ ] **Step 2: Verificación** — validar sintaxis con `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest` → sin errores; ejecutar `pnpm ci:verify` localmente → exit 0. (El primer run real en GitHub confirma CA16 cuando exista el remoto.)
- [ ] **Step 3:** `README.md` en español: requisitos, `pnpm install && pnpm dev` en `http://app.localtest.me:5173`, proxy y variables, `pnpm api:generate` y cómo actualizar `docs/backend/openapi.json`, build/arranque con Docker, variables de entorno (frontend vs Nginx), e2e local, convención de commits y la nota de Brotli.
- [ ] **Step 4:** Commit (L4): `ci: workflow de GitHub Actions y README`.

---

### Task 12: Verificación contra el spec y cierre

**Files:** ninguno nuevo.

- [ ] **Step 1:** invocar `verification-before-completion` y ejecutar la matriz; registrar la salida real de cada comando:

| CA | Comando / evidencia |
|---|---|
| CA1, CA10 | `pnpm dev` + abrir `http://app.localtest.me:5173`; e2e de tema |
| CA2 | `pnpm typecheck` |
| CA3, CA4 | `pnpm test` (reglas ESLint) + `pnpm lint` |
| CA5 | `pnpm api:generate` dos veces + `git diff --exit-code` |
| CA6–CA8 | `pnpm test src/lib/http src/lib/api` |
| CA9 | `pnpm test src/lib/config` + e2e de config inválida |
| CA11 | `pnpm test` (MSW con `onUnhandledRequest: 'error'`) |
| CA12–CA14 | `bash scripts/verify-image.sh` |
| CA15 | `pnpm build` (sin `*.map`) + `pnpm audit --audit-level=high` |
| CA16 | `pnpm ci:verify` + actionlint |
| CA17 | e2e en Docker |
| CA18 | prueba manual del hook de commit |

- [ ] **Step 2:** cierre de fase según el prompt: `requesting-code-review` (una sola revisión), revisión de **vercel-react-best-practices** (solo reglas de cliente), checklist de seguridad del prompt, `docker compose build` y arranque, y `finishing-a-development-branch`.
- [ ] **Step 3:** resumen de cierre: qué se hizo, qué cambió respecto al plan, deuda técnica y preguntas abiertas que siguen (Q11, Q12).
