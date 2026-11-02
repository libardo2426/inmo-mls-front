# Fase 2 — Autorización y shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que quien entra al panel vea un menú lateral con solo los ítems que sus permisos permiten, dentro de un shell (menú plegable + cabecera) reutilizable por F3–F6.

**Architecture:** `lib/permissions` es puro (catálogo, orden de alcances, `can()`) y no conoce la caché de sesión. La ruta `_protegido` resuelve `/me` una vez, lo pone en el contexto del router (para `beforeLoad` de las rutas hijas) y en un `PermissionsProvider` de React (para `useCan`/`<Can>`/menú). El shell vive en `src/app/shell` porque compone la feature `auth` (cierre de sesión) y ADR-0001 prohíbe que una feature importe otra. Una ruta sin permiso lanza `PermissionDeniedError` y el `defaultErrorComponent` del router lo pinta como `ForbiddenState` dentro del shell.

**Tech Stack:** React 19, TanStack Router/Query, Zod, shadcn (`radix-nova`: sidebar, tooltip, dropdown-menu, skeleton, sheet), lucide-react, Tailwind 4, Vitest + Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-11-02-fase-02-autorizacion-shell-design.md`

## Global Constraints

- Sin imports entre features (ADR-0001, regla ESLint `feature-boundaries`). `lib/permissions` no importa de `features/*`.
- Prohibido decidir lógica comparando el rol (`local/no-role-comparison`); el rol solo se muestra.
- Orden de alcances: `own < agency < network`. Sin `minScope`, basta con que el permiso exista (ADR-0004 §3).
- Un permiso de `/me` desconocido para el catálogo se ignora y nunca rompe la sesión.
- Textos en español solo en `src/lib/i18n/es.ts`; sin `dangerouslySetInnerHTML`; sin `fetch` fuera de `lib/http`.
- shadcn solo con la CLI (`pnpm dlx shadcn@latest add …`); no editar a mano `src/components/ui/*` salvo lo imprescindible.
- `localStorage` siempre en `try/catch`; la app debe funcionar sin él.
- `ErrorState` muestra el título del `ProblemDetails` y `requestId`, nunca detalles internos; `ForbiddenState` no dice qué permiso falta.
- Rutas en español (`/`), ítem **Inicio** sin permiso (basta membresía). El menú solo lleva ítems con pantalla real.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` y `pnpm build` en verde. Sin push ni merge sin aprobación.

## Review Focus

1. `/me` con `permissions: {}` (membresía sin permisos): el shell abre, el menú muestra solo Inicio y nada rompe.
2. `/me` trae un permiso que el catálogo no conoce (`'foo.bar': 'network'`): se ignora, `can()` de los demás sigue funcionando.
3. `localStorage` lanza al leer o escribir (modo privado): el menú abre expandido y plegar/desplegar sigue funcionando en memoria.
4. Entrar por URL a una ruta cuyo permiso falta: se ve el shell con el menú y «sin permiso», no una pantalla en blanco ni un redirect a login.
5. Correo o nombre muy largo en el menú de usuario: se trunca sin desbordar el menú plegado ni la cabecera en móvil.

---

### Task 1: Catálogo y `can()` puros

**Files:**
- Create: `src/lib/permissions/catalog.ts`, `src/lib/permissions/can.ts`, `src/lib/permissions/index.ts`
- Test: `src/lib/permissions/can.test.ts`, `src/lib/permissions/catalog.test.ts`

**Interfaces:**
- Produces (todo reexportado desde `@/lib/permissions`):
  - `PERMISSIONS: readonly [...]` (tupla `as const`) y `type Permission = (typeof PERMISSIONS)[number]`
  - `type Scope = 'own' | 'agency' | 'network'`
  - `can(me: Pick<MeResponse, 'membership'>, permission: Permission, minScope?: Scope): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

`catalog.test.ts` — `PERMISSIONS` es exactamente el conjunto de nombres de la tabla «Permisos» de `docs/backend/contexto-para-frontend.md` (leer el archivo con `node:fs`, tomar las líneas de tabla entre la cabecera `| Permiso | Alcances |` y la primera línea que no empieza con `|`, extraer con `/\`([a-z_]+\.[a-z_]+)\`/g`). Aserciones: mismo conjunto ordenado; sin duplicados; sin los permisos de sistema (`media.process`, `outbox.*`, etc. no están).

`can.test.ts` — con un helper `meWith(permissions)` basado en `meFixture`:
- `can(me, 'agency.list')` es `true` si existe con cualquier alcance y `false` si falta.
- `can(me, 'agency.read', 'agency')` con `{'agency.read':'network'}` → `true`; con `{'agency.read':'own'}` → `false`; con `'agency'` → `true`.
- Con `membership: null` → `false`.
- Un permiso desconocido en el mapa (`'foo.bar': 'network'`) no afecta a los demás.

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm vitest run src/lib/permissions`
Expected: FAIL (módulos no existen)

- [ ] **Step 3: Implementar**

`catalog.ts` exporta `PERMISSIONS` con los nombres de la tabla del backend: `property.read`, `property.create`, `property.update`, `mandate.create`, `mandate.update`, `mandate.terminate`, `mandate.terminate_any`, `media.manage`, `document.manage`, `document.read_support`, `agency.read`, `agency.list`, `agency.update`, `agency.resubmit`, `agency.approve`, `agency.request_changes`, `agency.reject`, `member.invite`, `member.update_role`, `member.read`, `member.terminate`, `member.terminate_any`, `tenant_config.read`, `tenant_config.publish`. `can.ts`: rango numérico interno por alcance; devuelve `false` si `membership` es `null` o el valor del mapa no es uno de los tres alcances.

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm vitest run src/lib/permissions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions
git commit -m "feat(permisos): catálogo tipado y can() con orden de alcances"
```

### Task 2: Contexto de permisos, `useCan` y `<Can>`

**Files:**
- Create: `src/lib/permissions/PermissionsProvider.tsx`, `src/lib/permissions/useCan.ts`, `src/lib/permissions/Can.tsx`
- Modify: `src/lib/permissions/index.ts`
- Test: `src/lib/permissions/Can.test.tsx`

**Interfaces:**
- Consumes: `can`, `Permission`, `Scope` (Task 1); `MeResponse` de `@/lib/api/schemas`.
- Produces:
  - `PermissionsProvider({ me, children }: { me: MeResponse; children: ReactNode })`
  - `useMe(): MeResponse` (lanza `Error('Falta <PermissionsProvider>')` fuera del proveedor)
  - `useCan(): (permission: Permission, minScope?: Scope) => boolean`
  - `Can({ permission, minScope, fallback, children }: { permission: Permission; minScope?: Scope; fallback?: ReactNode; children: ReactNode })`

- [ ] **Step 1: Tests que fallan** (`Can.test.tsx`, render directo con el proveedor): `<Can>` renderiza hijos si el permiso existe; renderiza `fallback` (o nada) si no; respeta `minScope`; `useCan` fuera del proveedor lanza; al cambiar el `me` del proveedor (rerender con otro mapa) el resultado cambia.
- [ ] **Step 2: Verificar que fallan** — Run: `pnpm vitest run src/lib/permissions/Can.test.tsx` — Expected: FAIL
- [ ] **Step 3: Implementar** los tres archivos con un contexto de React que guarda `me`; `useCan` devuelve una función estable que envuelve `can(me, …)`; exportar desde `index.ts`. `react-refresh/only-export-components` es `warn`: mantener un componente por archivo.
- [ ] **Step 4: Verificar que pasan** — mismo comando — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(permisos): PermissionsProvider, useCan y <Can>"`

### Task 3: Navegación declarativa

**Files:**
- Create: `src/config/navigation.ts`
- Modify: `src/lib/i18n/es.ts` (namespace `nav`)
- Test: `src/config/navigation.test.ts`

**Interfaces:**
- Consumes: `can`, `Permission`, `Scope` (Task 1).
- Produces:
  - `type NavItem = { to: string; label: string; icon: LucideIcon; permission?: Permission; minScope?: Scope }`
  - `navigation: readonly NavItem[]` — en F2 solo `{ to: '/', label: es.nav.home, icon: House }`
  - `visibleNavigation(me: MeResponse, items: readonly NavItem[] = navigation): NavItem[]`

- [ ] **Step 1: Tests que fallan** — con ítems de prueba inyectados: un ítem sin `permission` siempre aparece; uno con `agency.list` aparece solo si el `me` lo tiene; con `minScope: 'network'` y alcance `agency` no aparece; el orden de la lista se conserva; `navigation` real contiene exactamente un ítem (`to: '/'`) y ninguno de ellos compara rol.
- [ ] **Step 2: Verificar que fallan** — Run: `pnpm vitest run src/config` — Expected: FAIL
- [ ] **Step 3: Implementar** `visibleNavigation` filtrando con `can()` y agregar `es.nav.home = 'Inicio'`.
- [ ] **Step 4: Verificar que pasan** — mismo comando — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(nav): navegación declarativa filtrada por permisos"`

### Task 4: Estados compartidos

**Files:**
- Create: `src/components/shared/EmptyState.tsx`, `ErrorState.tsx`, `ForbiddenState.tsx`
- Modify: `src/lib/i18n/es.ts` (namespace `states`)
- Test: `src/components/shared/states.test.tsx`

**Interfaces:**
- Consumes: `ApiError` de `@/lib/http`; `Button`.
- Produces:
  - `EmptyState({ title: string; description?: string; action?: ReactNode })`
  - `ErrorState({ error: unknown; onRetry?: () => void })`
  - `ForbiddenState()`

- [ ] **Step 1: Tests que fallan** — `ErrorState` con `ApiError` muestra su `title` y `requestId` (texto `es.states.reference` + id) y, si hay `onRetry`, un botón «Reintentar» que lo llama; con un `Error` genérico muestra el texto genérico de `es.states.genericError` y **no** el `message` interno; `ForbiddenState` muestra `es.states.forbiddenTitle` y no contiene el nombre de ningún permiso; `EmptyState` renderiza título, descripción y acción.
- [ ] **Step 2: Verificar que fallan** — Run: `pnpm vitest run src/components/shared` — Expected: FAIL
- [ ] **Step 3: Implementar** los tres con `role="alert"` solo en `ErrorState`; textos en `es.states` (`forbiddenTitle: 'No tiene permiso para ver esta página'`, `forbiddenHelp`, `genericError`, `reference`, `retry`).
- [ ] **Step 4: Verificar que pasan** — mismo comando — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): estados vacío, error y sin permiso"`

### Task 5: Guarda por permiso y contexto de `me`

**Files:**
- Modify: `src/features/auth/session/enforce.ts`, `src/features/auth/session/enforce.test.ts`, `src/routes/_protegido.tsx`
- Create: `src/lib/permissions/guard.ts`, `src/app/shell/RouteErrorBoundary.tsx`
- Modify: `src/app/router.tsx` (pasar `defaultErrorComponent`)
- Test: `src/lib/permissions/guard.test.ts`, `src/app/shell/RouteErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `can` (Task 1); `ErrorState`, `ForbiddenState` (Task 4).
- Produces:
  - `enforce(rule, args): Promise<SessionState>` (antes `Promise<void>`; devuelve el estado resuelto)
  - `class PermissionDeniedError extends Error`
  - `assertCan(me: MeResponse, permission: Permission, minScope?: Scope): void` — lanza `PermissionDeniedError` si `can` es `false`
  - `_protegido.beforeLoad` devuelve `{ me: MeResponse }` al contexto de las rutas hijas
  - `RouteErrorBoundary({ error, reset })` (usable como `defaultErrorComponent`): `PermissionDeniedError` → `ForbiddenState`; cualquier otro → `ErrorState` con `onRetry={reset}`

- [ ] **Step 1: Tests que fallan** — `guard.test.ts`: `assertCan` no lanza si hay permiso y lanza `PermissionDeniedError` si no; `enforce.test.ts` (ampliar): `protected` + sesión válida devuelve `{ status: 'authenticated', me }`; `RouteErrorBoundary.test.tsx`: con `PermissionDeniedError` pinta `ForbiddenState`, con `ApiError` 500 pinta `ErrorState` y «Reintentar» llama a `reset`.
- [ ] **Step 2: Verificar que fallan** — Run: `pnpm vitest run src/lib/permissions/guard.test.ts src/features/auth/session/enforce.test.ts src/app/shell` — Expected: FAIL
- [ ] **Step 3: Implementar** — `enforce` devuelve el estado tras comprobar el destino; `_protegido.beforeLoad` hace `const state = await enforce('protected', …)` y devuelve `{ me: state.me }` (si `state.status !== 'authenticated'` lanzar `Error`, caso inalcanzable porque `enforce` ya redirigió); registrar `defaultErrorComponent: RouteErrorBoundary` en `createAppRouter`.
- [ ] **Step 4: Verificar que pasan** — mismo comando, más `pnpm typecheck` — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(permisos): guarda por permiso y me en el contexto de rutas"`

### Task 6: Componentes shadcn del shell

**Files:**
- Create (por CLI): `src/components/ui/sidebar.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `skeleton.tsx`, `sheet.tsx`, y el hook que arrastre `sidebar` (`src/hooks/use-mobile.ts`)
- Modify: `src/index.css` solo si la CLI agrega tokens de sidebar

- [ ] **Step 1: Instalar** — Run: `pnpm dlx shadcn@latest add sidebar tooltip dropdown-menu skeleton sheet` — Expected: archivos creados sin error. No editar a mano los generados.
- [ ] **Step 2: Verificar** — Run: `pnpm lint && pnpm typecheck && pnpm build` — Expected: PASS (si lint se queja de un archivo generado, ajustar el bloque de `eslint.config.js` de `src/components/ui/**`/`src/hooks/**`, no el archivo)
- [ ] **Step 3: Commit** — `git commit -m "chore(ui): componentes shadcn del shell"`

### Task 7: Shell (menú lateral plegable, cabecera, menú de usuario)

**Files:**
- Create: `src/app/shell/AppShell.tsx`, `AppSidebar.tsx`, `UserMenu.tsx`, `useSidebarPreference.ts`
- Modify: `src/routes/_protegido.tsx` (component: `AppShell`), `src/features/auth/screens/HomePage.tsx` (quitar cabecera, tema y cierre de sesión: queda solo el contenido «sesión iniciada como / país»), `src/lib/i18n/es.ts` (namespace `shell`)
- Test: `src/app/shell/AppShell.test.tsx`, `src/app/shell/useSidebarPreference.test.ts`; actualizar `src/features/auth/screens/HomePage.test.tsx`

**Interfaces:**
- Consumes: `PermissionsProvider` (Task 2); `visibleNavigation` (Task 3); `useLogout` de `@/features/auth/hooks/useLogout`; `meQueryOptions` de `@/features/auth/session/me`; `ThemeToggle`; componentes shadcn (Task 6).
- Produces:
  - `AppShell()`: obtiene `me` con `useSuspenseQuery(meQueryOptions(http))`, envuelve en `PermissionsProvider`, renderiza `SidebarProvider` + `AppSidebar` + cabecera (`SidebarTrigger`, título, `ThemeToggle`, `UserMenu`) + `<Outlet />`
  - `useSidebarPreference(): [open: boolean, setOpen: (open: boolean) => void]` — lee/escribe `localStorage` (clave del implementador) con `try/catch`; por defecto `true`

- [ ] **Step 1: Tests que fallan**
  - `useSidebarPreference.test.ts`: por defecto `true`; persiste `false` y lo recupera al volver a montar; si `localStorage.getItem`/`setItem` lanzan, devuelve `true` y `setOpen(false)` igual cambia el valor en memoria sin lanzar.
  - `AppShell.test.tsx` (con `mountApp('/')` y MSW como en `HomePage.test.tsx`): el menú contiene el enlace **Inicio** con `aria-current="page"`; con `/me` de `permissions: {}` el shell abre y el menú solo tiene Inicio; el botón de plegar alterna el menú (teclado: Enter) y, plegado, el enlace sigue accesible por su nombre; el menú de usuario muestra el correo y el país y «Cerrar sesión» llama a `sign-out` y lleva a `/iniciar-sesion` (migrar aquí los 3 tests de cierre de sesión de `HomePage.test.tsx`); un correo de 80 caracteres no desborda (clase de truncado presente en el elemento).
  - `HomePage.test.tsx`: solo comprueba correo y país dentro del shell.
- [ ] **Step 2: Verificar que fallan** — Run: `pnpm vitest run src/app/shell src/features/auth/screens/HomePage.test.tsx` — Expected: FAIL
- [ ] **Step 3: Implementar** — `SidebarProvider` controlado (`open`/`onOpenChange` con `useSidebarPreference`, sin la cookie por defecto de shadcn); `AppSidebar` con `collapsible="icon"`, `SidebarMenuButton` con `tooltip` y `asChild` + `Link` de TanStack (activo vía `aria-current`); en móvil el panel lo da el `Sheet` interno de shadcn. `UserMenu` usa `DropdownMenu`; el ítem de cierre llama a `useLogout()`. Textos en `es.shell` (`toggleMenu`, `userMenu`, `country`, `logout`, `loggingOut`). Reutilizar `es.app.name` como título del menú.
- [ ] **Step 4: Verificar que pasan** — Run: `pnpm vitest run src/app src/features/auth && pnpm typecheck` — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(shell): menú lateral plegable, cabecera y menú de usuario"`

### Task 8: «Sin permiso» dentro del shell, accesibilidad y cierre de fase

**Files:**
- Test: `src/app/shell/forbidden-route.test.tsx`, `src/app/shell/a11y.test.tsx`
- Modify: `docs/superpowers/adr/0004-modelo-de-permisos.md` (Estado → «Aceptado», nota de cómo quedó), `README.md` (sección «Agregar un ítem de menú»), `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (§11: ADR-0004 «Aceptado (F2)»)

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Tests**
  - `forbidden-route.test.tsx`: router de prueba (`createRootRoute` + ruta `_protegido`-like con `AppShell` + ruta hija con `beforeLoad: ({ context }) => assertCan(context.me, 'agency.approve')` + `defaultErrorComponent: RouteErrorBoundary`) montado con `createMemoryHistory` en esa ruta, `/me` sin ese permiso: se ve el menú con «Inicio» **y** `es.states.forbiddenTitle`; el nombre del permiso no aparece en el DOM. Con el permiso: se ve el contenido de la ruta.
  - `a11y.test.tsx`: igual que `src/features/auth/a11y.test.tsx`: el shell montado en `/` no tiene violaciones (landmarks `nav`/`main`/`header`, foco visible del botón de plegar, `aria-current`).
- [ ] **Step 2: Verificar** — Run: `pnpm vitest run src/app/shell` — Expected: PASS (si falla, corregir el componente, no el test)
- [ ] **Step 3: Documentar** — ADR-0004 a «Aceptado» con fecha 2026-11-02 y una nota: `useCan`/`<Can>` viven en `lib/permissions`, el shell en `src/app/shell`, y las rutas protegidas reciben `context.me`; README: pasos para agregar un ítem (permiso en catálogo → `config/navigation.ts` → ruta con `assertCan`).
- [ ] **Step 4: Verificación completa** — Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` — Expected: todo en verde. Si `format:check` falla, `pnpm format` y revisar el diff.
- [ ] **Step 5: Commit** — `git commit -m "docs(f2): ADR-0004 aceptado, README y pruebas de sin permiso y accesibilidad"`
