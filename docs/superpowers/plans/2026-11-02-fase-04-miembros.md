# F4 Miembros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el personal del MLS vea los miembros de una inmobiliaria en su detalle y que `admin` pueda terminarlos con un motivo obligatorio.

**Architecture:** Nuevo `src/features/members/` que espeja `src/features/agencies/` (API sobre `HttpClient` + hooks de TanStack Query + regla de UX + diálogo de confirmación). La sección «Miembros» se monta dentro de `AgencyDetailScreen`; no hay ruta ni ítem de menú nuevos. El servidor es la fuente de verdad: la UI solo oculta lo que el permiso y el `status` ya descartan.

**Tech Stack:** React, TypeScript strict, TanStack Query/Router, zod (esquemas generados), shadcn/ui, Vitest + Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-11-02-fase-04-miembros-design.md`

## Global Constraints

- Textos de UI en español (es-CO) siempre desde `src/lib/i18n/es.ts`; los errores se deciden por `error.code`, nunca por el título.
- Importar tipos y esquemas solo desde `@/lib/api/schemas`, nunca de `./generated`.
- Tabla: `DataTable` (`@/components/shared/DataTable`); sección: `Section`; estado: `StatusBadge` con tono semántico (ADR-0006). Fecha: `formatDate` de `@/features/agencies/format`.
- «Terminar» solo si `can(me, 'member.terminate_any', 'network')` **y** `member.status === 'active'`. La sección solo si `can(me, 'member.read')`.
- Motivo de terminación obligatorio, recortado, 1–1000 caracteres (`REASON_MAX = 1000`).
- 429: igual que `ReviewDialog` (`useCountdown`, `retryAfterSeconds`).
- Rama `fase-04-miembros`; commits convencionales en español, terminados con la línea `Co-Authored-By` indicada por la sesión.
- Verificación final: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.

## Review Focus

1. Agencia sin miembros (`[]`): estado vacío, no tabla rota.
2. `last_broker` (409): el diálogo sigue abierto con el mensaje propio y no cierra ni recarga.
3. Motivo solo con espacios o de 1001 caracteres: el botón de confirmar queda deshabilitado.
4. Doble envío / envío durante la mutación: una sola petición.
5. `compliance` (solo `member.read`) y miembros `terminated`/`suspended`: no ven «Terminar».

## File Structure

- Modify `src/lib/api/schemas.ts`: añadir `memberResponseSchema`, `memberListSchema`, tipos `Member`, `MemberStatus`, `MemberRole`.
- Modify `src/lib/i18n/es.ts`: bloque `members`.
- Modify `src/test/fixtures.ts`: `memberFixture`.
- Create `src/features/members/api/{members-api.ts,keys.ts,members-api.test.ts}`.
- Create `src/features/members/hooks/{useMembersApi.ts,useMembers.ts,useTerminateMember.ts}`.
- Create `src/features/members/{terminate-rules.ts,terminate-rules.test.ts,messages.ts,messages.test.ts}`.
- Create `src/features/members/components/{MemberStatusBadge.tsx,TerminateMemberDialog.tsx,TerminateMemberDialog.test.tsx,MembersSection.tsx,MembersSection.test.tsx}`.
- Modify `src/features/agencies/screens/AgencyDetailScreen.tsx` (+ su test).
- Modify `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (F4 ✅).

---

### Task 1: Esquemas, textos y fixture

**Files:**
- Modify: `src/lib/api/schemas.ts`, `src/lib/i18n/es.ts`, `src/test/fixtures.ts`
- Test: `src/lib/api/schemas.test.ts`

