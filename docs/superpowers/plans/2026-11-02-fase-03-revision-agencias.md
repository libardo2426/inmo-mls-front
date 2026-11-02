# Fase 3 — Revisión de agencias — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el personal del MLS liste, abra y revise (aprobar / devolver con cambios / rechazar) solicitudes de inmobiliarias desde el panel.

**Architecture:** Nueva feature `src/features/agencies` (api, hooks, components, screens, messages) con el mismo patrón que `features/auth`, un `DataTable` genérico en `components/shared` y una feature `src/features/territory` que resuelve código → nombre de municipio/departamento. Las rutas viven bajo `_protegido/agencias` con guarda `assertCan`. Se construye por capas: cimientos → lectura → acciones → cierre.

**Tech Stack:** React 19, TypeScript, TanStack Router y Query (`useInfiniteQuery`, `useMutation`), Zod 4 (tipos generados desde `openapi.json`), shadcn `radix-nova`, Vitest + Testing Library + MSW, Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-11-02-fase-03-revision-agencias-design.md` (leer entero antes de empezar).

## Global Constraints

- UI en español; todo texto en `src/lib/i18n/es.ts` (namespace nuevo `agencies`, y `nav.agencies`). Sin textos sueltos en componentes.
- Nunca decidir por rol: solo `can()`/`useCan()`/`assertCan()` y el `status` del recurso (la regla ESLint `no-role-comparison` lo impide).
- Los tipos y schemas salen de `src/lib/api/schemas.ts` (fachada); no importar de `./generated` fuera de ese archivo.
- Las llamadas HTTP pasan por `HttpClient.request({ host: 'country', path, schema, ... })`; el prefijo `/v1` lo pone el cliente. Errores del backend: `ApiError` (decidir por `code`, nunca por `title`); 429 expone `retryAfterSeconds`.
- Listado: `limit=50`; el filtro `status` acepta un solo valor; «Todos» = no enviar `status`. Cursor opaco, paginación «Cargar más».
- Filtro por defecto `pending`, en el search param `status` de la URL (valores: los 6 estados o `all`); sin param ⇒ `pending`, sin redirección.
- Acciones visibles solo con permiso (`agency.approve` | `agency.request_changes` | `agency.reject`, alcance `network`) **y** `status === 'pending'`.
- Motivo de `request-changes` y `reject`: 1–2000 caracteres tras recortar espacios. Rechazar exige además escribir el nombre comercial (se compara recortando y sin distinguir mayúsculas ni acentos).
- Todas las acciones muestran el aviso «requiere 2FA». Una acción en curso deshabilita todos los botones y un doble clic envía una sola petición.
- Sin librería nueva de notificaciones; el aviso de éxito es un `Alert` en línea.
- Estados obligatorios en cada pantalla: carga, vacío, error y «sin permiso» (`EmptyState`, `ErrorState`, `ForbiddenState`, `Skeleton`).
- Commits en español, Conventional Commits, terminados en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. **Sin push ni merge sin aprobación.** Trabajar solo en el worktree `.claude/worktrees/fase-03-revision-agencias`.
- Verificación de cada tarea: `pnpm typecheck && pnpm lint && pnpm test`; al final `pnpm ci:verify` (omitir `pnpm audit` si no hay red y decirlo).

## Review Focus

Entradas o condiciones que el spec implica pero que ningún flujo feliz cubre; cada una tiene su prueba en la tarea indicada:

1. El catálogo territorial falla o el código no existe ⇒ el detalle sigue funcionando y muestra el código (Tarea 3 y 5).
2. `?status=basura` en la URL ⇒ cae a `pending`, no rompe la pantalla (Tarea 4).
3. Doble clic en «Rechazar» / «Aprobar» ⇒ una sola petición (Tarea 6).
4. Motivo vacío, solo espacios o de más de 2000 caracteres ⇒ no se puede enviar (Tarea 6).
5. `compliance` (tiene `agency.list` pero no las acciones) ⇒ ve datos sin ningún botón; y 409 `agency_not_reviewable` ⇒ el detalle se recarga y explica (Tareas 5 y 6).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/components/ui/{table,dialog,badge,textarea,select}.tsx` | Componentes shadcn (CLI) |
| `src/components/shared/DataTable.tsx` | Tabla genérica con estados y «Cargar más» |
| `src/lib/api/schemas.ts` (modificar) | Exporta schemas/tipos de agencias y territorio |
| `src/features/agencies/api/agencies-api.ts` | Cliente: list, get, approve, requestChanges, reject |
| `src/features/agencies/api/keys.ts` | `agencyKeys` (query keys) |
| `src/features/agencies/messages.ts` | `agencyErrorMessage(error)` |
| `src/features/agencies/review-rules.ts` | `reviewActionsFor`, `matchesName` (puras) |
| `src/features/agencies/hooks/` | `useAgenciesApi`, `useAgencies`, `useAgency`, `useReviewAgency` |
| `src/features/agencies/components/` | `AgencyStatusBadge`, `ReviewDialog`, `AgencyDetailCard` |
| `src/features/agencies/screens/` | `AgenciesListScreen`, `AgencyDetailScreen` |
| `src/features/territory/` | `territory-api.ts`, `useTerritoryName.ts` |
| `src/routes/_protegido/agencias/{index,$agencyId}.tsx` | Rutas con guarda de permiso |
| `src/config/navigation.ts` (modificar) | Ítem «Agencias» |
| `src/lib/i18n/es.ts` (modificar) | Textos |

