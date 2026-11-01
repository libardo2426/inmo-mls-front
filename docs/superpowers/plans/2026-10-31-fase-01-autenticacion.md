# Fase 1 — Autenticación y seguridad base — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:executing-plans` (ejecución inline, nunca `subagent-driven-development`). Los pasos usan casillas `- [ ]`. TDD en cada tarea: el test se escribe y se ve fallar antes del código.

**Goal:** Que un admin MLS pueda iniciar sesión, activar y usar 2FA (TOTP y código de respaldo), recuperar su contraseña y cerrar sesión, con el manejo global de 401/403/429/503 resuelto una sola vez.

**Architecture:** Módulo `features/auth` sobre el cliente `lib/http` (sin la librería `better-auth` en el bundle). El estado de sesión se deriva de `GET /v1/me` (`meQuery`) y lo resuelven guardas `beforeLoad` de TanStack Router con `queryClient` y `http` en el contexto. Los errores de Better Auth (`{ code, message }`, 429 con `X-Retry-After`) se normalizan en `lib/http`.

**Tech Stack:** React 19.3.1, TypeScript 6.0.3, Vite 8.3.5, TanStack Router 1.170.46 y Query 5.105.0, Zod 4.6.7, shadcn (radix/nova), Vitest 5.0.5 + MSW 3.0.3, Playwright 1.64.1, `qrcode.react` (nueva, versión exacta).

**Spec:** `docs/superpowers/specs/2026-10-31-fase-01-autenticacion-design.md` (CA1–CA22). Contexto: `docs/backend/contexto-para-frontend.md` §5–6, ADR-0003.

## Global Constraints

- Versiones **exactas** de dependencias (`.npmrc save-exact=true`); la CLI de shadcn añade rangos `^`: se fijan a mano tras cada `add`.
- Commits en español, Conventional Commits, con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Sin push ni merge sin aprobación.
- Solo `src/lib/http` usa `fetch`. Sin tokens, contraseñas ni códigos en `localStorage`/`sessionStorage`, consola o URL. Sin `unsafe-inline` en `script-src`; sin `dangerouslySetInnerHTML`.
- Textos de UI en español, centralizados en `src/lib/i18n/es.ts` (namespace `auth`); los tests importan `es` en lugar de repetir cadenas.
- Contraseña nueva: mínimo **12** caracteres. Sin «confiar en este dispositivo» (`trustDevice`). Autorización por permisos, nunca por rol.
- Rutas: `/iniciar-sesion`, `/verificar`, `/activar-2fa`, `/recuperar`, `/restablecer`, `/sin-acceso`, `/mantenimiento`, `/sin-conexion`; `/` queda protegida.
- MSW en modo estricto (`onUnhandledFrame: 'error'`). Los handlers usan comodín de origen: `'*/v1/me'`.
- Código generado (`src/lib/api/generated`, `src/routeTree.gen.ts`) no se edita a mano; este último se regenera con el plugin y se versiona.

## Review Focus

1. `redirect` malicioso (`//evil.com`, `/\evil.com`, `https://x`, `javascript:`) → se ignora y se va a `/` (Task 3).
2. El login devuelve un `token` en el cuerpo → no sale del schema ni se escribe en ningún almacenamiento (Tasks 2 y 5).
3. Doble envío del formulario (doble clic o Enter repetido) → un solo POST (Tasks 5 y 6).
4. 429 sin `X-Retry-After` o con valor no numérico → mensaje de espera genérico, nunca «NaN» (Tasks 1 y 3).
5. `/restablecer` sin `#token=` o con token vacío → mensaje de enlace inválido con salida a `/recuperar` (Task 8).

---

### Task 0: Preparación (worktree, dependencias, componentes, verificación en vivo)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/components/ui/{input,label,field,card,alert,spinner,input-otp,checkbox}.tsx` (los genera shadcn)

**Interfaces:**
- Produces: componentes shadcn `Input`, `Label`, `Field*`, `Card*`, `Alert`, `Spinner`, `InputOTP*`, `Checkbox`; dependencia `qrcode.react` (`QRCodeSVG`).