**Interfaces:**
- Produces (`schemas.ts`): `memberResponseSchema = zMemberResponse`; `memberListSchema = zMembersControllerListResponse`; `type Member`, `type MemberStatus = Member['status']` (`'active'|'suspended'|'terminated'`), `type MemberRole = Member['role']`.
- Produces (`fixtures.ts`): `memberFixture(overrides?: Record<string, unknown>)` → `{ memberId, userId, fullName: 'Luis Demo', email: 'luis@demo.test', role: 'agent', officeId: null, status: 'active', since: '2026-10-01T12:00:00.000Z' }` con UUID v7 válidos.
- Produces (`es.members`): `title: 'Miembros'`, `caption: 'Miembros de la inmobiliaria'`, `columns.{name,email,role,status,since,actions}`, `roles: Record<MemberRole,string>` (admin «Administrador», compliance «Cumplimiento», broker «Broker», agent «Agente», assistant «Asistente», read_only «Solo lectura»), `status.{active:'Activo',suspended:'Suspendido',terminated:'Terminado'}`, `empty.{title:'Esta inmobiliaria no tiene miembros', description?}`, `terminate.{action:'Terminar', title:(name)=>…, description:(name)=>…, twoFactorNotice, reasonLabel:'Motivo', reasonHelp:(max)=>…, cancel, submit:'Terminar miembro', done:'El miembro se terminó.'}`, `errors.{lastBroker, notActive, notFound, reasonRequired, twoFactorRequired, forbidden, network, generic, reference, rateLimited(seconds?)}` (mismo patrón que `es.agencies.errors`).

- [ ] **Step 1: Failing test** en `src/lib/api/schemas.test.ts`: `memberListSchema.parse([memberFixture()])` devuelve 1 elemento con `role: 'agent'`; `memberResponseSchema.safeParse({ ...memberFixture(), status: 'x' }).success === false`.
- [ ] **Step 2:** `pnpm vitest run src/lib/api/schemas.test.ts` → FAIL (exports inexistentes).
- [ ] **Step 3:** Implementar los exports de `schemas.ts`, `memberFixture` y el bloque `es.members` según Interfaces.
- [ ] **Step 4:** mismo comando → PASS; `pnpm typecheck` limpio.
- [ ] **Step 5:** `git add -A && git commit -m "feat(members): esquemas, textos y fixture de miembros"`

---

### Task 2: API y hooks

**Files:**
- Create: `src/features/members/api/members-api.ts`, `.../keys.ts`, `src/features/members/hooks/useMembersApi.ts`, `useMembers.ts`, `useTerminateMember.ts`
- Test: `src/features/members/api/members-api.test.ts`

**Interfaces:**
- Consumes: `HttpClient` (`@/lib/http`), `memberListSchema`, `Member`.
- Produces:
  - `type MembersApi = { list(agencyId: string, signal?: AbortSignal): Promise<Member[]>; terminate(memberId: string, reason: string): Promise<void> }`; `createMembersApi(http: HttpClient): MembersApi` (host `'country'`; `GET /agencies/{id}/members`; `POST /members/{id}/terminate` con body `{ reason }`, respuesta `z.void()`; ids con `encodeURIComponent`).
  - `memberKeys = { all: ['members'] as const, list: (agencyId: string) => ['members','list',agencyId] as const }`.
  - `useMembersApi(): MembersApi`; `useMembers(agencyId: string)` (`useQuery`, `queryFn: ({signal}) => api.list(agencyId, signal)`); `TERMINATE_MUTATION_KEY = ['members','terminate'] as const`; `useTerminateMember()` con `mutationFn: ({memberId, reason}: {memberId: string; reason: string})`, `onSuccess` invalida `memberKeys.all`, `onError` invalida si `ApiError.code` es `member_not_active`.

