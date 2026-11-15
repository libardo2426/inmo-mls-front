# Fase 4 — Miembros de la inmobiliaria (diseño)

## Context
F3 dejó la revisión de agencias y los primitivos compartidos (`DataTable`, `PageHeader`, `Section`, `DescriptionList`, `StatusBadge`, aviso de 2FA, `ReviewDialog`). El roadmap reduce F4 a: el personal del MLS **lee y termina** miembros de una inmobiliaria; invitar y cambiar roles son del `broker` (fuera de este panel). Objetivo: que `admin` pueda sacar a un miembro de una agencia desde el panel, y `compliance` pueda verlos.

## Decisiones (del usuario)
- **Entrada:** sección «Miembros» dentro del detalle de la agencia (`AgencyDetailScreen`); sin ruta ni ítem de menú nuevos.
- **Enfoque A:** tabla de solo lectura (nombre, correo, rol, estado, «desde») + «Terminar» con diálogo de confirmación. Sin filtros (se añaden después si hace falta).
- **Motivo obligatorio** en el diálogo (1–1000 caracteres), aunque el esquema lo permita opcional.

## Goals / Non-goals
- Goals: listar miembros por agencia; terminar miembro activo; errores traducidos; accesible y consistente con ADR-0006.
- Non-goals: invitaciones, cambio de rol, renunciar (`members/me/leave`), filtros/búsqueda, paginación (el endpoint no pagina), `allowedActions` (el backend aún no los expone).
- Anti-goal: que el botón aparezca donde el servidor lo rechazará de forma previsible.

## Diseño
Nuevo `src/features/members/` espejando `features/agencies`:
- `api/members-api.ts` + `keys.ts`: `GET /v1/agencies/{id}/members`, `POST /v1/members/{id}/terminate` con los esquemas generados (`MemberResponse`, `TerminateMemberBody`) en `src/lib/api/generated`; patrón de `agencies-api.ts`.
- `hooks/useMembers.ts`, `hooks/useTerminateMember.ts` (invalida la lista; mutation key como `REVIEW_MUTATION_KEY`).
- `components/MembersSection.tsx` (usa `Section` + `DataTable` + `StatusBadge`; filas no activas atenuadas), `components/TerminateMemberDialog.tsx` (patrón de `ReviewDialog`, motivo requerido).
- `terminate-rules.ts` (como `review-rules.ts`): se muestra «Terminar» si `member.status === 'active'` y `can('member.terminate_any')` (admin MLS); `compliance` solo lee (`member.read`). Sin `allowedActions`: el servidor es la fuente de verdad.
- `messages.ts`: textos y mapeo de errores: `last_broker` (409), `member_not_active` (409), `member_not_found` (404), 403 de 2FA (reutiliza el aviso/redirección de F3), `termination_reason_required` (422). Textos es-CO en `src/lib/i18n/es`.
- Integración: `AgencyDetailScreen` renderiza `<MembersSection agencyId=… />` si `can('member.read')`.
- Tono de `StatusBadge` para `active`/`suspended`/`terminated`: revisar `StatusBadge.tsx` y, si falta, añadir según la regla del ADR-0006 (incluido el test de contraste).

## Detalles a confirmar al implementar
- Si el 2FA se detecta igual que en `ReviewDialog` (reutilizar, no duplicar).
- Orden por defecto de la tabla (propuesta: rol y luego «desde»).

## Verificación
- Tests unitarios/componentes (Vitest + Testing Library, patrón de F3): API, reglas, diálogo (motivo obligatorio, errores 409/403), sección (estados cargando/vacío/error/forbidden), a11y (`a11y.test.tsx`).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- E2E con `docker-compose.e2e.yml` si F3 tiene flujo equivalente en `e2e/`: admin abre agencia → termina miembro → desaparece de activos; caso `last_broker`.
- Prueba manual con `pnpm dev` contra el backend demo.

## Siguientes pasos de proceso
Tras aprobar: guardar este diseño en `docs/superpowers/specs/2026-11-02-fase-04-miembros-design.md`, luego `writing-plans`, TDD y rama `fase-04-miembros`; actualizar el roadmap (F4 ✅).