- [ ] **Step 1: Crear el worktree** `.claude/worktrees/fase-01-autenticacion` con la rama `fase-01-autenticacion` desde `master` (`git worktree add`), y el espacio de trabajo/ledger de `executing-plans`. Copiar el plan y el spec si no están en la rama. Ejecutar `pnpm install --frozen-lockfile`.
- [ ] **Step 2: Añadir componentes** con `pnpm dlx shadcn@4.23.0 add input label field card alert spinner input-otp checkbox`. Revisar los archivos creados (reglas de la skill `shadcn`), fijar a versión exacta cualquier dependencia con `^` que la CLI haya añadido y comprobar `pnpm lint` y `pnpm typecheck`.
- [ ] **Step 3: Añadir `qrcode.react`** con `pnpm add qrcode.react@<última estable verificada con pnpm view>`; `pnpm audit --audit-level=high` debe salir con código 0.
- [ ] **Step 4: Verificar en vivo los cuerpos de Better Auth** (spec §5, «Pendiente de comprobar»). Si el backend no responde en `http://localhost:3000`, pedir a la sesión `backend` o al usuario que lo levante; si sigue sin estar, anotar `Ruling: cuerpos no verificados en vivo; se verifican en Task 11` y continuar. Con el backend arriba y una cuenta creada con `POST /v1/auth/sign-up/email` (cabeceras `X-Tenant: co`, `Origin: http://app.localtest.me:5173`), anotar en el ledger la respuesta real de: `sign-in/email` (con y sin 2FA), `sign-out` (cuerpo requerido), `request-password-reset` (¿exige `redirectTo`?) y un 429 de `sign-in/email` (6 intentos seguidos). No guardar contraseñas en archivos versionados.
- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui
git commit -m "chore(ui): componentes shadcn de formulario y qrcode.react para F1"
```

---

### Task 1: `lib/http` — Retry-After, `message` y contexto de petición en los manejadores

**Files:**
- Modify: `src/lib/http/errors.ts`, `src/lib/http/request.ts`, `src/lib/http/handlers.ts`, `src/lib/http/index.ts`
- Test: `src/lib/http/client.test.ts`

**Interfaces:**
- Produces: `ApiError.retryAfterSeconds?: number | undefined`; `HttpHandlers.onUnauthorized?(error: ApiError, request: { host: HostKind; path: string }): void` y lo mismo para `onForbidden` (compatible: un manejador que ignora el segundo argumento sigue funcionando).

- [ ] **Step 1: Escribir los tests que fallan** en `client.test.ts` (grupo «errores de Better Auth»):
  - `body {code:'INVALID_CODE', message:'Invalid code'} status 400 json` → `ApiError` con `code === 'INVALID_CODE'` y `title === 'Invalid code'`.
  - `429 {message:'Too many requests...'} + header X-Retry-After: 42` → `status 429`, `code === 'unknown'`, `retryAfterSeconds === 42`.
  - `429` con `Retry-After: 7` (cabecera estándar) → `7`.
  - `429` con `X-Retry-After: abc` y otro sin cabecera → `retryAfterSeconds === undefined`.
  - `401` en `/auth/sign-in/email` → `onUnauthorized` recibe `(error, { host: 'country', path: '/auth/sign-in/email' })`.
- [ ] **Step 2: Ejecutar** `pnpm test src/lib/http` → fallan por propiedades inexistentes.
- [ ] **Step 3: Implementar** en `request.ts`: `looseProblemSchema` acepta `message`; título = `title ?? message ?? \`Error ${status}\``; función `parseRetryAfter(headers: Headers): number | undefined` (lee `retry-after` y luego `x-retry-after`, solo enteros ≥ 0); `ApiErrorInit` y la clase llevan `retryAfterSeconds`; los manejadores reciben `{ host: o.host, path: o.path }`. Actualizar los tipos de `handlers.ts`.
- [ ] **Step 4: Ejecutar** `pnpm test` y `pnpm typecheck` → todo en verde (los 14 tests previos de `client.test.ts` siguen pasando).
- [ ] **Step 5: Commit** — `feat(http): Retry-After, mensaje de Better Auth y contexto en los manejadores`

---

### Task 2: `features/auth/api` — schemas y las siete funciones

**Files:**
- Create: `src/features/auth/api/schemas.ts`, `src/features/auth/api/auth-api.ts`, `src/features/auth/api/totp-uri.ts`, `src/features/auth/hooks/useAuthApi.ts`
- Test: `src/features/auth/api/auth-api.test.ts`, `src/features/auth/api/totp-uri.test.ts`

**Interfaces:**
- Consumes: `HttpClient` de `@/lib/http` (`request({host:'country', path, method:'POST', body, schema})`).
- Produces:

```ts
export type SignInResult = { kind: 'session' } | { kind: 'two-factor' };
export type EnableTwoFactorResult = { totpURI: string; backupCodes: string[] };
export type AuthApi = {
  signInEmail(input: { email: string; password: string }): Promise<SignInResult>;
  verifyTotp(code: string): Promise<void>;
  verifyBackupCode(code: string): Promise<void>;
  enableTwoFactor(password: string): Promise<EnableTwoFactorResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(input: { newPassword: string; token: string }): Promise<void>;
};
export function createAuthApi(http: HttpClient): AuthApi;
export function useAuthApi(): AuthApi; // memoizado sobre useHttpClient()
export function secretFromTotpUri(uri: string): string | null;
```