---

## Capa 1 — Cimientos

### Task 1: `DataTable` compartido

**Files:**
- Create (CLI): `src/components/ui/table.tsx`, `src/components/ui/badge.tsx`
- Create: `src/components/shared/DataTable.tsx`, `src/components/shared/DataTable.test.tsx`
- Modify: `src/lib/i18n/es.ts` (`states.loadMore`, `states.loading`)

**Interfaces:**
- Produces:
  ```ts
  export type Column<T> = { id: string; header: string; cell: (row: T) => ReactNode; className?: string };
  export type DataTableProps<T> = {
    columns: readonly Column<T>[];
    rows: readonly T[];
    getRowKey: (row: T) => string;
    caption: string;                       // nombre accesible de la tabla
    isLoading?: boolean;                   // primera carga: filas Skeleton
    error?: unknown; onRetry?: () => void; // → ErrorState
    empty: { title: string; description?: string };
    onRowActivate?: (row: T) => void;      // clic o Enter en la fila
    hasMore?: boolean; onLoadMore?: () => void; isLoadingMore?: boolean;
  };
  export function DataTable<T>(props: DataTableProps<T>): JSX.Element;
  ```

- [ ] **Step 1:** Añadir componentes con la CLI: `pnpm dlx shadcn@latest add table badge` (estilo `radix-nova`, `components.json` ya configurado). Verificar con `git status` que solo se crean esos archivos (más cambios de `index.css` si la CLI los hace).
- [ ] **Step 2: Write the failing test** (`DataTable.test.tsx`, render directo, sin router): casos `muestra encabezados y filas`, `isLoading muestra esqueletos y no filas`, `error muestra ErrorState y llama onRetry al pulsar Reintentar`, `sin filas muestra el EmptyState`, `Enter sobre una fila llama onRowActivate con la fila`, `hasMore muestra «Cargar más» y llama onLoadMore; con hasMore=false no aparece`, `isLoadingMore deshabilita «Cargar más»`, y `la tabla tiene role=table con nombre accesible igual a caption`.
- [ ] **Step 3: Run** `pnpm vitest run src/components/shared/DataTable.test.tsx` — Expected: FAIL (módulo no existe).
- [ ] **Step 4: Implement `DataTable`** en `src/components/shared/DataTable.tsx` con la firma de Interfaces. Filas con `tabIndex={0}` y `role="row"` activables solo si hay `onRowActivate` (Enter y clic). Reutiliza `EmptyState` y `ErrorState`. Densidad alta: celdas con `py-1.5`.
- [ ] **Step 5: Run** el test — Expected: PASS. Luego `pnpm typecheck && pnpm lint`.
- [ ] **Step 6: Commit** `feat(ui): DataTable compartido con estados y paginación por cursor` (incluye los archivos shadcn).

### Task 2: Cliente de agencias, schemas, claves y mensajes

**Files:**
- Modify: `src/lib/api/schemas.ts`, `src/lib/i18n/es.ts` (`agencies.errors`)
- Create: `src/features/agencies/api/agencies-api.ts`, `.../api/keys.ts`, `.../messages.ts`, `.../hooks/useAgenciesApi.ts`
- Test: `src/features/agencies/api/agencies-api.test.ts`, `src/features/agencies/messages.test.ts`

