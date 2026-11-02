# F3.5 Sistema visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al panel una identidad visual consistente: paleta semántica, escala tipográfica y primitivos de composición aplicados a tablas, detalle, diálogos y shell.

**Architecture:** Tokens como variables CSS en `src/index.css` (claro/oscuro) expuestas a Tailwind v4 vía `@theme inline`; 4 utilidades tipográficas con `@utility`; primitivos presentacionales en `src/components/shared/`; las pantallas de F3 y el shell los consumen sin cambiar comportamiento.

**Tech Stack:** React 19, Tailwind v4, shadcn (radix/nova) + `class-variance-authority`, Vitest + Testing Library + axe, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-fase-03-5-sistema-visual-design.md`

## Global Constraints

- Tema claro y oscuro desde tokens; el tema oscuro se activa con la clase `dark` en `<html>` (`src/app/theme/ThemeProvider.tsx`).
- Sin gradientes ni ilustraciones; densidad alta (tablas compactas, base 14 px).
- Contraste: texto ≥ 4.5:1, componentes de UI ≥ 3:1, en ambos temas.
- El texto del estado siempre se muestra; el color nunca es el único portador de significado.
- Textos de UI solo desde `src/lib/i18n/es.ts`; no cambiar ninguna cadena existente.
- Alias de importación `@/…`; no añadir dependencias; sin `dangerouslySetInnerHTML`.
- Los tests existentes (393) deben seguir en verde; solo se ajustan los que consulten clases CSS concretas.
- Commits en español, estilo del repo (`feat(ui): …`), con el pie `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Estado de agencia desconocido/futuro (p. ej. un valor nuevo del backend): `AgencyStatusBadge` no debe romper; cae a tono `neutral` mostrando el texto (Task 2).
- Tema oscuro: ningún par texto/fondo de los tonos semánticos baja de 4.5:1 (Task 1, test de contraste).
- Título de página largo (razón social de 100+ caracteres) en `PageHeader`: se trunca/envuelve sin desbordar ni ocultar las acciones (Task 3).
- `DescriptionList` con valor vacío o `null`: muestra el marcador «sin dato» ya existente (`es.agencies.detail.none`), no una celda en blanco (Task 3).
- Navegación por teclado: el foco sigue visible en filas, enlaces y botones tras el rediseño (Task 4, test axe + foco).

---

### Task 1: Tokens, escala tipográfica y test de contraste

**Files:**
- Modify: `src/index.css`
- Create: `src/test/contrast.ts` (helper), `src/test/contrast.test.ts`

**Interfaces:**
- Produces (CSS vars, claro y `.dark`): `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--primary-hover`, y por cada tono `T` ∈ {`success`,`warning`,`danger`,`info`}: `--T`, `--T-foreground`, `--T-subtle`. Utilidades Tailwind resultantes: `bg-surface`, `bg-surface-raised`, `text-text-muted`, `bg-T`, `text-T`, `bg-T-subtle`, `text-T-foreground`.
- Produces (utilidades): `text-page-title` (20px/600, line-height 1.3), `text-section-title` (14px/600), `text-label` (12px/500, color `--text-muted`), `text-data` (14px/400, `font-variant-numeric: tabular-nums`).
- Produces (helper): `parseTokens(css: string): { light: Record<string,string>; dark: Record<string,string> }` (extrae `--name: oklch(L C H [/ A])` de los bloques `:root` y `.dark`), `contrastRatio(fg: string, bg: string): number` (oklch → sRGB lineal → luminancia WCAG).