- [ ] **Step 1: Tests que fallan** (`auth-api.test.ts`, MSW con `'*/v1/auth/...'`, cliente real con `createHttpClient({ config, origin })` como en `client.test.ts`):
  - `signInEmail` envía `POST /v1/auth/sign-in/email` con `{email,password}` y `credentials: 'include'`; respuesta `{twoFactorRedirect:true,twoFactorMethods:['totp']}` → `{kind:'two-factor'}`.
  - Respuesta de sesión `{redirect:false, token:'SECRETO', user:{id:'u1'}}` → `{kind:'session'}` y `JSON.stringify(resultado)` **no contiene** `'SECRETO'`.
  - `verifyTotp('123456')` → cuerpo exacto `{code:'123456'}` (sin `trustDevice`); `verifyBackupCode('abc-def')` → `{code:'abc-def'}`.
  - `enableTwoFactor('pw')` → cuerpo `{password:'pw'}`, devuelve `{totpURI, backupCodes}` de la respuesta `{method:'totp', totpURI, backupCodes}`; una respuesta sin `totpURI` lanza `ValidationError`.
  - `signOut()` → `POST /v1/auth/sign-out` (cuerpo según Task 0; por defecto `{}`).
  - `requestPasswordReset('a@b.co')` → `{email:'a@b.co'}` (más `redirectTo` solo si Task 0 comprobó que es obligatorio); `resetPassword({newPassword, token})` → `{newPassword, token}`.
  - Un 400 `{code:'INVALID_CODE',message:'x'}` en `verifyTotp` lanza `ApiError` con ese `code`.
  - `secretFromTotpUri('otpauth://totp/Innmo%20MLS:a@b.co?secret=ABC123&issuer=Innmo%20MLS')` → `'ABC123'`; una URI sin `secret` o un texto no válido → `null`.
- [ ] **Step 2: Ejecutar** `pnpm test src/features/auth/api` → fallan (módulos inexistentes).
- [ ] **Step 3: Implementar** los schemas (Zod; `signIn` como unión: `{twoFactorRedirect: z.literal(true), ...}` → `two-factor`, y objeto genérico con `.transform(() => ({kind:'session'}))` que descarta todo lo demás; respuestas de verify/sign-out/reset con `z.object({}).loose()`), `createAuthApi`, `useAuthApi` (`useMemo` sobre `useHttpClient()`) y `secretFromTotpUri` (`new URL` en `try/catch`).
- [ ] **Step 4: Ejecutar** `pnpm test src/features/auth/api && pnpm typecheck && pnpm lint` → verde.
- [ ] **Step 5: Commit** — `feat(auth): módulo de API de Better Auth sobre lib/http`

---

### Task 3: Sesión, guardas y mensajes de error

**Files:**
- Create: `src/features/auth/session/me.ts`, `src/features/auth/session/guard.ts`, `src/features/auth/messages.ts`, `src/test/fixtures.ts`
- Modify: `src/lib/i18n/es.ts` (namespace `auth.errors`)
- Test: `src/features/auth/session/me.test.ts`, `src/features/auth/session/guard.test.ts`, `src/features/auth/messages.test.ts`

**Interfaces:**
- Consumes: `HttpClient`, `meResponseSchema`/`MeResponse` de `@/lib/api/schemas`, `ApiError`/`NetworkError` de `@/lib/http`, `QueryClient`.
- Produces:

```ts
export function meQueryOptions(http: HttpClient): /* queryOptions: key ['me'], retry:false, staleTime 60_000 */;
export type SessionState =
  | { status: 'authenticated'; me: MeResponse }
  | { status: 'anonymous' } | { status: 'two-factor-required' } | { status: 'no-membership' }
  | { status: 'unavailable' } | { status: 'offline' };
export function resolveSession(queryClient: QueryClient, http: HttpClient): Promise<SessionState>;
export type GuardRule = 'protected' | 'public-only' | 'two-factor-setup' | 'no-access';
export type GuardTarget = { to: string; search?: { redirect: string } } | null;
export function guardTarget(rule: GuardRule, state: SessionState, returnTo: string): GuardTarget;
export function safeRedirect(raw: string | undefined): string;
export function authErrorMessage(error: unknown): string;
export function meFixture(overrides?: Partial<MeResponse>): MeResponse; // en src/test/fixtures.ts, base __fixtures__/me.json con membership.role 'admin'
```