**Interfaces:**
- Produces (en `schemas.ts`):
  ```ts
  export const agencyApplicationResponseSchema = zAgencyApplicationResponse;
  export const agencyPageResponseSchema = zAgencyPageResponse;
  export const territoryPageResponseSchema = zTerritoryPageResponse;
  export type AgencyApplication = z.infer<typeof agencyApplicationResponseSchema>;
  export type AgencyPage = z.infer<typeof agencyPageResponseSchema>;
  export type AgencySummary = AgencyPage['items'][number];
  export type AgencyStatus = AgencyApplication['status'];
  export type TerritoryPage = z.infer<typeof territoryPageResponseSchema>;
  ```
- Produces (`agencies-api.ts`):
  ```ts
  export type AgencyListInput = { status?: AgencyStatus; limit?: number; cursor?: string; signal?: AbortSignal };
  export type AgenciesApi = {
    list(input?: AgencyListInput): Promise<AgencyPage>;
    get(id: string, signal?: AbortSignal): Promise<AgencyApplication>;
    approve(id: string): Promise<void>;
    requestChanges(id: string, reason: string): Promise<void>;
    reject(id: string, reason: string): Promise<void>;
  };
  export function createAgenciesApi(http: HttpClient): AgenciesApi;
  ```
- Produces (`keys.ts`): `agencyKeys = { all: ['agencies'], list: (status: AgencyStatus | 'all') => [...], detail: (id: string) => [...] } as const`.
- Produces (`messages.ts`): `agencyErrorMessage(error: unknown): string`.
- Produces (`useAgenciesApi.ts`): `useAgenciesApi(): AgenciesApi` (igual que `useAuthApi`).

