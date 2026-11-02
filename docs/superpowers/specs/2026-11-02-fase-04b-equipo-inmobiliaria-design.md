# F4b — Equipo de la inmobiliaria (diseño)

Extiende la F4 (`2026-11-02-fase-04-miembros-design.md`, PR #5). Lo ya hecho para el personal del MLS **no cambia de comportamiento**.

## Intención y por qué
La F4 se construyó solo para el personal del MLS (`admin` termina, `compliance` lee). El alcance real incluye que **la inmobiliaria gestione a su propio equipo desde su panel**: invitar, listar, ver, cambiar rol, dar de baja, reenviar y cancelar invitaciones, y que el invitado se registre y acepte. El panel de la inmobiliaria es **esta misma aplicación**, con menú y pantallas decididos por permisos (decidido por el usuario).

## Hechos del backend (confirmados por el agente backend, leídos del código; no ejecutados)
- **Solo `broker`** lista miembros, invita, lista/reenvía/cancela invitaciones, cambia rol y da de baja a otros. `agent`, `assistant` y `read_only` reciben 403 `role_not_allowed` en esas rutas; su única acción es **renunciar** (`POST /v1/members/me/leave`, 204).
- `GET /v1/agencies/{id}/members` devuelve **solo activos**, sin paginar, sin fecha ni motivo de baja. **No existe** `GET /v1/members/{id}`.
- Aislamiento: agencia ajena → 404 `agency_not_found`; miembro ajeno → 404 `member_not_found`; invitación ajena → 404 `invitation_not_found`.
- `last_broker` (409) bloquea terminar, renunciar **y degradar** al último broker. Un broker puede terminarse o cambiarse el rol a sí mismo.
- Terminar: `reason` opcional (1–1000), obligatorio solo para el `admin` del MLS.
- Cambio de rol: `PATCH /v1/members/{id}/role` `{role}` → 204. Solo `broker`, `agent`, `assistant`, `read_only` (otro valor → 422 `role_not_invitable`); el objetivo debe ser de su agencia y estar activo (`member_not_active` 409).
- Invitar: `POST /v1/agencies/{id}/invitations` `{email, fullName, role, officeId?}` → 201 `{invitation, warnings}`. No comprueba si el correo ya tiene cuenta o membresía: el 409 `already_member` aparece al **aceptar**. Errores: `invitation_already_pending` 409, `agency_not_active` 403 (agencia `pending`), `role_not_invitable` 422, `office_not_available` 409.
- Invitaciones: `GET .../invitations?status=&limit=&cursor=` (cursor; **por defecto `pending`**; una pendiente vencida llega con `status: 'expired'`); `resend` sirve para `pending` y `expired` (renueva 7 días); `cancel` solo `pending`. Campos: `id, agencyId, officeId, email, fullName, role, status, expiresAt, invitedByUserId, createdAt`. El token nunca sale por la API, solo por correo (`INVITATION_ACCEPT_URL#token=<token>`).
- Invitado: crea cuenta con `POST /v1/auth/sign-up/email` (contraseña ≥ 12) o inicia sesión, y `POST /v1/invitations/accept` `{token}` con sesión sin membresía. Preview público: `POST /v1/invitations/preview` `{token}`. **El 2FA no se exige en ningún paso** (solo `admin` y `platform_operator`).
- Una persona tiene **una sola membresía activa** en todo el sistema.

## Goals
- El `broker` ve «Equipo» en el menú y en `/equipo` gestiona miembros e invitaciones de **su** inmobiliaria, de punta a punta.
- El invitado llega por el correo, ve la vista previa, crea cuenta o inicia sesión y acepta.
- `agent`/`assistant`/`read_only` pueden renunciar.
- Admin/compliance siguen igual que en F4.

## Non-goals
- Detalle propio de miembro por endpoint, miembros dados de baja, fecha/motivo de baja, `allowedActions`, paginación de miembros, estado `suspended`, comprobar el correo al invitar: **dependencias pendientes del backend**; no se simulan.
- 2FA para brokers o invitados (el backend no lo impone).
- Sedes (no hay endpoints); el campo `officeId` de la invitación no se ofrece en la UI.
- Registro de inmobiliarias (`POST /v1/agencies`) y el resto del portal (F10).

## Anti-goals
- Que la UI muestre «dado de baja» o «suspendido» como si el backend los listara.
- Que un broker pueda llegar a datos de otra inmobiliaria por la URL: el `agencyId` sale **siempre** de `/me`, nunca de un parámetro.
- Comparar roles en el código; se decide por permisos (ADR-0004).
- Dejar el token de invitación en la URL, en `localStorage`/`sessionStorage` o en logs.

## Restricciones
- ADR-0001: sin imports entre features; la ruta compone. ADR-0003: nada sensible en storage. ADR-0004: permisos con alcance. ADR-0006: primitivos y tonos visuales.
- Textos en `src/lib/i18n/es.ts`; errores por `code`. Tipos desde `@/lib/api/schemas` (esquemas generados: `zInviteMemberBody`, `zInvitationPageResponse`, `zInvitationWithWarningsResponse`, `zInvitationPreviewResponse`, `zAcceptedInvitationResponse`, `zChangeMemberRoleBody`).
- Se parte de la rama `fase-04-miembros` (PR #5 aún sin fusionar) en la rama `fase-04b-equipo-inmobiliaria`; el PR de F4b va contra `master` tras fusionar el #5.

## Enfoques considerados
- **A (elegido por el usuario):** `MembersSection` de F4 se amplía y sirve a ambos paneles; las acciones salen de permisos. El broker la ve en `/equipo` (pestañas «Miembros» e «Invitaciones»); invitaciones y aceptación en una feature nueva `invitations`; la ruta compone.
- **B (descartado):** pantallas separadas para el broker. Duplica tabla, diálogo de baja y mensajes.

## Diseño

### Entrega 1 — Gestión del equipo por el broker
- **Navegación:** ítem «Equipo» (`/equipo`, icono Users) con `permission: 'member.invite'`, `minScope: 'agency'` (solo broker; el MLS no lo tiene y sigue usando el detalle de agencia). `beforeLoad` con `assertCan(me, 'member.invite', 'agency')` y `me.membership.agencyId` no nulo; si es nulo, 403 de ruta.
- **Miembros (`features/members`, ampliado):**
  - `MembersSection` pasa a recibir `agencyId` y decide acciones por permisos: terminar si `member.terminate_any` (red) **o** `member.terminate` con alcance `agency` y el miembro activo; cambiar rol si `member.update_role` (agency). Se generaliza `canTerminateMember`; `terminate-rules.ts` gana `canChangeRole`.
  - El motivo de baja es **obligatorio para `admin` del MLS y opcional para el broker** (el diálogo recibe `reasonRequired: boolean`).
  - Nuevos: `ChangeRoleDialog` (rol entre los 4 invitables; el actual preseleccionado; no ofrece enviar el mismo), `api.changeRole(memberId, role)`, `api.leave()`, hooks, mensajes (`last_broker` también al degradar; `role_not_invitable`; `member_not_active`).
  - **Renunciar (decisión mía):** «Dejar la inmobiliaria» va en el menú de usuario para **cualquier sesión con `me.membership.agencyId` no nulo** (broker, agent, assistant y read_only; el personal del MLS tiene `agencyId` nulo y no lo ve). No se compara el rol. Confirmación explícita; el 409 `last_broker` se muestra en el diálogo («Antes de irse, nombre a otro broker»). Tras el 204 se recarga `/me` y la guardia lleva a `/sin-acceso`. Así `agent`/`assistant`/`read_only`, que no pueden listar el equipo, también pueden irse.
  - **Acciones sobre la propia fila (decisión mía):** aunque el backend permite que un broker se termine o se cambie el rol a sí mismo, la UI **no ofrece «Terminar» ni «Cambiar rol» en la fila propia** (se compara `member.userId` con `me.user.id`, no el rol). Irse es la acción «Dejar la inmobiliaria»; degradarse a sí mismo dejaría al broker sin `member.invite` dentro de `/equipo`. Si hace falta, se reabre.
  - **Detalle del miembro:** panel lateral (`Sheet`) con los datos de la lista (nombre, correo, rol, estado, desde) y las acciones; sin endpoint propio. **Decisión mía:** solo se activa en `/equipo` con una prop `detail` que pasa la ruta; la `MembersSection` del detalle de agencia (MLS) no la pasa y queda **idéntica a F4** (sin filas clicables, mismas pruebas). El permiso no decide el panel; decide las acciones que contiene.
  - Estado: los terminados no llegan del backend; la UI no inventa filas. La tabla muestra solo lo que llega.
- **Invitaciones (`features/invitations`, nueva):**
  - `invitations-api.ts`: `list(agencyId, {status?, cursor?, limit?})`, `invite(agencyId, body)`, `resend(agencyId, id)`, `cancel(agencyId, id)`; hooks con claves `invitationKeys`.
  - `InvitationsSection`: tabla con correo, nombre, rol, estado (`pending`, `expired`, `accepted`, `cancelled`), vence; filtro por estado (por defecto `pending`, igual que el backend), «Cargar más» por cursor. Acciones: reenviar (si `pending` o `expired`), cancelar (si `pending`). Tonos con `StatusBadge`.
  - `InviteMemberDialog`: correo, nombre completo, rol (broker, agent, assistant, read_only); validación de formato y longitudes del esquema (`zInviteMemberBody`). Si la respuesta trae `warnings: email_not_sent`, aviso persistente con la acción «Reenviar».
  - Errores por `code`: `invitation_already_pending`, `agency_not_active` (mensaje «Su inmobiliaria aún no está activa»), `role_not_invitable`, `office_not_available`, `invitation_not_found`, `invitation_not_pending`, `invitation_expired`, `agency_not_found`.
- **Ruta `/equipo`** (en `src/routes/_protegido/equipo.tsx`) compone `MembersSection` e `InvitationsSection` en pestañas con `agencyId` de `/me`.

### Entrega 2 — Recorrido del invitado
- **Ruta pública `/invitaciones/aceptar`** (coincide con `INVITATION_ACCEPT_URL`): regla de guardia nueva `invitation` que deja pasar a anónimos y a sesiones sin membresía (y muestra «Ya tiene una inmobiliaria» a quien ya es miembro).
- **Token:** se lee de `location.hash` (`#token=…`) al montar, se guarda **solo en memoria** (estado de módulo) y se borra de la URL con `history.replaceState`. Sobrevive a la navegación interna (registro → inicio de sesión → aceptar); si se recarga la página, se vuelve a abrir el enlace del correo.
- **Flujo:** `preview` (público) → muestra `agencyName`, `officeName`, `email`, `fullName`, `role`, `expiresAt`; según la sesión: anónimo → «Crear cuenta» (nombre, correo prellenado y bloqueado = el de la invitación, contraseña ≥ 12) o «Ya tengo cuenta» (inicio de sesión); con sesión → «Aceptar invitación» (`accept`). Éxito → recargar `/me` y llevar a `/`.
- **Auth ampliada (`features/auth`):** `signUpEmail({name, email, password})` en `auth-api`. Pantalla de registro reutilizable y la de inicio de sesión aceptan modo «invitación» (sin enlaces a recuperación fuera de flujo); como no hay imports entre features, la **página de aceptación vive en `features/auth`** o se compone en la ruta con los formularios exportados — decisión del constructor, registrada.
- **Errores al aceptar:** `invitation_not_found`, `invitation_not_pending`, `invitation_expired` («pida que le reenvíen la invitación»), `already_member`, `invitation_email_mismatch` (con opción de cerrar sesión), `agency_not_active`.
- **Preview:** 404 `invitation_not_found` = enlace inválido; sin tokens en logs ni en mensajes de error.

## Dependencias del backend (reportadas, no simuladas)
`GET /v1/members/{id}`; listar miembros dados de baja o filtro por estado; fecha y motivo de baja en `MemberResponse`; paginación de miembros; `allowedActions` de miembros e invitaciones (B-15); endpoint que produzca `suspended`; comprobar al invitar si el correo ya es miembro.

## Abierto para el constructor (decisiones que tomará y registrará)
- ¿Better Auth exige verificar el correo tras `sign-up/email` en cada entorno? Si sí, el flujo muestra «revise su correo» y el invitado reabre el enlace; si no, inicia sesión directo. Se comprueba contra el backend en marcha.
- Forma exacta de la respuesta de `sign-up/email` (esquema de auth en `features/auth/api/schemas.ts`).
- Estilo del panel lateral de detalle según ADR-0006.

## Verificación
- Pruebas por unidad (API, reglas, diálogos) y de pantalla con MSW, incluyendo: broker sin `member.invite` no ve «Equipo»; `agent` no ve el ítem y no puede listar; rol 403/404 de agencia ajena se muestra sin romper; `last_broker` al terminar, renunciar y degradar; token borrado de la URL; correo bloqueado = invitación; accesibilidad (foco tras acciones, regiones, diálogos).
- `pnpm lint`, `format:check`, `typecheck`, `test` en verde.
- E2E manual contra el backend real (invitar → correo en Mailpit → aceptar → listar) como verificación pendiente, igual que F3/F4.

## Criterio de cierre
Desde `/equipo` el broker invita, lista, ve y administra miembros e invitaciones de punta a punta; el invitado completa el recorrido; nunca se ve ni modifica otra inmobiliaria; el panel de admin/compliance sigue igual.