- [ ] **Step 1: Tests que fallan:**
  - `resolveSession` (MSW sobre `/v1/me`): 200 con `membership` → `authenticated`; 200 con `membership:null` → `no-membership`; 401 → `anonymous`; 403 `two_factor_required` → `two-factor-required`; 403 `no_membership` → `no-membership`; 503 `tenant_unavailable` → `unavailable`; error de red (`HttpResponse.error()`) → `offline`; 500 → **relanza** el `ApiError`.
  - `guardTarget` (tabla): `protected` + `anonymous` → `{to:'/iniciar-sesion', search:{redirect:returnTo}}`; `protected` + `two-factor-required` → `/activar-2fa`; `protected` + `no-membership` → `/sin-acceso`; `protected` + `unavailable` → `/mantenimiento`; `protected` + `offline` → `/sin-conexion`; `protected` + `authenticated` → `null`; `public-only` + `authenticated` → `{to:'/'}`; `public-only` + `two-factor-required` → `/activar-2fa`; `public-only` + `anonymous`/`offline`/`unavailable` → `null`; `two-factor-setup` + `two-factor-required` → `null`, + `anonymous` → login con `redirect`, + `authenticated` → `/`; `no-access` + `no-membership` → `null`, + `anonymous` → login, + `authenticated` → `/`.
  - `safeRedirect`: `'/propiedades?x=1'` → igual; `undefined`, `''`, `'//evil.com'`, `'/\\evil.com'`, `'https://evil.com'`, `'javascript:alert(1)'`, `'evil'`, `'/a\nb'` → `'/'`.
  - `authErrorMessage`: `ApiError` 429 con `retryAfterSeconds: 30` → texto que contiene `30`; 429 sin `retryAfterSeconds` → texto genérico de espera y **no** contiene `NaN`/`undefined`; `INVALID_EMAIL_OR_PASSWORD` → `es.auth.errors.credentials`; `INVALID_CODE` e `INVALID_BACKUP_CODE` → `codeInvalid`; `INVALID_PASSWORD` → `passwordInvalid`; `INVALID_TOKEN` → `tokenInvalid`; `ACCOUNT_TEMPORARILY_LOCKED` y `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE` → `locked`; `INVALID_TWO_FACTOR_COOKIE` → `twoFactorExpired`; `INVALID_ORIGIN` y `MISSING_OR_NULL_ORIGIN` → `origin`; `NetworkError` → `network`; cualquier otro → `generic`, que incluye el `requestId` si existe.
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar** los tres módulos, `meFixture` y las cadenas `es.auth.errors.*` (la de rate limit es una función `(seconds?: number) => string`). `resolveSession` usa `queryClient.fetchQuery` y traduce errores por `code`/clase; nunca lee cookies.
- [ ] **Step 4: Ejecutar** `pnpm test src/features/auth && pnpm typecheck && pnpm lint` → verde.
- [ ] **Step 5: Commit** — `feat(auth): estado de sesión desde /me, guardas y mensajes de error`

---

### Task 4: Cableado del router, contexto, manejadores globales y rutas de estado

**Files:**
- Create: `src/features/auth/session/handlers.ts`, `src/features/auth/session/enforce.ts`, `src/test/mount.ts`, `src/routes/_protegido.tsx`, `src/routes/mantenimiento.tsx`, `src/routes/sin-conexion.tsx`, `src/features/auth/screens/StatusScreen.tsx`
- Move: `src/routes/index.tsx` → `src/routes/_protegido/index.tsx` (la página mínima de `/` se completa en Task 9)
- Modify: `src/app/router.tsx`, `src/app/providers.tsx`, `src/app/bootstrap.tsx`, `src/routes/__root.tsx`, `src/lib/i18n/es.ts` (`auth.status`), `src/routeTree.gen.ts` (regenerado)
- Test: `src/features/auth/session/handlers.test.ts`, `src/features/auth/session/enforce.test.ts`, `src/app/bootstrap.test.tsx` (ajustado), `src/app/providers.test.tsx` si existe

**Interfaces:**
- Consumes: Task 1 (`setHttpHandlers`, contexto de petición), Task 3 (`resolveSession`, `guardTarget`, `safeRedirect`).
- Produces:

```ts
export type RouterContext = { queryClient: QueryClient; http: HttpClient };
export function createAppRouter(opts: { queryClient: QueryClient; http: HttpClient; history?: RouterHistory }): Router;
// Providers ahora recibe queryClient y http ya creados:
export function Providers(props: { config: AppConfig; queryClient: QueryClient; http: HttpClient; children: ReactNode }): JSX.Element;
export function enforce(rule: GuardRule, args: { context: RouterContext; location: { href: string } }): Promise<void>; // lanza redirect() de TanStack si guardTarget != null
export function installAuthHandlers(deps: { queryClient: QueryClient; navigate: (to: { to: string; search?: { redirect: string } }) => void; currentPath: () => string }): void;
// src/test/mount.ts
export function mountApp(path: string): { container: HTMLElement; unmount(): void }; // renderApp con config válida y createMemoryHistory
```