- [ ] **Step 1: Write the failing tests.** `agencies-api.test.ts` (cliente real + MSW, como `auth-api.test.ts`): `list envía status y limit y no envía status si es undefined`; `list valida el esquema (respuesta inválida → ValidationError)`; `get pide /agencies/{id}`; `approve hace POST /agencies/{id}/approve y acepta 204 sin cuerpo`; `requestChanges y reject envían {reason}`. `messages.test.ts`: `agency_not_reviewable`, `review_reason_required`, `agency_not_found` → textos de `es.agencies.errors`; 429 usa `retryAfterSeconds`; `NetworkError` y código desconocido → genérico con referencia (mismo patrón que `authErrorMessage`).
- [ ] **Step 2: Run** `pnpm vitest run src/features/agencies` — Expected: FAIL.
- [ ] **Step 3: Implement** lo listado en Interfaces. Los void usan el mismo schema de respuesta ignorada que `features/auth/api/schemas.ts` (`ignoredResponseSchema`); si no admite un 204 vacío, ajustarlo o definir uno equivalente en la feature y cubrirlo con el test de `approve`.
- [ ] **Step 4: Run** tests + `pnpm typecheck && pnpm lint` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agencias): cliente tipado, claves de caché y mensajes de error`.

### Task 3: Nombres de territorio

**Files:**
- Create: `src/features/territory/territory-api.ts`, `src/features/territory/useTerritoryName.ts`
- Test: `src/features/territory/territory.test.tsx`
- Modify: `src/lib/i18n/es.ts` (si hace falta `territory.*`)

**Interfaces:**
- Consumes: `territoryPageResponseSchema`, `TerritoryPage` (Task 2); `useHttpClient()` de `@/app/app-context`.
- Produces:
  ```ts
  export type TerritoryUnit = { code: string; name: string; parentCode: string | null };
  /** Descarga todas las páginas (limit=100, sin `q`) de un nivel y devuelve el mapa código → unidad. */
  export function fetchTerritoryLevel(http: HttpClient, country: string, level: 'municipality' | 'department', signal?: AbortSignal): Promise<Map<string, TerritoryUnit>>;
  export function territoryLevelQueryOptions(http: HttpClient, country: string, level: 'municipality' | 'department'); // queryKey ['territory', country, level], staleTime: Infinity, retry: false
  /** `label` = «Municipio, Departamento»; cae a solo municipio, o al código, si no se resuelve. */
  export function useTerritoryName(code: string | undefined): { label: string; isLoading: boolean };
  ```
  El país sale de `me.tenant.code` (usar `useMe()` de `@/lib/permissions`).

- [ ] **Step 1: Write the failing tests** (MSW sobre `*/v1/territory/units/co/municipality` y `.../department`, paginado con `nextCursor`): `junta todas las páginas siguiendo nextCursor`; `no envía q`; `label = «Medellín, Antioquia»` usando `parentCode` del municipio; `departamento caído ⇒ solo el municipio`; `catálogo caído (500) ⇒ label es el código y isLoading termina en false` (**Review Focus 1**); `código inexistente ⇒ label es el código`; `code undefined ⇒ label vacío sin disparar peticiones`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** `fetchTerritoryLevel` itera con `cursor` hasta `nextCursor === null`. `useTerritoryName` usa dos `useQuery` (municipio y departamento; el de departamento solo se habilita cuando el municipio resolvió). **Verificar en el test que la ausencia de `q` es aceptable para el servidor real** en el e2e (Task 7); si el backend la rechaza, el hook devuelve el código y se documenta como bloqueo B-16 en el README.
- [ ] **Step 4: Run** tests + typecheck/lint — Expected: PASS.
- [ ] **Step 5: Commit** `feat(territorio): resolver nombre de municipio y departamento por código`.

---

## Capa 2 — Lectura

### Task 4: Menú, ruta y listado

**Files:**
- Create: `src/features/agencies/hooks/useAgencies.ts`, `.../components/AgencyStatusBadge.tsx`, `.../screens/AgenciesListScreen.tsx`, `src/routes/_protegido/agencias/index.tsx`
- Modify: `src/config/navigation.ts`, `src/lib/i18n/es.ts` (`nav.agencies`, `agencies.list.*`, `agencies.status.*`), `src/config/navigation.test.ts` si existe (añadir el ítem esperado)
- Test: `src/features/agencies/screens/AgenciesListScreen.test.tsx` (con `mountApp` + MSW)

**Interfaces:**
- Consumes: `AgenciesApi`/`useAgenciesApi` y `agencyKeys` (Task 2); `DataTable` (Task 1); `assertCan` de `@/lib/permissions`.
- Produces:
  ```ts
  export type StatusFilter = AgencyStatus | 'all';
  export const STATUS_FILTERS: readonly StatusFilter[]; // los 6 estados + 'all'
  export function parseStatusFilter(value: unknown): StatusFilter; // inválido/ausente ⇒ 'pending'
  export function useAgencies(filter: StatusFilter): UseInfiniteQueryResult<InfiniteData<AgencyPage>, Error>; // limit=50
  export function AgencyStatusBadge(props: { status: AgencyStatus }): JSX.Element;
  export function AgenciesListScreen(): JSX.Element;
  ```
  Ruta `/_protegido/agencias/`: `validateSearch: (s) => ({ status: parseStatusFilter(s.status) })`, `beforeLoad: ({ context }) => assertCan(context.me, 'agency.list', 'network')`. Ítem de menú: `{ to: '/agencias', label: es.nav.agencies, icon: Building2, permission: 'agency.list', minScope: 'network' }`.

- [ ] **Step 1: Write the failing tests** (`/agencias` con `meFixture({ membership: {... permissions: {'agency.list':'network'}} })`): `aparece «Agencias» en el menú solo con agency.list`; `sin agency.list muestra «sin permiso» y no pide /v1/agencies`; `abre en pending: la petición lleva status=pending&limit=50`; `cambiar el filtro a «Todos» actualiza la URL (status=all) y la petición no lleva status`; **`?status=basura` se trata como pending`** (Review Focus 2); `muestra columnas nombre comercial, razón social, documento (tipo + número), estado, fecha de envío (es-CO)`; `«Cargar más» pide con el cursor y agrega filas; desaparece cuando nextCursor es null` (**Review Focus 4**); `lista vacía muestra EmptyState`; `500 muestra ErrorState con Reintentar`; `clic en una fila navega a /agencias/{id}`.
- [ ] **Step 2: Run** `pnpm vitest run src/features/agencies/screens/AgenciesListScreen.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** Selector de estado con shadcn `select` (`pnpm dlx shadcn@latest add select`); textos de estados en `es.agencies.status`. Fechas con `Intl.DateTimeFormat('es-CO', ...)` usando `me.tenant`/`config.locale` si existe, si no `es-CO`. Regenerar `routeTree.gen.ts` con `pnpm vitest run`/`vite` (lo hace el plugin del router; commitearlo si cambia, como en F1/F2). Comprobar que el estado activo del `AppSidebar` también marca «Agencias» en `/agencias/{id}`.
- [ ] **Step 4: Run** tests + `pnpm typecheck && pnpm lint` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agencias): listado de solicitudes con filtro por estado en la URL`.

### Task 5: Detalle

