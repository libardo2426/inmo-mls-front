# F4b Equipo de la inmobiliaria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el `broker` gestione su equipo (miembros e invitaciones) desde `/equipo`, que cualquier miembro pueda renunciar, y que el invitado complete su registro y acepte, sin cambiar el comportamiento del panel del MLS.

**Architecture:** `features/members` se amplía (cambio de rol, baja por broker, renunciar, panel de detalle opcional) y `MembersSection` sirve a ambos paneles según permisos. Feature nueva `features/invitations` (gestión y aceptación). El registro/inicio de sesión del invitado vive en `features/auth` y se inyecta en la pantalla de aceptación desde la ruta (ADR-0001: sin imports entre features). Dos entregas: T1–T7 (broker), T8–T10 (invitado).

**Tech Stack:** React, TypeScript strict, TanStack Router/Query, zod (esquemas generados), shadcn/radix-ui, Vitest + Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-11-02-fase-04b-equipo-inmobiliaria-design.md` (base: F4, `2026-11-02-fase-04-miembros-design.md`)

## Global Constraints

- Rama `fase-04b-equipo-inmobiliaria` (sobre `fase-04-miembros`); commits convencionales en español terminados con la línea `Co-Authored-By` de la sesión.
- Textos solo en `src/lib/i18n/es.ts`; errores por `error.code`, nunca por título; tipos y esquemas solo desde `@/lib/api/schemas`.
- Sin imports entre features (lint `no-restricted-imports`): lo compone la ruta, lo compartido sube a `src/components`, `src/lib` o `src/hooks`. `src/app/**` sí puede importar de features.
- Decidir por permisos (`can`), nunca por rol; el `agencyId` del broker sale de `me.membership.agencyId`, jamás de la URL.
- Sin tokens en `localStorage`/`sessionStorage`; el token de invitación solo en memoria y borrado de la URL.
- Roles invitables/asignables: `broker`, `agent`, `assistant`, `read_only`. `reason` de baja: 1–1000 caracteres; obligatorio solo si `can(me,'member.terminate_any','network')`.
- Sin acciones «Terminar»/«Cambiar rol» sobre la fila propia (`me.user.id === member.userId`).
- La `MembersSection` del detalle de agencia (MLS) queda idéntica a F4: sin filas clicables y sin panel de detalle.
- Dependencias del backend (detalle de miembro, miembros dados de baja, `allowedActions`, etc.) no se simulan.
- Verificación final: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`. Tras añadir rutas, `routeTree.gen.ts` se regenera al correr `pnpm vitest run` o `pnpm build`; se commitea.

## Review Focus

1. Un broker no ve «Terminar» ni «Cambiar rol» en su propia fila (T2, T4).
2. `last_broker` al terminar, renunciar o degradar deja el diálogo abierto con su mensaje (T3).
3. Invitar con `warnings: email_not_sent` deja un aviso persistente con «Reenviar» (T6).
4. Un `agent` no ve «Equipo», pero sí «Dejar la inmobiliaria»; el personal del MLS no la ve (T7).
5. El token no queda en la URL ni en storage, y sin token el enlace se declara inválido; `already_member` e `invitation_email_mismatch` tienen mensaje propio (T10).

## File Structure

- Modify: `src/lib/api/schemas.ts`, `src/lib/i18n/es.ts`, `src/test/fixtures.ts`, `src/features/members/{api/members-api.ts,terminate-rules.ts,messages.ts,hooks/useTerminateMember.ts,components/TerminateMemberDialog.tsx,components/MembersSection.tsx}`, `src/config/navigation.ts`, `src/app/shell/UserMenu.tsx`, `src/features/auth/{api/auth-api.ts,messages.ts,session/guard.ts}`, `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md`.
- Create: `src/components/ui/{native-select.tsx,tabs.tsx}`; `src/features/members/{hooks/useChangeMemberRole.ts,hooks/useLeaveAgency.ts,components/ChangeRoleDialog.tsx,components/LeaveAgencyDialog.tsx,components/MemberDetailSheet.tsx}`; `src/features/invitations/{api/{invitations-api.ts,keys.ts},hooks/*,messages.ts,token.ts,components/{InvitationsSection,InviteMemberDialog,InvitationStatusBadge}.tsx,screens/AcceptInvitationScreen.tsx}`; `src/features/auth/components/InvitationAuthPanel.tsx`; `src/routes/_protegido/equipo.tsx`; `src/routes/invitaciones/aceptar.tsx`.

---

### Task 1: Esquemas, roles, textos, fixtures y controles base

**Files:**
- Modify: `src/lib/api/schemas.ts`, `src/lib/i18n/es.ts`, `src/test/fixtures.ts`
- Create: `src/components/ui/native-select.tsx`, `src/components/ui/tabs.tsx`
- Test: `src/lib/api/schemas.test.ts`, `src/components/ui/controls.test.tsx`

**Interfaces:**
- Produces (`schemas.ts`): `inviteMemberBodySchema = zInviteMemberBody`; `invitationPageSchema = zInvitationPageResponse`; `invitationWithWarningsSchema = zInvitationWithWarningsResponse`; `invitationPreviewSchema = zInvitationPreviewResponse`; `acceptedInvitationSchema = zAcceptedInvitationResponse`; `type Invitation = InvitationWithWarnings['invitation']`; `type InvitationPage`, `InvitationWithWarnings`, `InvitationPreview`, `AcceptedInvitation`, `InvitationStatus = Invitation['status']`; `export const INVITABLE_ROLES = ['broker','agent','assistant','read_only'] as const`; `type InvitableRole = (typeof INVITABLE_ROLES)[number]`.
- Produces (`fixtures.ts`): `BROKER_AGENCY_ID: string`; `brokerMeFixture(overrides?: { permissions?: Record<string,'own'|'agency'|'network'> }): MeResponse` (rol `broker`, `agencyId: BROKER_AGENCY_ID`, `agencyStatus: 'active'`, permisos por defecto `member.read/member.invite/member.update_role/member.terminate: 'agency'`, `user.id` estable); `agentMeFixture(): MeResponse` (rol `agent`, mismo `agencyId`, permisos `{'member.terminate': 'own'}`); `invitationFixture(overrides?: Record<string,unknown>)` (`id`, `agencyId: BROKER_AGENCY_ID`, `officeId: null`, `email: 'nuevo@demo.test'`, `fullName: 'Nuevo Demo'`, `role: 'agent'`, `status: 'pending'`, `expiresAt: '2026-11-09T12:00:00.000Z'`, `invitedByUserId`, `createdAt: '2026-11-02T12:00:00.000Z'`).
- Produces (`ui`): `NativeSelect` (`<select>` con las clases de `Input`, mismas props que `select`); `Tabs, TabsList, TabsTrigger, TabsContent` envolviendo `Tabs` de `radix-ui` (patrón de `sheet.tsx`).
- Produces (`es`): bloques `es.nav.team: 'Equipo'`; `es.members.roles` ya existe; añadir `es.members.changeRole.{action,actionFor(name),title(name),description,roleLabel,submit,done}`, `es.members.leave.{menu:'Dejar la inmobiliaria',title,description,submit,done}`, `es.members.detail.{open(name),title,close}`, `es.members.terminate.reasonOptionalHelp`, `es.members.errors.{roleNotInvitable,invitableOnly}`; `es.team.{title:'Equipo',tabs.{members:'Miembros',invitations:'Invitaciones'}}`; `es.invitations.*` (columnas, `status.{pending,accepted,cancelled,expired}`, filtro, `invite.{action,title,email,fullName,role,submit,done}`, `emailNotSent`, `resend`, `cancel`, `cancelConfirm`, vacío, `errors.*` para `invitation_already_pending`, `agency_not_active`, `role_not_invitable`, `office_not_available`, `invitation_not_found`, `invitation_not_pending`, `invitation_expired`, `agency_not_found`, red, 429, genérico, referencia); `es.invitations.accept.*` (título, vista previa, `invalidLink`, `expired`, `alreadyMember`, `mismatch`, `notActive`, `submit`, `signedInAs`, `useOtherAccount`, `alreadyHasAgency`).

- [ ] **Step 1: Failing tests.** En `schemas.test.ts`: `invitationPageSchema.parse({items:[invitationFixture()], nextCursor:null}).items[0]?.status === 'pending'`; `invitationWithWarningsSchema` acepta `warnings:[{code:'email_not_sent'}]` y rechaza `warnings:[{code:'x'}]`; `INVITABLE_ROLES` es exactamente `['broker','agent','assistant','read_only']`. En `controls.test.tsx`: `NativeSelect` con `<label>` asociada cambia de valor con `userEvent.selectOptions`; `Tabs` muestra solo el panel activo y cambia con clic en el `tab`.
- [ ] **Step 2:** `pnpm vitest run src/lib/api/schemas.test.ts src/components/ui/controls.test.tsx` → FAIL (exports/archivos inexistentes).
- [ ] **Step 3:** Implementar según Interfaces (copiar estilo de `input.tsx` y `sheet.tsx`).
- [ ] **Step 4:** mismo comando → PASS; `pnpm typecheck` limpio.
- [ ] **Step 5:** commit `feat(team): esquemas, textos, fixtures y controles base`.

---

### Task 2: Reglas de permisos y API de miembros ampliada

**Files:**
- Modify: `src/features/members/terminate-rules.ts`, `src/features/members/api/members-api.ts`, `src/features/members/hooks/useTerminateMember.ts`, `src/features/members/messages.ts`
- Create: `src/features/members/hooks/useChangeMemberRole.ts`, `src/features/members/hooks/useLeaveAgency.ts`
- Test: `terminate-rules.test.ts`, `api/members-api.test.ts`, `messages.test.ts`

**Interfaces:**
- Consumes: `brokerMeFixture`, `agentMeFixture`, `memberFixture`, `INVITABLE_ROLES`.
- Produces (`terminate-rules.ts`): `isSelf(me: MeResponse, member: Pick<Member,'userId'>): boolean`; `canTerminateMember(me, member: Pick<Member,'status'|'userId'>): boolean` = `status==='active' && !isSelf && (can(me,'member.terminate_any','network') || can(me,'member.terminate','agency'))`; `canChangeRole(me, member: Pick<Member,'status'|'userId'>): boolean` = `status==='active' && !isSelf && can(me,'member.update_role','agency')`; `reasonRequiredFor(me): boolean` = `can(me,'member.terminate_any','network')`; `canLeaveAgency(me): boolean` = `me.membership?.agencyId != null`. `REASON_MAX` se mantiene.
- Produces (`MembersApi`): `terminate(memberId: string, reason?: string): Promise<void>` (cuerpo `{}` si no hay motivo); `changeRole(memberId: string, role: InvitableRole): Promise<void>` (`PATCH /members/{id}/role`, 204); `leave(): Promise<void>` (`POST /members/me/leave`, 204).
- Produces (hooks): `useTerminateMember` acepta `{memberId, reason?: string}`; `useChangeMemberRole()` con `mutationFn({memberId, role})` y `CHANGE_ROLE_MUTATION_KEY = ['members','change-role']`; `useLeaveAgency()` con `LEAVE_MUTATION_KEY = ['members','leave']`; los tres invalidan `memberKeys.all` en éxito y en `member_not_active`.
- Produces (`memberErrorMessage`): añade `role_not_invitable`→`es.members.errors.roleNotInvitable`; 404 `agency_not_found`→`es.members.errors.notFound`.

- [ ] **Step 1: Failing tests.** `terminate-rules`: broker (`brokerMeFixture`) puede terminar a un `agent` activo (true) y a otro broker; **false sobre su propia fila** (`userId === me.user.id`); false si `suspended`/`terminated`; `canChangeRole` true para broker sobre otro activo, false sobre sí mismo y para `agentMeFixture`; admin MLS (`terminate_any` red, sin `update_role`) → `canTerminate` true y `canChangeRole` false; compliance (solo `member.read`) → ambos false; `reasonRequiredFor` true solo con `terminate_any`; `canLeaveAgency` true para broker y agent, false para `meFixture()` (agencyId null). **Actualizar** el caso F4 «member.terminate de agencia (broker) no basta» → ahora `true` (cambio de comportamiento deliberado, ledger como Ruling). `members-api`: `changeRole('M1','agent')` → `PATCH /v1/members/M1/role` body `{"role":"agent"}` y resuelve; `leave()` → `POST /v1/members/me/leave` 204; `terminate('M1')` sin motivo envía cuerpo `{}`; 409 `last_broker` en `changeRole` rechaza con `ApiError` code `last_broker`. `messages`: `role_not_invitable` y `agency_not_found`.
- [ ] **Step 2:** `pnpm vitest run src/features/members` → FAIL en lo nuevo.
- [ ] **Step 3:** Implementar según Interfaces (patrón de `useTerminateMember`).
- [ ] **Step 4:** mismo comando → PASS (incluye el resto de pruebas de F4); `pnpm typecheck`.
- [ ] **Step 5:** commit `feat(members): permisos de broker, cambio de rol y renuncia en la API`.

---

### Task 3: Diálogos de baja opcional, cambio de rol y renuncia

**Files:**
- Modify: `src/features/members/components/TerminateMemberDialog.tsx`
- Create: `src/features/members/components/ChangeRoleDialog.tsx`, `src/features/members/components/LeaveAgencyDialog.tsx`
- Test: `TerminateMemberDialog.test.tsx`, `ChangeRoleDialog.test.tsx`, `LeaveAgencyDialog.test.tsx`

**Interfaces:**
- Consumes: hooks de T2, `memberErrorMessage`, `NativeSelect`, `INVITABLE_ROLES`, `useCountdown`.
- Produces: `TerminateMemberDialog` gana prop `reasonRequired: boolean` (si `false`, el botón se habilita con motivo vacío y el POST envía `{}`; con motivo lo envía recortado; el tope de 1000 aplica siempre; la ayuda cambia a `reasonOptionalHelp`). `ChangeRoleDialog({ member: Member; open; onOpenChange(open:boolean):void; onDone():void })`: `NativeSelect` con los 4 roles (el actual preseleccionado y el botón deshabilitado mientras no cambie). `LeaveAgencyDialog({ open; onOpenChange; onDone })`: confirmación `es.members.leave.*`. Los tres: `Alert role="alert"` con `memberErrorMessage`, 429 con cuenta atrás, no cierran mientras están pendientes, devuelven el foco, y **mantienen el diálogo abierto con `last_broker`**.

- [ ] **Step 1: Failing tests** (patrón de `TerminateMemberDialog.test.tsx`): Terminate: con `reasonRequired={false}` el botón está habilitado sin motivo y el cuerpo es `{}`; con `reasonRequired` el comportamiento F4 se conserva (las pruebas existentes pasan `reasonRequired`). ChangeRole: preselecciona el rol actual y el botón está deshabilitado; al elegir `assistant` y confirmar envía `{"role":"assistant"}` y llama `onDone` una vez; 409 `last_broker` muestra `es.members.errors.lastBroker` y no cierra. Leave: confirmar hace `POST /v1/members/me/leave` y llama `onDone`; 409 `last_broker` muestra su mensaje y no cierra.
- [ ] **Step 2:** `pnpm vitest run src/features/members/components` → FAIL.
- [ ] **Step 3:** Implementar adaptando `TerminateMemberDialog.tsx` (misma estructura de foco, cuenta atrás y error).
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(members): diálogos de baja opcional, cambio de rol y renuncia`.

---

### Task 4: MembersSection con acciones por permisos y panel de detalle

**Files:**
- Modify: `src/features/members/components/MembersSection.tsx`
- Create: `src/features/members/components/MemberDetailSheet.tsx`
- Test: `MembersSection.test.tsx`, `src/features/members/a11y.test.tsx`

**Interfaces:**
- Consumes: reglas de T2, diálogos de T3, `Sheet` (`@/components/ui/sheet`).
- Produces: `MembersSection({ agencyId: string; detail?: boolean })`. Columna de acciones con «Cambiar rol» (si `canChangeRole`) y «Terminar» (si `canTerminateMember`), cada botón con `aria-label` `actionFor(name)`; `reasonRequired={reasonRequiredFor(me)}`. Con `detail`, el nombre es un botón (`es.members.detail.open(name)`) que abre `MemberDetailSheet({ member: Member; onClose(): void; children: ReactNode })` con nombre, correo, rol, estado, «desde» (`DescriptionList`) y las mismas acciones; cerrar devuelve el foco al botón del nombre. El aviso de éxito (`role="status"`, foco) se conserva y sirve a las tres acciones. Sin `detail`, el componente se comporta **exactamente como en F4**.

- [ ] **Step 1: Failing tests** (broker con `brokerMeFixture`, lista con broker propio, agente y asistente): el broker ve «Cambiar rol» y «Terminar» en las filas ajenas y **ninguno en la propia**; cambiar rol de un agente a `assistant` envía el PATCH, cierra, avisa con `es.members.changeRole.done` y recarga; terminar sin motivo funciona; con `detail` el clic en el nombre abre el panel (`role="dialog"`) con el correo y las acciones, y `Escape` devuelve el foco; **sin `detail` no hay botón de nombre**; admin MLS sigue viendo solo «Terminar» con motivo obligatorio (las pruebas de F4 pasan sin cambios, salvo pasar fixtures); `agentMeFixture` (sin `member.read`) no monta la sección con datos (la ruta lo impide; aquí solo se verifica que sin acciones no hay columna). En `a11y.test.tsx`: tabla con `detail` tiene botones con nombre accesible.
- [ ] **Step 2:** `pnpm vitest run src/features/members` → FAIL en lo nuevo.
- [ ] **Step 3:** Implementar `MembersSection` ampliada y `MemberDetailSheet`.
- [ ] **Step 4:** mismo comando → PASS (F4 incluido).
- [ ] **Step 5:** commit `feat(members): acciones del broker y panel de detalle`.

---

### Task 5: API, hooks y mensajes de invitaciones

**Files:**
- Create: `src/features/invitations/api/{invitations-api.ts,keys.ts,invitations-api.test.ts}`, `src/features/invitations/hooks/{useInvitationsApi.ts,useInvitations.ts,useInviteMember.ts,useResendInvitation.ts,useCancelInvitation.ts}`, `src/features/invitations/{messages.ts,messages.test.ts}`

**Interfaces:**
- Consumes: esquemas de T1, `HttpClient`, patrón de `features/agencies/hooks/useAgencies.ts` (paginación por cursor con `useInfiniteQuery`).
- Produces: `type InviteMemberInput = { email: string; fullName: string; role: InvitableRole }`; `type InvitationsApi = { list(agencyId: string, input?: { status?: InvitationStatus; cursor?: string; limit?: number; signal?: AbortSignal }): Promise<InvitationPage>; invite(agencyId: string, body: InviteMemberInput): Promise<InvitationWithWarnings>; resend(agencyId: string, id: string): Promise<InvitationWithWarnings>; cancel(agencyId: string, id: string): Promise<void>; preview(token: string): Promise<InvitationPreview>; accept(token: string): Promise<AcceptedInvitation> }`; `createInvitationsApi(http: HttpClient): InvitationsApi` (host `country`; rutas del contrato §8.3; `preview` y `accept` envían `{token}` en el cuerpo). `invitationKeys = { all: ['invitations'] as const, list: (agencyId: string, status: InvitationStatus) => ['invitations','list',agencyId,status] as const }`. Hooks: `useInvitationsApi()`, `useInvitations(agencyId, status)` (infinite, `nextCursor`), `useInviteMember(agencyId)`, `useResendInvitation(agencyId)`, `useCancelInvitation(agencyId)` (invalidan `invitationKeys.all`; `resend/cancel` también ante `invitation_not_pending`). `invitationErrorMessage(error: unknown): string` por `code`.

- [ ] **Step 1: Failing tests.** `list('A1')` pide `GET /v1/agencies/A1/invitations` sin `status` si no se pasa y con `?status=expired&limit=20` si se pasa, y parsea `{items,nextCursor}`; `invite` hace POST con `{email,fullName,role}` y devuelve `warnings`; `resend`/`cancel` apuntan a `/invitations/{id}/resend|cancel` (cancel resuelve `undefined` con 204); `preview('t')` y `accept('t')` hacen POST a `/invitations/preview|accept` con cuerpo `{"token":"t"}`; `ValidationError` si `status` fuera del contrato. `invitationErrorMessage`: una aserción por cada code de `es.invitations.errors`, 429 con segundos, red, y desconocido → genérico con `requestId`, nunca el título.
- [ ] **Step 2:** `pnpm vitest run src/features/invitations` → FAIL.
- [ ] **Step 3:** Implementar (calcar `agencies-api.ts`, `useAgencies.ts`, `messages.ts` de agencias).
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(invitations): cliente HTTP, hooks y mensajes de invitaciones`.

---

### Task 6: Sección de invitaciones e invitar

**Files:**
- Create: `src/features/invitations/components/{InvitationsSection.tsx,InviteMemberDialog.tsx,InvitationStatusBadge.tsx}`
- Test: `InvitationsSection.test.tsx`, `InviteMemberDialog.test.tsx`

**Interfaces:**
- Consumes: T1, T5, `DataTable`, `StatusBadge`, `Section`, `NativeSelect`, `formatDate`.
- Produces: `InvitationStatusBadge({ status })` (pending→`warning`, accepted→`success`, cancelled→`neutral`, expired→`danger`; valor desconocido → neutro con el valor crudo). `InviteMemberDialog({ agencyId; open; onOpenChange; onDone(result: InvitationWithWarnings): void })`: correo, nombre completo y rol (los 4 invitables, `agent` por defecto); valida con `inviteMemberBodySchema` más formato de correo; 429 con cuenta atrás; foco devuelto. `InvitationsSection({ agencyId })`: botón «Invitar», filtro de estado (por defecto `pending`), tabla (correo, nombre, rol, estado, vence), «Cargar más»; «Reenviar» si `pending` o `expired`, «Cancelar» (con confirmación) si `pending`; aviso `role="status"` al invitar, reenviar o cancelar; si la respuesta trae `warnings: email_not_sent` el aviso **permanece** con un botón «Reenviar» para esa invitación.

- [ ] **Step 1: Failing tests** (`brokerMeFixture`): lista las pendientes por defecto (la petición lleva `status=pending`) y cambiar el filtro a «Vencidas» repite con `status=expired`; vacío muestra el estado vacío; invitar envía `{email,fullName,role}` recortados, cierra y recarga; correo inválido o nombre vacío mantiene el botón deshabilitado; 409 `invitation_already_pending` y 403 `agency_not_active` muestran su mensaje y mantienen el diálogo; **respuesta con `email_not_sent` deja el aviso persistente y «Reenviar» llama a `.../resend`**; reenviar una `expired` recarga; cancelar pide confirmación y envía POST `cancel`; `invitation_not_pending` al cancelar muestra su mensaje y recarga; «Cargar más» pide con `cursor`.
- [ ] **Step 2:** `pnpm vitest run src/features/invitations/components` → FAIL.
- [ ] **Step 3:** Implementar según Interfaces.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(invitations): listado, invitar, reenviar y cancelar`.

---

### Task 7: Ruta /equipo, menú y «Dejar la inmobiliaria»

**Files:**
- Create: `src/routes/_protegido/equipo.tsx`
- Modify: `src/config/navigation.ts`, `src/app/shell/UserMenu.tsx`, `src/routeTree.gen.ts` (regenerado)
- Test: `src/config/navigation.test.ts`, `src/features/members/team-route.test.tsx`, `src/app/shell/UserMenu.test.tsx`

**Interfaces:**
- Consumes: `MembersSection({detail})`, `InvitationsSection`, `Tabs`, `LeaveAgencyDialog`, `canLeaveAgency`, `ME_QUERY_KEY`, `assertCan`.
- Produces: ítem `{ to: '/equipo', label: es.nav.team, icon: Users, permission: 'member.invite', minScope: 'agency' }` tras «Agencias». Ruta `/_protegido/equipo`: `validateSearch` `{ tab: 'miembros' | 'invitaciones' }` (por defecto `miembros`, `.catch`), `beforeLoad` `assertCan(context.me, 'member.invite', 'agency')` y 403 de ruta si `me.membership.agencyId` es nulo; la pantalla usa `me.membership.agencyId` y compone `<Tabs>` con `<MembersSection agencyId detail />` e `<InvitationsSection agencyId />`. `UserMenu` muestra «Dejar la inmobiliaria» si `canLeaveAgency(me)`; abre `LeaveAgencyDialog`; en `onDone` hace `queryClient.removeQueries({queryKey: ME_QUERY_KEY})` y navega a `/` (la guarda lleva a `/sin-acceso`).

- [ ] **Step 1: Failing tests.** `navigation.test`: broker ve «Equipo»; `agentMeFixture` y `meFixture()` (MLS) no. `team-route.test` (con `mountApp('/equipo')`): broker ve las pestañas y la tabla con detalle; `?tab=invitaciones` abre invitaciones; **agent** que entra a `/equipo` ve el estado «sin permiso» y no se pide `/members`; sesión MLS (`member.read` de red, sin `member.invite`) también es rechazada. `UserMenu.test`: agent ve «Dejar la inmobiliaria», MLS no; confirmar hace el POST y, con `/me` pasando a 403 `no_membership`, termina en `/sin-acceso`.
- [ ] **Step 2:** `pnpm vitest run src/config src/features/members/team-route.test.tsx src/app/shell` → FAIL.
- [ ] **Step 3:** Implementar; correr `pnpm vitest run` una vez para regenerar `routeTree.gen.ts`.
- [ ] **Step 4:** mismo comando → PASS; `pnpm typecheck`.
- [ ] **Step 5:** commit `feat(team): ruta /equipo, menú y renuncia desde el menú de usuario` (incluye `routeTree.gen.ts`).

> Cierre de la entrega 1: ejecutar `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.

---

### Task 8: Registro y panel de autenticación del invitado

**Files:**
- Modify: `src/features/auth/api/auth-api.ts`, `src/features/auth/messages.ts`, `src/lib/i18n/es.ts`
- Create: `src/features/auth/components/InvitationAuthPanel.tsx`
- Test: `auth-api.test.ts`, `messages.test.ts`, `InvitationAuthPanel.test.tsx`

**Interfaces:**
- Consumes: `signInEmail` existente, `LogoutButton`/`api.signOut`, `ME_QUERY_KEY`, `useCountdown`, `AuthCard` estilos.
- Produces: `AuthApi.signUpEmail(input: { name: string; email: string; password: string }): Promise<void>` (`POST /auth/sign-up/email`, respuesta ignorada con `ignoredResponseSchema`). `InvitationAuthPanel({ email: string; fullName: string; signedIn: boolean; onChanged(): void })`: si `signedIn`, muestra «Sesión iniciada» con «Usar otra cuenta» (cierra sesión, descarta `/me`, `onChanged`); si no, dos modos: **Crear cuenta** (nombre prellenado, correo prellenado y de solo lectura, contraseña ≥ 12 con la validación de F1) y **Ya tengo cuenta** (correo bloqueado = el de la invitación, contraseña). Crear cuenta = `signUpEmail` y luego `signInEmail`; al lograr sesión, `removeQueries(ME_QUERY_KEY)` y `onChanged()`. Mensajes por `code` de Better Auth: añadir `USER_ALREADY_EXISTS` (→ «Ya existe una cuenta con ese correo, inicie sesión») y `PASSWORD_TOO_SHORT`/`EMAIL_NOT_VERIFIED`; el resto cae en genérico. **El constructor verifica los códigos reales contra el backend en marcha y registra un Ruling si difieren.**

- [ ] **Step 1: Failing tests.** `auth-api`: `signUpEmail` hace POST `/v1/auth/sign-up/email` con `{name,email,password}`. `InvitationAuthPanel` (MSW): correo bloqueado; contraseña de 11 caracteres deshabilita enviar; crear cuenta hace sign-up y luego sign-in y llama `onChanged` una vez; `USER_ALREADY_EXISTS` muestra su mensaje y ofrece pasar al modo «Ya tengo cuenta»; `EMAIL_NOT_VERIFIED` en el sign-in muestra «revise su correo y vuelva a abrir el enlace»; con `signedIn` muestra «Usar otra cuenta» y al pulsarlo hace sign-out; 429 con cuenta atrás.
- [ ] **Step 2:** `pnpm vitest run src/features/auth` → FAIL en lo nuevo.
- [ ] **Step 3:** Implementar (patrón de `LoginPage.tsx`).
- [ ] **Step 4:** mismo comando → PASS (F1 incluido).
- [ ] **Step 5:** commit `feat(auth): registro y panel de autenticación para invitados`.

---

### Task 9: Regla de guarda `invitation`

**Files:**
- Modify: `src/features/auth/session/guard.ts`
- Test: `src/features/auth/session/guard.test.ts`

**Interfaces:**
- Produces: `GuardRule` gana `'invitation'`. `guardTarget('invitation', state, returnTo)`: `anonymous`, `no-membership` y `authenticated` → `null` (quedarse); `two-factor-required` → `{to:'/activar-2fa'}`; `unavailable` → `/mantenimiento`; `offline` → `/sin-conexion`.

- [ ] **Step 1: Failing test** con las seis entradas de `SessionState` y los destinos anteriores.
- [ ] **Step 2:** `pnpm vitest run src/features/auth/session/guard.test.ts` → FAIL.
- [ ] **Step 3:** Implementar el caso en `guardTarget`.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5:** commit `feat(auth): regla de guarda para la aceptación de invitaciones`.

---

### Task 10: Token en memoria, pantalla y ruta de aceptación

**Files:**
- Create: `src/features/invitations/token.ts`, `src/features/invitations/screens/AcceptInvitationScreen.tsx`, `src/routes/invitaciones/aceptar.tsx`
- Modify: `src/routeTree.gen.ts` (regenerado), `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (F4 ✅ ampliada)
- Test: `token.test.ts`, `AcceptInvitationScreen.test.tsx`, `src/features/invitations/accept-route.test.tsx`

**Interfaces:**
- Consumes: `invitationsApi.preview/accept`, `InvitationAuthPanel` (solo desde la ruta), `enforce('invitation', …)`, `ME_QUERY_KEY`.
- Produces (`token.ts`): `readTokenFromHash(hash: string): string | null` (acepta `#token=abc`, rechaza vacío, otras claves o más de 200 caracteres); `setInvitationToken(token: string | null): void`, `getInvitationToken(): string | null` (variable de módulo, nunca storage).
- Produces (`AcceptInvitationScreen`): props `{ session: 'anonymous' | 'no-membership' | 'authenticated'; renderAuth(invitation: InvitationPreview, signedIn: boolean): ReactNode; onAccepted(): void }`. Al montar lee `window.location.hash`, guarda el token en memoria y limpia la URL con `window.history.replaceState(null, '', pathname + search)`. Estados: sin token → «Enlace no válido»; cargando; `preview` correcto → tarjeta con inmobiliaria, sede, correo, nombre, rol y vencimiento; `anonymous` → `renderAuth(inv, false)`; `no-membership` → `renderAuth(inv, true)` y botón «Aceptar invitación»; `authenticated` → «Ya pertenece a una inmobiliaria» con enlace a `/`. Errores de `preview`/`accept` por `code`: `invitation_not_found`→enlace no válido; `invitation_not_pending`; `invitation_expired` («pida que le reenvíen la invitación»); `already_member`; `invitation_email_mismatch` (con «Usar otra cuenta» vía `renderAuth`); `agency_not_active`. Éxito → `onAccepted()`.
- Produces (ruta): `/invitaciones/aceptar` fuera de `_protegido`, `beforeLoad: enforce('invitation', …)` devolviendo el `status`; el componente compone `AcceptInvitationScreen` con `renderAuth={(inv, signedIn) => <InvitationAuthPanel email={inv.email} fullName={inv.fullName} signedIn={signedIn} onChanged={() => router.invalidate()} />}` y `onAccepted` = `removeQueries(ME_QUERY_KEY)` + navegar a `/`.

- [ ] **Step 1: Failing tests.** `token`: `readTokenFromHash('#token=abc')==='abc'`, `''`/`'#x=1'`/`'#token='`/token de 201 caracteres → `null`; set/get/clear. `Screen` (MSW): al montar con `#token=abc`, **`window.location.hash === ''`**, `localStorage` y `sessionStorage` quedan vacíos y `preview` se llama con `{"token":"abc"}`; sin hash → «Enlace no válido» y **ninguna petición**; 404 `invitation_not_found` → enlace no válido; sesión `no-membership` + clic en «Aceptar» hace `accept` y llama `onAccepted` una vez; 409 `already_member`, 403 `invitation_email_mismatch`, 409 `invitation_expired`, 409 `invitation_not_pending`, 403 `agency_not_active`: cada uno su mensaje y la pantalla no se rompe; `authenticated` no ofrece aceptar. `accept-route` (`mountApp('/invitaciones/aceptar#token=abc')`): anónimo ve la vista previa y el panel con el correo bloqueado; tras sign-up+sign-in simulados y `/me` pasando a `no-membership`, aparece «Aceptar invitación».
- [ ] **Step 2:** `pnpm vitest run src/features/invitations` → FAIL en lo nuevo.
- [ ] **Step 3:** Implementar; correr `pnpm vitest run` para regenerar `routeTree.gen.ts`; actualizar la fila F4 del roadmap («✅ implementada con el equipo de la inmobiliaria, ver `…fase-04b…`»).
- [ ] **Step 4:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` → todo verde.
- [ ] **Step 5:** commit `feat(invitations): aceptación de invitaciones con token en memoria`.