- [ ] **Step 1: Tests que fallan:**
  - `installAuthHandlers`: 401 en `{path:'/properties'}` con la ruta actual `/` → `queryClient` queda vacío y `navigate` recibe `{to:'/iniciar-sesion', search:{redirect:'/'}}`; 401 con `path:'/auth/sign-in/email'` o `'/me'` → **no** navega; 401 estando ya en `/iniciar-sesion` → no navega; 403 `two_factor_required` (path `/properties`) → `navigate({to:'/activar-2fa'})`; 403 `no_membership` → `/sin-acceso`; 403 con otro `code` → no navega.
  - `enforce` con MSW: `/me` 401 en `protected` lanza un redirect a `/iniciar-sesion` con `redirect` = `location.href`.
  - `/mantenimiento` y `/sin-conexion` (con `mountApp`) muestran su título de `es.auth.status` y un botón «Reintentar» que navega a `/` (CA17); un 503 `tenant_unavailable` en `/me` al entrar a `/` termina en `/mantenimiento` y un fallo de red en `/sin-conexion`.
  - `bootstrap.test.tsx` actualizado: con `/me` 200 (`meFixture()`), `/` muestra el encabezado y el conmutador de tema; con `/me` 401, `/` termina mostrando el título de `es.auth.login` (la pantalla llega en Task 5: por ahora se acepta que la ruta `/iniciar-sesion` exista y el test se completa allí — dejar este caso marcado `it.todo` con el nombre `sin sesión, / redirige a /iniciar-sesion`); la ruta inexistente y la config inválida siguen igual.
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar:** `renderApp` crea una sola vez `queryClient = createQueryClient()` y `http = createHttpClient({ config })`, los pasa a `createAppRouter` y a `Providers`; `__root.tsx` usa `createRootRouteWithContext<RouterContext>()`; `_protegido.tsx` define `beforeLoad: (a) => enforce('protected', a)`; `installAuthHandlers` se registra tras crear el router (en `bootstrap.tsx`) con `navigate: router.navigate`; `StatusScreen` renderiza título/ayuda/botón «Reintentar» (navega a `/`) para `/mantenimiento` y `/sin-conexion` con textos de `es.auth.status`. Los 401 de `/me` los resuelve la guarda, no el manejador.
- [ ] **Step 4: Ejecutar** `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → verde; `routeTree.gen.ts` regenerado y versionado.
- [ ] **Step 5: Commit** — `feat(auth): contexto del router, guardas y manejo global de 401/403`

---

### Task 5: Pantalla de inicio de sesión

**Files:**
- Create: `src/features/auth/components/AuthCard.tsx`, `src/features/auth/screens/LoginPage.tsx`, `src/routes/iniciar-sesion.tsx`
- Modify: `src/lib/i18n/es.ts` (`auth.login`)
- Test: `src/features/auth/screens/LoginPage.test.tsx`; completar el `it.todo` de `bootstrap.test.tsx`

**Interfaces:**
- Consumes: `useAuthApi()`, `meQueryOptions`, `safeRedirect`, `authErrorMessage`, `mountApp`.
- Produces: ruta `/iniciar-sesion` con `validateSearch: z.object({ redirect: z.string().optional() })`, `beforeLoad: (a) => enforce('public-only', a)`; componente `AuthCard({ title, children })` reutilizado por las demás pantallas.

- [ ] **Step 1: Tests que fallan** (`mountApp('/iniciar-sesion?redirect=%2Fpropiedades')` con MSW):
  - Muestra el título `es.auth.login.title`, campos con etiqueta de correo y contraseña (`autocomplete` `username` y `current-password`) y enlace a `/recuperar`.
  - Login correcto sin 2FA (`sign-in` → sesión; luego `/me` 200) → se navega a la ruta del `redirect`; con `redirect=//evil.com` → a `/`.
  - Login con `twoFactorRedirect` → la URL pasa a `/verificar`.
  - `/me` devuelve 403 `two_factor_required` tras un login correcto → la URL pasa a `/activar-2fa`.
  - Credenciales inválidas (400 `INVALID_EMAIL_OR_PASSWORD`) → `Alert` con `es.auth.errors.credentials`, el foco queda en la alerta y los campos conservan el correo (la contraseña se vacía).
  - 429 con `X-Retry-After: 30` → alerta con «30» y botón deshabilitado durante la cuenta atrás.
  - **Doble envío:** dos clics seguidos en «Entrar» → MSW recibe **una** petición a `sign-in`.
  - **Respuesta con `token`:** tras un login correcto, `Storage.prototype.setItem` (espía) nunca se llamó y `console` no registró el token.
  - Con `/me` 200 al entrar, `/iniciar-sesion` redirige a `/`.
  - Caso pendiente de Task 4: con `/me` 401, `/` termina en el título de login.
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar** `LoginPage` (estado controlado, validación Zod de correo y contraseña no vacía en el envío, `useMutation` o estado `pending` que bloquea el reenvío, cuenta atrás a partir de `retryAfterSeconds`, `aria-live` en la alerta). Tras éxito sin 2FA: `queryClient.removeQueries({ queryKey: ['me'] })` y `navigate({ to: safeRedirect(search.redirect) })`; la guarda decide si hace falta 2FA o sin acceso.
- [ ] **Step 4: Ejecutar** `pnpm test && pnpm typecheck && pnpm lint` → verde.
- [ ] **Step 5: Commit** — `feat(auth): pantalla de inicio de sesión`