**Files:**
- Create: `src/features/agencies/hooks/useAgency.ts`, `.../components/AgencyDetailCard.tsx`, `.../screens/AgencyDetailScreen.tsx`, `src/routes/_protegido/agencias/$agencyId.tsx`
- Modify: `src/lib/i18n/es.ts` (`agencies.detail.*`)
- Test: `src/features/agencies/screens/AgencyDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `agencyKeys.detail`, `AgenciesApi.get`, `AgencyStatusBadge`, `useTerritoryName` (Tasks 2–4).
- Produces:
  ```ts
  export function useAgency(id: string): UseQueryResult<AgencyApplication, Error>; // key agencyKeys.detail(id)
  export function AgencyDetailCard(props: { agency: AgencyApplication }): JSX.Element; // solo lectura
  export function AgencyDetailScreen(props: { agencyId: string }): JSX.Element; // slot de acciones: ver Task 6
  ```
  Ruta con la misma guarda que el listado (`agency.list`, `network`) y enlace «Volver al listado» que conserva el `status` de la URL.

- [ ] **Step 1: Write the failing tests:** `muestra nombre comercial, razón social, documento, correo, teléfono, estado, fecha de envío`; `muestra reviewReason y reviewedAt solo si existen`; `muestra la sede principal con «Municipio, Departamento» resuelto`; `si el catálogo territorial falla muestra el código y el resto del detalle sigue visible` (**Review Focus 1**); `404 agency_not_found muestra el texto de es.agencies.errors y no rompe el shell`; `carga muestra Skeleton`; `sin permiso muestra «sin permiso»`; **`compliance (agency.list sin las acciones) ve el detalle sin ningún botón de acción`** (Review Focus 5).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** `<h1>` = nombre comercial; datos en `<dl>`. La pantalla acepta un contenido de acciones que Task 6 conecta (por ahora, no renderiza botones).
- [ ] **Step 4: Run** tests + typecheck/lint — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agencias): detalle de solicitud con nombre del municipio`.

---

## Capa 3 — Acciones

### Task 6: Revisión: reglas, diálogos y mutación

**Files:**
- Create: `src/features/agencies/review-rules.ts`, `.../hooks/useReviewAgency.ts`, `.../components/ReviewDialog.tsx`
- Create (CLI): `src/components/ui/{dialog,textarea}.tsx` (`pnpm dlx shadcn@latest add dialog textarea`)
- Modify: `.../screens/AgencyDetailScreen.tsx` (botones), `.../screens/AgenciesListScreen.tsx` (aviso de éxito), `src/lib/i18n/es.ts` (`agencies.review.*`)
- Test: `src/features/agencies/review-rules.test.ts`, `src/features/agencies/components/ReviewDialog.test.tsx`, ampliar `AgencyDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `AgenciesApi`, `agencyKeys`, `agencyErrorMessage` (Task 2); `can` de `@/lib/permissions`.
- Produces:
  ```ts
  export type ReviewAction = 'approve' | 'requestChanges' | 'reject';
  export function reviewActionsFor(me: MeResponse, agency: Pick<AgencyApplication, 'status'>): Record<ReviewAction, boolean>;
  export function matchesName(typed: string, tradeName: string): boolean; // trim + minúsculas + sin acentos
  export const REASON_MAX = 2000;
  export function useReviewAgency(): UseMutationResult<void, Error, { id: string; action: ReviewAction; reason?: string }>;
    // onSuccess: invalidateQueries({ queryKey: agencyKeys.all })
  export function ReviewDialog(props: { action: ReviewAction; agency: AgencyApplication; open: boolean; onOpenChange(open: boolean): void; onDone(action: ReviewAction): void }): JSX.Element;
  ```
  Permisos por acción: `approve → agency.approve`, `requestChanges → agency.request_changes`, `reject → agency.reject`, todos con alcance mínimo `network`.

- [ ] **Step 1: Write the failing tests.**
  - `review-rules.test.ts`: tabla permiso × estado (`pending` con los tres permisos ⇒ las tres true; con solo `agency.list` ⇒ las tres false; `changes_requested`/`active`/`rejected` ⇒ false); `matchesName('  MEDELLÍN inmobiliaria ', 'Medellin Inmobiliaria') === true` y `false` para nombre distinto.
  - `ReviewDialog.test.tsx`: `approve` no pide motivo y llama a `POST /approve`; `requestChanges`: botón deshabilitado con motivo vacío, solo espacios o > 2000 caracteres, y envía `{reason}` recortado (**Review Focus 4**); `reject`: botón deshabilitado hasta escribir el nombre comercial **y** un motivo, y el texto menciona que se terminan las membresías y que la persona no verá el motivo; los tres muestran el aviso de 2FA; **doble clic en el botón confirmar hace una sola petición** y el botón queda deshabilitado mientras dura (**Review Focus 3**); `429` muestra el texto con la espera; `409 agency_not_reviewable` cierra el diálogo sin llamar a `onDone` (el detalle se recarga, ver la prueba de `AgencyDetailScreen`).
  - `AgencyDetailScreen.test.tsx`: con permisos de admin y `pending` aparecen los tres botones; con `compliance` y con `active` no aparece ninguno; tras aprobar con éxito navega a `/agencias?status=pending` y el listado muestra el `Alert` de éxito (`es.agencies.review.done.*`); **tras 409 se queda en el detalle, se vuelve a pedir `GET /agencies/{id}` y se muestra el aviso «otra persona ya la revisó»** (Review Focus 5); mientras una acción está en curso los demás botones están deshabilitados.
- [ ] **Step 2: Run** `pnpm vitest run src/features/agencies` — Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces. El aviso de éxito viaja en el `state` de la navegación del router (clave `reviewNotice: ReviewAction`) y el listado lo lee y lo muestra; cambia de filtro ⇒ desaparece. Los diálogos usan el `Dialog` de shadcn (foco atrapado, Escape cierra salvo mientras envía).
- [ ] **Step 4: Run** `pnpm test` completo + `pnpm typecheck && pnpm lint` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agencias): aprobar, devolver con cambios y rechazar con confirmación`.