- [ ] **Step 1: Failing tests** (patrón de `agencies-api.test.ts`): `list` pide `GET {origin}/v1/agencies/AID/members` y devuelve los miembros parseados; `list` lanza `ValidationError` si un miembro trae `status: 'x'`; `terminate('M1','Incumple')` hace `POST /v1/members/M1/terminate` con body JSON `{"reason":"Incumple"}` y resuelve `undefined` con 204; `terminate` con 409 `{code:'last_broker'}` rechaza con `ApiError` de `code === 'last_broker'`.
- [ ] **Step 2:** `pnpm vitest run src/features/members/api` → FAIL.
- [ ] **Step 3:** Implementar según Interfaces, copiando la estructura de `createAgenciesApi`, `useAgenciesApi`, `useAgency`, `useReviewAgency`.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(members): cliente HTTP y hooks de miembros`.

---

### Task 3: Reglas y mensajes de error

**Files:**
- Create: `src/features/members/terminate-rules.ts`, `src/features/members/messages.ts`
- Test: `terminate-rules.test.ts`, `messages.test.ts`

**Interfaces:**
- Consumes: `can` de `@/lib/permissions`, `meWithPermissions`, `memberFixture`, `es.members`.
- Produces: `export const REASON_MAX = 1000`; `canTerminateMember(me: MeResponse, member: Pick<Member,'status'>): boolean`; `memberErrorMessage(error: unknown): string`.
- Mapeo de `memberErrorMessage` por `ApiError.code`: `last_broker`→`errors.lastBroker`, `member_not_active`→`errors.notActive`, `member_not_found`→`errors.notFound`, `termination_reason_required`→`errors.reasonRequired`, `two_factor_required`→`errors.twoFactorRequired`; otro 403→`errors.forbidden`; 429→`errors.rateLimited(retryAfterSeconds)`; `NetworkError`→`errors.network`; resto→`errors.generic` + « (Referencia: id)» si hay `requestId` (idéntico a `agencyErrorMessage`).

- [ ] **Step 1: Failing tests:** `canTerminateMember`: `true` con `{'member.terminate_any':'network'}` + `active`; `false` con `suspended`, con `terminated`, con solo `{'member.read':'network'}` (compliance), con `{'member.terminate':'agency'}` (broker, sin `_any`). `memberErrorMessage`: una aserción por código del mapeo, 429 con `retryAfterSeconds: 7` contiene «7», `NetworkError`, y un `Error` cualquiera → `errors.generic`.
- [ ] **Step 2:** `pnpm vitest run src/features/members/terminate-rules.test.ts src/features/members/messages.test.ts` → FAIL.
- [ ] **Step 3:** Implementar según Interfaces (copiar la forma de `review-rules.ts` y `messages.ts` de agencias).
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(members): regla de terminación y mensajes de error`.

---

### Task 4: Diálogo de terminación

**Files:**
- Create: `src/features/members/components/TerminateMemberDialog.tsx`
- Test: `TerminateMemberDialog.test.tsx`

**Interfaces:**
- Consumes: `useTerminateMember`, `memberErrorMessage`, `REASON_MAX`, `useCountdown` (`@/hooks/useCountdown`), `Dialog*`, `Textarea`, `Label`, `Alert`, `Button`.
- Produces: `TerminateMemberDialog({ member: Member; open: boolean; onOpenChange(open: boolean): void; onDone(): void })`. Estructura calcada de `ReviewDialog`: formulario con `Textarea` etiquetada `es.members.terminate.reasonLabel`, aviso de 2FA, `Alert role="alert"` con `memberErrorMessage` al fallar, botón destructivo `es.members.terminate.submit` habilitado solo si el motivo recortado mide 1–`REASON_MAX`, no hay mutación en curso y no hay cuenta atrás de 429; devuelve el foco al elemento que lo abrió; no cierra mientras está pendiente. Éxito → `onDone()`.

- [ ] **Step 1: Failing tests** (MSW sobre `*/v1/members/{id}/terminate`, patrón de `ReviewDialog.test.tsx`): (a) botón deshabilitado con motivo vacío, con `'   '` y con `'x'.repeat(1001)`; habilitado con `'x'.repeat(1000)`. (b) al confirmar envía una sola petición con body `{"reason":"Incumple normas"}` (recortado) y llama `onDone` una vez; hacer clic dos veces seguidas no duplica la petición. (c) 409 `last_broker` muestra `es.members.errors.lastBroker` en un `role="alert"`, no llama `onDone` ni `onOpenChange(false)`. (d) 403 `two_factor_required` muestra `es.members.errors.twoFactorRequired`. (e) 429 con `Retry-After` deshabilita el botón.
- [ ] **Step 2:** `pnpm vitest run src/features/members/components/TerminateMemberDialog.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar `TerminateMemberDialog.tsx` según Interfaces, adaptando `ReviewDialog.tsx`.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(members): diálogo de terminación con motivo obligatorio`.