---

### Task 6: Verificación 2FA (`/verificar`)

**Files:**
- Create: `src/features/auth/screens/VerifyPage.tsx`, `src/routes/verificar.tsx`
- Modify: `src/lib/i18n/es.ts` (`auth.verify`)
- Test: `src/features/auth/screens/VerifyPage.test.tsx`

**Interfaces:**
- Consumes: `useAuthApi().verifyTotp/verifyBackupCode`, `AuthCard`, `InputOTP`, `authErrorMessage`.
- Produces: ruta `/verificar` (`enforce('public-only', …)`, `validateSearch` con `redirect` opcional como el login).

- [ ] **Step 1: Tests que fallan:**
  - Escribir 6 dígitos envía `POST /v1/auth/two-factor/verify-totp` con `{code}` (sin `trustDevice`), y al éxito navega a `redirect`/`/` (tras `removeQueries(['me'])`).
  - Código inválido (400 `INVALID_CODE`) → alerta `es.auth.errors.codeInvalid` y el campo se vacía y recupera el foco.
  - El enlace «usar código de respaldo» cambia a un campo de texto (`autocomplete="off"`) que envía a `verify-backup-code`.
  - `INVALID_TWO_FACTOR_COOKIE` → mensaje `twoFactorExpired` con enlace a `/iniciar-sesion`.
  - 429 → mensaje con la espera y entrada deshabilitada durante la cuenta atrás.
  - **Doble envío:** completar el OTP y pulsar «Verificar» a la vez → una sola petición.
  - `autocomplete="one-time-code"` en el campo TOTP.
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar** `VerifyPage` reutilizando el patrón de bloqueo y cuenta atrás de Task 5 (extraer un hook `useCountdown(seconds?: number)` en `features/auth/hooks/` si ya está duplicado).
- [ ] **Step 4: Ejecutar** `pnpm test && pnpm typecheck && pnpm lint` → verde.
- [ ] **Step 5: Commit** — `feat(auth): verificación 2FA con TOTP y código de respaldo`

---

### Task 7: Activación de 2FA (`/activar-2fa`)

**Files:**
- Create: `src/features/auth/screens/ActivateTwoFactorPage.tsx`, `src/features/auth/components/BackupCodes.tsx`, `src/routes/activar-2fa.tsx`
- Modify: `src/lib/i18n/es.ts` (`auth.activate`)
- Test: `src/features/auth/screens/ActivateTwoFactorPage.test.tsx`

**Interfaces:**
- Consumes: `enableTwoFactor`, `verifyTotp`, `secretFromTotpUri`, `QRCodeSVG` de `qrcode.react`, `AuthCard`.
- Produces: ruta `/activar-2fa` (`enforce('two-factor-setup', …)`). Pasos internos `'password' | 'scan' | 'codes'`; los códigos viven solo en el estado del componente.

- [ ] **Step 1: Tests que fallan:**
  - Paso contraseña: `POST two-factor/enable` con `{password}`; `INVALID_PASSWORD` → alerta `passwordInvalid` y se queda en el paso.
  - Paso escaneo: se renderiza un `svg` del QR (`role="img"` con nombre accesible), la clave en texto (la de `secretFromTotpUri`) con botón de copiar, y un campo OTP; un código válido llama a `verify-totp` y pasa a `codes`; uno inválido muestra `codeInvalid` sin avanzar.
  - Paso códigos: lista los `backupCodes`; «Copiar» usa `navigator.clipboard.writeText` con todos los códigos; «Descargar» crea un `Blob` de texto (espía de `URL.createObjectURL`); el botón «Continuar» está **deshabilitado** hasta marcar «ya guardé mis códigos».
  - Al continuar: se llama `removeQueries(['me'])` y se navega a `/` (con `/me` 200 llega a la página mínima).
  - Ningún código ni la clave se escribe en `localStorage`/`sessionStorage` (espía) ni en `console`.
  - `TOTP_ALREADY_ENABLED` en el paso contraseña → mensaje claro con enlace a `/iniciar-sesion`.
  - Con `/me` 200 la ruta redirige a `/`; sin sesión, a login con `redirect`.
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar** la página y `BackupCodes`. El QR va sobre un contenedor de fondo claro (spec §7). Sin `dangerouslySetInnerHTML`.
- [ ] **Step 4: Ejecutar** `pnpm test && pnpm typecheck && pnpm lint` → verde.
- [ ] **Step 5: Commit** — `feat(auth): activación de 2FA con QR y códigos de respaldo`

---

### Task 8: Recuperar y restablecer contraseña

**Files:**
- Create: `src/features/auth/screens/RequestResetPage.tsx`, `src/features/auth/screens/ResetPasswordPage.tsx`, `src/routes/recuperar.tsx`, `src/routes/restablecer.tsx`
- Modify: `src/lib/i18n/es.ts` (`auth.recover`, `auth.reset`)
- Test: `src/features/auth/screens/RequestResetPage.test.tsx`, `src/features/auth/screens/ResetPasswordPage.test.tsx`