- [ ] **Step 1: Write the failing test** `src/test/contrast.test.ts`: lee `src/index.css` con `node:fs`, usa `parseTokens` y, para `light` y `dark`, afirma `contrastRatio(a, b) >= min` en estos pares: `text/background`, `text/surface`, `text-muted/surface` (4.5); `primary-foreground/primary`, `primary-foreground/primary-hover` (4.5); para cada tono `T`: `T-foreground/T-subtle` (4.5) y `T/background` (3, uso como borde/icono); `border/background` (≥ 1.2, solo informativo: no se exige 3). Añadir dos pruebas del helper: `contrastRatio('oklch(1 0 0)','oklch(0 0 0)')` ≈ 21 (±0.1) y `contrastRatio` de un color consigo mismo = 1.
- [ ] **Step 2: Run** `pnpm vitest run src/test/contrast.test.ts` → FAIL (helper y tokens no existen).
- [ ] **Step 3: Implement** `src/test/contrast.ts` (oklch→oklab→sRGB lineal, luminancia WCAG 2.x; ignorar el canal alfa componiéndolo sobre el fondo si existe).
- [ ] **Step 4: Add tokens** en `src/index.css`. Valores iniciales (afinar hasta que el test pase; matiz de marca 255):
  - Claro: `--background: oklch(0.985 0.003 255)`, `--surface: oklch(1 0 0)`, `--surface-raised: oklch(1 0 0)`, `--text: oklch(0.21 0.02 255)`, `--text-muted: oklch(0.48 0.02 255)`, `--primary: oklch(0.45 0.15 255)`, `--primary-hover: oklch(0.40 0.15 255)`, `--primary-foreground: oklch(0.985 0 0)`, `--border: oklch(0.91 0.01 255)`; tonos: success `oklch(0.50 0.13 150)` / foreground `oklch(0.38 0.10 150)` / subtle `oklch(0.95 0.05 150)`; warning `oklch(0.60 0.13 75)` / `oklch(0.42 0.09 65)` / `oklch(0.96 0.06 85)`; danger `oklch(0.55 0.20 27)` / `oklch(0.45 0.18 27)` / `oklch(0.95 0.03 25)`; info `oklch(0.52 0.13 255)` / `oklch(0.42 0.12 255)` / `oklch(0.95 0.03 250)`.
  - Oscuro: `--background: oklch(0.17 0.015 255)`, `--surface: oklch(0.21 0.015 255)`, `--surface-raised: oklch(0.25 0.015 255)`, `--text: oklch(0.96 0.005 255)`, `--text-muted: oklch(0.72 0.02 255)`, `--primary: oklch(0.72 0.12 255)`, `--primary-hover: oklch(0.78 0.12 255)`, `--primary-foreground: oklch(0.20 0.02 255)`, `--border: oklch(1 0 0 / 12%)`; tonos: mismo matiz, `-subtle` `oklch(0.28 0.06 H)`, `-foreground` `oklch(0.85 0.10 H)`, base `oklch(0.70 0.14 H)` (H = 150, 75, 27, 255).
  - Remapear los tokens shadcn existentes a los nuevos (`--card: var(--surface)`, `--popover: var(--surface-raised)`, `--foreground: var(--text)`, `--muted-foreground: var(--text-muted)`, `--ring` derivado de `--primary`, `--destructive: var(--danger)`, `--sidebar*` sobre neutros fríos con `--sidebar-primary: var(--primary)`).
  - Registrar todo en `@theme inline` (`--color-surface`, `--color-surface-raised`, `--color-text-muted`, `--color-primary-hover`, `--color-<tono>`, `--color-<tono>-foreground`, `--color-<tono>-subtle`) y declarar las 4 `@utility` tipográficas. `html` pasa a `font-size` base legible y `body` mantiene `bg-background text-foreground`.
- [ ] **Step 5: Run** `pnpm vitest run src/test/contrast.test.ts` → PASS en ambos temas (ajustar L/C hasta cumplir). Luego `pnpm typecheck && pnpm lint && pnpm test` → todo verde.
- [ ] **Step 6: Commit** `feat(ui): tokens semánticos, escala tipográfica y prueba de contraste`.

### Task 2: StatusBadge por tono y AgencyStatusBadge

**Files:**
- Create: `src/components/shared/StatusBadge.tsx`, `src/components/shared/StatusBadge.test.tsx`
- Modify: `src/components/ui/badge.tsx`, `src/features/agencies/components/AgencyStatusBadge.tsx`; Test: `src/features/agencies/components/AgencyStatusBadge.test.tsx` (nuevo)

**Interfaces:**
- Consumes: tokens `bg-T-subtle`, `text-T-foreground` (Task 1).
- Produces: `type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'`; `Badge` gana `variant` por cada `Tone` (clases `bg-T-subtle text-T-foreground`, neutral = `bg-muted text-text-muted`) manteniendo las variantes existentes; `StatusBadge({ tone, children }: { tone: Tone; children: ReactNode })` renderiza `Badge` con un punto decorativo (`aria-hidden`) del color del tono; `AgencyStatusBadge({ status }: { status: AgencyStatus })` mapea estado→tono.