---

## Capa 4 — Cierre

### Task 7: Accesibilidad, e2e y documentación

**Files:**
- Create: `src/features/agencies/a11y.test.tsx`, `e2e/agencias.spec.ts`
- Modify: `README.md` (sección F3: cómo se revisa una agencia, datos de prueba con `ops-cli`, B-16 pendiente), `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (F3 ✅, Q6 con la solución adoptada, B-16 y B-15 con su estado), `docs/superpowers/specs/2026-11-02-fase-03-revision-agencias-design.md` (Estado: «Implementado» si todo pasa)

- [ ] **Step 1: Write the a11y test** siguiendo `src/app/shell/a11y.test.tsx`: listado y detalle tienen un único `h1` y landmarks; la tabla es `role=table` con encabezados; Enter sobre la fila abre el detalle; al abrir un diálogo el foco entra en él y al cerrarlo vuelve al botón que lo abrió; todo control tiene nombre accesible.
- [ ] **Step 2: Run** `pnpm vitest run src/features/agencies/a11y.test.tsx` — Expected: PASS (si falla, corregir los componentes y no el test).
- [ ] **Step 3: e2e** `e2e/agencias.spec.ts` reutilizando `e2e/support` (como `auth.spec.ts`): un admin con 2FA entra, filtra por `pending`, abre una agencia y la devuelve con motivo; otra agencia rechazada exigiendo el nombre; y se comprueba que el nombre del municipio aparece (esto confirma que el endpoint territorial acepta llamadas sin `q`). Los datos se crean con `pnpm ops agency add co ...` según el README. Si el backend no está disponible, el archivo debe omitirse con `test.skip` explícito y razón, sin romper `pnpm test:e2e` existente.
- [ ] **Step 4: Documentación** como indica Files. Anotar que **B-16 sigue sin enviarse** si así es al cerrar.
- [ ] **Step 5: Verificación final:** `pnpm ci:verify` (si no hay red para `pnpm audit`, ejecutar el resto y decirlo). Expected: todo en verde y `git diff --exit-code src/lib/api/generated` limpio.
- [ ] **Step 6: Commit** `docs(f3): README, roadmap y e2e de la revisión de agencias`.

---

## Self-review

- **Cobertura del spec:** DataTable (T1), listado + filtro en URL + menú + guarda (T4), detalle + territorio (T3, T5), acciones y confirmación reforzada + 2FA + 409/429 (T6), pruebas/a11y/README (T7), cliente y mensajes (T2). Fuera de alcance del spec no tiene tareas, a propósito.
- **Consistencia de tipos:** `AgencyStatus`, `AgencySummary`, `AgencyApplication`, `StatusFilter`, `ReviewAction`, `agencyKeys`, `useAgenciesApi` se definen en T2/T4/T6 y se usan con los mismos nombres después.
- **Pendiente conocido:** que el servidor real acepte el catálogo sin `q` solo se prueba en el e2e (T7); el resto usa MSW.