**Interfaces:**
- Consumes: `requestPasswordReset`, `resetPassword`, `useRouterState` (hash de la ubicación), `AuthCard`.
- Produces: rutas `/recuperar` y `/restablecer`, ambas `enforce('public-only', …)`.

- [ ] **Step 1: Tests que fallan:**
  - `/recuperar`: correo vacío o inválido → error de validación sin petición; envío correcto → mensaje fijo `es.auth.recover.sent`; un 400 del backend para un correo inexistente **también** muestra ese mismo mensaje (sin enumeración de cuentas); 429 → `rateLimited` con espera; doble envío → una petición.
  - `/restablecer#token=abc`: el token se lee del hash y el hash se elimina de la ubicación del router (`replace`) al montar; contraseña de 11 caracteres → error de longitud sin petición; confirmación distinta → error; envío correcto envía `{newPassword, token:'abc'}` y navega a `/iniciar-sesion` con el aviso `es.auth.reset.done`.
  - `INVALID_TOKEN` → mensaje `tokenInvalid` con enlace a `/recuperar`.
  - **Sin token:** `/restablecer` y `/restablecer#token=` muestran el aviso de enlace inválido con enlace a `/recuperar`, sin formulario y sin petición.
  - Los campos nuevos llevan `autocomplete="new-password"`.
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar** ambas pantallas. El aviso de éxito se pasa a login con un parámetro de búsqueda `?restablecida=1` (validado en `validateSearch` de `/iniciar-sesion`, que lo muestra como `Alert` informativa).
- [ ] **Step 4: Ejecutar** `pnpm test && pnpm typecheck && pnpm lint` → verde.
- [ ] **Step 5: Commit** — `feat(auth): recuperación y restablecimiento de contraseña`

---

### Task 9: Sin acceso, página mínima y cierre de sesión

**Files:**
- Create: `src/features/auth/hooks/useLogout.ts`, `src/features/auth/screens/NoAccessPage.tsx`, `src/features/auth/screens/HomePage.tsx`, `src/routes/sin-acceso.tsx`
- Modify: `src/routes/_protegido/index.tsx` (monta `HomePage`), `src/lib/i18n/es.ts` (`auth.noAccess`, `auth.home`)
- Test: `src/features/auth/hooks/useLogout.test.tsx`, `src/features/auth/screens/HomePage.test.tsx`, `src/features/auth/screens/NoAccessPage.test.tsx`

**Interfaces:**
- Consumes: `meQueryOptions`, `useAuthApi().signOut`, `useQueryClient`.
- Produces: `useLogout(): () => Promise<void>` — llama `signOut` dentro de `try/finally`, ejecuta `queryClient.clear()` y navega a `/iniciar-sesion`, incluso si `signOut` falla.

- [ ] **Step 1: Tests que fallan:**
  - `HomePage` con `/me` 200: muestra el correo, el nombre del país (`tenant.name`) y el botón «Cerrar sesión»; conserva el conmutador de tema.
  - `useLogout`: éxito → `queryClient.getQueryCache().getAll()` queda vacío y la URL es `/iniciar-sesion`; `sign-out` con 500 o error de red → **igual** limpia la caché y navega.
  - `NoAccessPage`: se muestra con `/me` 200 y `membership:null` y con 403 `no_membership`; tiene «Cerrar sesión»; con `/me` 401 redirige a login.
  - Tras cerrar sesión, `/` redirige a `/iniciar-sesion?redirect=%2F` (la caché ya no tiene `['me']`).
- [ ] **Step 2: Ejecutar** → fallan.
- [ ] **Step 3: Implementar** las tres piezas. `HomePage` usa `useSuspenseQuery(meQueryOptions(http))`.
- [ ] **Step 4: Ejecutar** `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → verde.
- [ ] **Step 5: Commit** — `feat(auth): pantalla sin acceso, página mínima y cierre de sesión`

---

### Task 10: Accesibilidad de las pantallas de autenticación

**Files:**
- Modify: pantallas de Tasks 5–9 según los hallazgos
- Test: `src/features/auth/a11y.test.tsx`

**Interfaces:**
- Consumes: todas las pantallas por `mountApp`.

- [ ] **Step 1: Tests que fallan** (recorrido por cada ruta pública y por `/activar-2fa`):
  - Cada pantalla tiene exactamente un `h1` y todos sus campos tienen nombre accesible (`getByLabelText`).
  - Al fallar un envío, el foco pasa a la alerta de error (`role="alert"` con `aria-live`).
  - Con `userEvent.tab()` se alcanza cada control interactivo en orden lógico y el formulario se envía con Enter.
- [ ] **Step 2: Ejecutar** → los casos que incumplan fallan.
- [ ] **Step 3: Corregir** lo que falle sin cambiar el comportamiento ya cubierto.
- [ ] **Step 4: Ejecutar** `pnpm test` completo → verde.
- [ ] **Step 5: Commit** — `fix(auth): accesibilidad de las pantallas de autenticación`

---

### Task 11: e2e contra backend real, documentación y ADR

**Files:**
- Create: `e2e/support/totp.ts`, `e2e/totp.spec.ts`, `e2e/auth.spec.ts`
- Modify: `e2e/playwright.config.ts`, `docker-compose.e2e.yml`, `README.md`, `docs/superpowers/adr/0003-autenticacion-y-sesion.md`, `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (Q2, Q4, Q5, Q10 resueltas; añadir `B-18`)