- [ ] **Step 1: Write failing tests.** `StatusBadge.test.tsx`: para cada tono, renderiza «Texto» y afirma que el texto es visible y que el `data-variant` del badge es el tono. `AgencyStatusBadge.test.tsx`: afirma `pending→warning`, `active→success`, `rejected→danger`, `changes_requested→info`, `suspended→danger`, `terminated→neutral`, y que muestra `es.agencies.status[status]`; y que `status="algo_nuevo" as never` renderiza tono `neutral` mostrando el valor crudo sin lanzar.
- [ ] **Step 2: Run** `pnpm vitest run src/components/shared/StatusBadge.test.tsx src/features/agencies/components/AgencyStatusBadge.test.tsx` → FAIL.
- [ ] **Step 3: Implement** los cambios en `badge.tsx` (nuevas variantes en el `cva`), `StatusBadge.tsx` y `AgencyStatusBadge.tsx` (`Record<AgencyStatus, Tone>` + fallback `neutral` y texto `es.agencies.status[status] ?? status`).
- [ ] **Step 4: Run** los tests anteriores + `pnpm test` → PASS (ajustar tests de agencias que busquen la variante antigua).
- [ ] **Step 5: Commit** `feat(ui): StatusBadge por tono y estados de agencia distinguibles`.

### Task 3: Primitivos PageHeader, Section y DescriptionList

**Files:**
- Create: `src/components/shared/PageHeader.tsx`, `Section.tsx`, `DescriptionList.tsx` y un `layout-primitives.test.tsx` común en el mismo directorio.

**Interfaces:**
- Consumes: utilidades `text-page-title`, `text-section-title`, `text-label`, `text-data` (Task 1).
- Produces:
  - `PageHeader({ title: string; description?: string; actions?: ReactNode; backLink?: ReactNode }): JSX.Element` — `<header>` con un único `<h1 class="text-page-title">`; las acciones a la derecha; el título usa `min-w-0 wrap-break-word`.
  - `Section({ title: string; children: ReactNode }): JSX.Element` — `<section aria-labelledby>` con `<h2 class="text-section-title">`.
  - `DescriptionList({ children }: { children: ReactNode })` y `DescriptionItem({ label, children }: { label: string; children: ReactNode })` — `<dl>` en rejilla `grid-cols-[10rem_1fr]`, `dt` con `text-label`, `dd` con `text-data`; si `children` es `null | undefined | ''` renderiza `es.agencies.detail.none`.

- [ ] **Step 1: Write failing tests** en `layout-primitives.test.tsx`: `PageHeader` expone un heading nivel 1 con el título, muestra descripción y acciones cuando se pasan, y con un título de 150 caracteres sigue exponiendo las acciones (botón presente); `Section` expone heading nivel 2 y la región se nombra por él (`getByRole('region', { name })`); `DescriptionList` asocia `term`/`definition` (`getByRole('term')`, `getByRole('definition')`), y con `null` muestra «sin dato» (`es.agencies.detail.none`).
- [ ] **Step 2: Run** `pnpm vitest run src/components/shared/layout-primitives.test.tsx` → FAIL.
- [ ] **Step 3: Implement** los tres archivos (usar `useId` para `aria-labelledby`).
- [ ] **Step 4: Run** el test → PASS; `pnpm lint` verde.
- [ ] **Step 5: Commit** `feat(ui): primitivos PageHeader, Section y DescriptionList`.

### Task 4: DataTable y estados vacío/error/sin permiso