---

### Task 5: Sección «Miembros»

**Files:**
- Create: `src/features/members/components/MemberStatusBadge.tsx`, `MembersSection.tsx`
- Test: `MembersSection.test.tsx`

**Interfaces:**
- Consumes: `useMembers`, `canTerminateMember`, `TerminateMemberDialog`, `DataTable`/`Column<Member>`, `Section`, `StatusBadge`, `formatDate`, `useMe` (`@/lib/permissions`), `TERMINATE_MUTATION_KEY` con `useIsMutating`.
- Produces: `MemberStatusBadge({ status: MemberStatus })` (active→`success`, suspended→`danger`, terminated→`neutral`; valor desconocido→tono `neutral` con el valor crudo, como `AgencyStatusBadge`); `MembersSection({ agencyId: string })`: `Section` titulada `es.members.title` con `DataTable` (`caption: es.members.caption`, columnas nombre/correo/rol/estado/desde y, **solo si algún miembro cumple `canTerminateMember`**, columna acciones con botón «Terminar» por fila elegible, `aria-label` = «Terminar a {fullName}»). Orden en cliente: activos primero, luego por `since` ascendente. Filas no activas con texto atenuado (`text-text-muted`). Tras `onDone` cierra el diálogo y muestra `<p role="status">{es.members.terminate.done}</p>`. Errores de carga con el reintento de `DataTable` (`onRetry` → `refetch`). Botones «Terminar» deshabilitados mientras haya una terminación en curso.

- [ ] **Step 1: Failing tests** (MSW `*/v1/agencies/AID/members`, `useMe` con `meWithPermissions`): (a) admin con `member.read`+`member.terminate_any` y tres miembros (activo, suspendido, terminado) ve la tabla, el rol traducido, la fecha `01/10/2026` y «Terminar» solo en el activo. (b) `compliance` (solo `member.read`) ve la tabla sin columna de acciones. (c) lista `[]` muestra `es.members.empty.title`. (d) 500 en el listado muestra el estado de error con reintento. (e) flujo completo: clic en «Terminar a Luis Demo», escribir motivo, confirmar → `POST` recibido, el diálogo se cierra, se muestra `es.members.terminate.done` y el listado se vuelve a pedir (segunda respuesta con el miembro `terminated` y sin botón). (f) activo antes que terminado en el orden de filas.
- [ ] **Step 2:** `pnpm vitest run src/features/members/components/MembersSection.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar ambos componentes según Interfaces.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(members): sección de miembros con tabla y terminación`.

---

### Task 6: Integración en el detalle, a11y y roadmap

**Files:**
- Modify: `src/features/agencies/screens/AgencyDetailScreen.tsx` (renderizar `<MembersSection agencyId={agency.id} />` tras `AgencyDetailCard`, solo si `can(me, 'member.read')`)
- Modify: `src/features/agencies/screens/AgencyDetailScreen.test.tsx`, `src/features/agencies/a11y.test.tsx`
- Create: `src/features/members/a11y.test.tsx`
- Modify: `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (fila F4: «✅ implementada»)

**Interfaces:**
- Consumes: `MembersSection`, `can`, `useMe` ya presente en la pantalla.

- [ ] **Step 1: Failing tests:** en `AgencyDetailScreen.test.tsx`: con `agency.list`+`member.read` aparece `region` «Miembros» con la tabla; sin `member.read` no se pide `/members` ni existe la región (MSW estricto fallaría si se pidiera). En `members/a11y.test.tsx`: `axe` sin violaciones sobre `MembersSection` con miembros y con el diálogo abierto (patrón de `agencies/a11y.test.tsx`).
- [ ] **Step 2:** `pnpm vitest run src/features/agencies src/features/members` → los nuevos FAIL.
- [ ] **Step 3:** Hacer la integración y actualizar la fila F4 del roadmap.
- [ ] **Step 4:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` → todo verde.
- [ ] **Step 5:** commit `feat(members): integra la sección en el detalle de agencia`.