**Interfaces:**
- Produces: `export function totpCode(secretBase32: string, atMs?: number): string` (RFC 6238, SHA-1, 30 s, 6 dígitos, `node:crypto`, sin dependencias).

- [ ] **Step 1: Tests que fallan:** `e2e/totp.spec.ts` (Playwright, sin backend): `totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)` → `'287082'` (vector RFC 6238, secreto `12345678901234567890` en base32) y otro vector de la RFC (`1111111109 s` → `'081804'`).
- [ ] **Step 2: Ejecutar** `docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm playwright` → falla (módulo inexistente).
- [ ] **Step 3: Implementar** `totp.ts` (decodificación base32 incluida) y `e2e/auth.spec.ts`, que se omite (`test.skip`) salvo que existan `E2E_BACKEND=1`, `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`. Flujo CA20 en un único test secuencial: login → `/activar-2fa` → contraseña → leer la clave en texto → `totpCode` → guardar un código de respaldo → continuar → cerrar sesión → login + TOTP → cerrar sesión → login + código de respaldo → `/`. Durante todo el flujo, sin errores de consola ni violaciones de CSP (CA7). El compose e2e pasa esas variables y `PW_OUTPUT_DIR=/tmp/pw-results`; `playwright.config.ts` usa `outputDir: process.env.PW_OUTPUT_DIR ?? '../test-results'` (evita archivos de root en el repo).
- [ ] **Step 4: Verificar contra el backend real** (levantado por el usuario o la sesión `backend`; `API_UPSTREAM` hacia la IP de la pasarela de Docker): ejecutar `auth.spec.ts` completo. Ajustar los schemas de Task 2 a lo que responda la realidad, con un `Ruling` por cada diferencia. Ejecutar además CA19: `curl -i -X POST -H 'Origin: http://evil.example' -H 'Content-Type: application/json' -H 'X-Tenant: co' -d '{"email":"a@b.co","password":"x"}' http://localhost:3000/v1/auth/sign-in/email` → 403 `INVALID_ORIGIN`; y confirmar la duración de sesión con `get-session`. Si no hay backend disponible, **no** marcar CA19/CA20 como cumplidos: registrarlos como pendientes en el ledger y en el resumen final.
- [ ] **Step 5: Documentar:** README (crear cuenta admin: `sign-up/email` + `pnpm ops member add co <correo> --role admin`; activar 2FA desde la UI; ejecutar el e2e de auth; `FRONTEND_ORIGINS` y `PASSWORD_RESET_URL=…/restablecer` en producción; `TRUST_PROXY_HOPS=1`), ADR-0003 (punto 2 → módulo propio, estado «Aceptado», lo verificado), roadmap (Q2/Q4/Q5/Q10 resueltas, `B-18`: `/me` o `platformRole` en `admin.api`).
- [ ] **Step 6: Commit** — `test(e2e): flujo de autenticación contra backend real y documentación de F1`

---

### Task 12: Verificación final contra CA1–CA22

**Files:** ninguno nuevo (correcciones menores si algo falla).

- [ ] **Step 1:** `pnpm ci:verify` → exit 0 (lint, formato, tipos, tests, build, contrato sin cambios, `audit --audit-level=high`).
- [ ] **Step 2:** `grep -rn "dangerouslySetInnerHTML\|sessionStorage\|eval(\|new Function" src --include=*.ts --include=*.tsx` (excluyendo `generated` y tests) sin resultados nuevos; `localStorage` solo en `theme-storage.ts`; nada de `console.log` en `src/features/auth`.
- [ ] **Step 3:** `bash scripts/verify-image.sh` y el e2e de humo de F0 siguen verdes; imagen reconstruida con `docker build`.
- [ ] **Step 4:** Recorrer la tabla de CA1–CA22 del spec y anotar en el ledger la evidencia (nombre de test o comando) de cada una; los CA19/CA20 sin backend quedan **declarados pendientes**, no cumplidos.
- [ ] **Step 5:** Revisión de la rama según `executing-plans` (Final Review) y cierre con `finishing-a-development-branch`. Entregar «Rulings I made» y «Deferred minors».