**Files:**
- Modify: `src/components/shared/DataTable.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `ForbiddenState.tsx`, `src/components/ui/table.tsx`; Test: `DataTable.test.tsx`, `states.test.tsx`

**Interfaces:**
- Consumes: `text-label`, `text-data`, `text-section-title`, `bg-surface`, `bg-muted` (Task 1). La API pública de `DataTable` no cambia.

- [ ] **Step 1: Write failing tests** (añadir a los existentes): la cabecera de `DataTable` (`columnheader`) lleva la clase `text-label`; las celdas llevan `text-data`; el texto de `EmptyState`/`ErrorState`/`ForbiddenState` usa `text-section-title` en el título; `ErrorState` conserva `role="alert"` y botón de reintento; una fila con `onRowActivate` sigue exponiendo el enlace real de la primera columna (regresión de F3).
- [ ] **Step 2: Run** `pnpm vitest run src/components/shared` → FAIL en las nuevas aserciones.
- [ ] **Step 3: Implement**: cabecera sobre `bg-muted/50` con borde inferior, filas con `hover:bg-muted/50` y transición, `focus-within` visible en la fila, `py-1.5` conservado (densidad), contenedor de la tabla con `rounded-lg border bg-surface`; estados centrados con título `text-section-title`, texto `text-data text-text-muted`.
- [ ] **Step 4: Run** `pnpm vitest run src/components/shared && pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(ui): DataTable y estados con la jerarquía del sistema visual`.

### Task 5: Listado, detalle y ReviewDialog de agencias

**Files:**
- Modify: `src/features/agencies/screens/AgenciesListScreen.tsx`, `AgencyDetailScreen.tsx`, `src/features/agencies/components/AgencyDetailCard.tsx`, `ReviewDialog.tsx`, `src/components/ui/dialog.tsx` (solo superficie/espaciado); Tests: `AgenciesListScreen.test.tsx`, `AgencyDetailScreen.test.tsx`, `ReviewDialog.test.tsx`, `src/features/agencies/a11y.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Section`, `DescriptionList`/`DescriptionItem` (Task 3), `AgencyStatusBadge` (Task 2).

- [ ] **Step 1: Write failing tests**: el listado tiene un único `heading` nivel 1 con `es.agencies.list.title` (vía `PageHeader`) y el selector de filtro sigue accesible por su etiqueta; el detalle expone `h1` con el nombre comercial, las secciones `region` por nombre (`es.agencies.detail.sections.*`), y `term`/`definition` para los campos; el campo `email: null` muestra `es.agencies.detail.none`; el botón «Rechazar» sigue siendo destructivo y el diálogo de revisión conserva su comportamiento (abrir, motivo obligatorio, confirmar). La prueba axe de `a11y.test.tsx` sigue sin violaciones.
- [ ] **Step 2: Run** `pnpm vitest run src/features/agencies` → FAIL en las nuevas aserciones.
- [ ] **Step 3: Implement**: reemplazar `h1`/`Section`/`Field` locales por los primitivos (eliminar los locales de `AgencyDetailCard`); filtro del listado en `actions` del `PageHeader`; enlace «volver» como `backLink`; `ReviewDialog`: título `text-section-title`, motivo con `Field` existente, aviso de acción irreversible con `Alert` en tono `warning` (añadir variante `warning`/`info` a `alert.tsx` si no existe), botón de confirmar `destructive` solo para rechazar.
- [ ] **Step 4: Run** `pnpm vitest run src/features/agencies && pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(agencias): listado, detalle y diálogo con el sistema visual`.

### Task 6: Shell (sidebar, cabecera, menú de usuario)

**Files:**
- Modify: `src/app/shell/AppShell.tsx`, `AppSidebar.tsx`, `UserMenu.tsx`, `src/components/ui/sidebar.tsx` (solo si el ítem activo no usa `--sidebar-primary`); Tests: `AppShell.test.tsx`, `a11y.test.tsx` (shell)

**Interfaces:**
- Consumes: tokens `--sidebar-*` remapeados (Task 1), `bg-surface`.

- [ ] **Step 1: Write failing tests**: el ítem de navegación activo conserva `aria-current="page"` y `data-active="true"`; la cabecera es un `banner` con el botón de menú, el conmutador de tema y el menú de usuario accesibles por nombre; el contenido principal sigue dentro de `main`; axe sin violaciones con tema claro y con la clase `dark` aplicada a `document.documentElement`.
- [ ] **Step 2: Run** `pnpm vitest run src/app/shell` → FAIL en las aserciones nuevas (p. ej. `banner`/tema oscuro).
- [ ] **Step 3: Implement**: cabecera `bg-surface border-b`, ítem activo con fondo `sidebar-primary` y texto `sidebar-primary-foreground`, ítems con foco visible, etiqueta del usuario con `text-data`/`text-label`; sin cambios de comportamiento ni de rutas.
- [ ] **Step 4: Run** `pnpm vitest run src/app && pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(shell): superficies, ítem activo y cabecera con el sistema visual`.

### Task 7: Guía de uso, roadmap y verificación visual

**Files:**
- Create: `docs/superpowers/adr/0006-sistema-visual.md`
- Modify: `docs/superpowers/specs/2026-10-31-roadmap-frontend-design.md` (F3.5 → ✅), `README.md` (enlace a la guía si hay sección de docs)

- [ ] **Step 1: Write ADR-0006**: estado «aceptado»; reglas para F4–F6 (cuándo usar cada nivel tipográfico, cada tono, qué primitivo usar para encabezado/sección/datos, cómo añadir un tono nuevo y que el test de contraste debe cubrirlo).
- [ ] **Step 2: Verificación completa**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → todo verde; revisar tamaño del JS inicial gzip (≤ 200 kB).
- [ ] **Step 3: e2e**: ejecutar los Playwright existentes (`docker-compose.e2e.yml`, ver README) → verdes.
- [ ] **Step 4: Revisión visual** (skill `run` + capturas con el navegador integrado): listado, detalle, diálogo de revisión, estados vacío/error/sin permiso y shell, en claro y oscuro; confirmar que los 6 estados se distinguen por texto además del color; pasar el pre-flight de `design-taste-frontend` y corregir lo que falle (volver a la tarea dueña).
- [ ] **Step 5: Commit** `docs(f3.5): ADR-0006 del sistema visual y roadmap`.
