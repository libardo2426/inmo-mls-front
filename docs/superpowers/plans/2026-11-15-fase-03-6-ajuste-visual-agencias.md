# F3.6 — Ajuste visual del shell y de agencias · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar la paleta de marca (tonos `leaf` y `sand`), el logo provisional y pestañas de estado al panel ya construido, sin cambiar comportamiento.

**Architecture:** Cambio aditivo sobre el sistema visual de ADR-0006: tokens nuevos en `src/index.css` verificados por `contrast.test.ts`, un componente `BrandMark` aislado, y el `<select>` de estado de agencias reemplazado por pestañas Radix (shadcn `tabs`) que siguen escribiendo `?status=` en la URL.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, shadcn (radix-nova), TanStack Router/Query, Vitest + Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-11-15-fase-03-6-ajuste-visual-agencias-design.md`

## Global Constraints

- El `--accent` existente de shadcn **no se toca**; los tonos nuevos se llaman `leaf` y `sand`.
- Sin hex ni colores sueltos en componentes: solo tokens (`bg-leaf`, `fill-leaf`, etc.).
- Cada token nuevo lleva par oscuro y fila en `src/test/contrast.test.ts` en el mismo cambio. `parseTokens` solo lee valores literales `oklch(...)` (no `var()`), así que los tokens nuevos y `--sidebar-primary*` deben ser literales.
- Solo tabla en agencias; sin contadores, sin buscador, sin planes ni membresías.
- Permisos por `can()`, UI en `es-CO`, sin `dangerouslySetInnerHTML`.
- Sin commit de código sin aprobación del flujo: commits en rama `fase-03-6-ajuste-visual`, nada de push ni merge sin aprobación.
- Valores base de marca (spec): hoja `#9BB96D`, arena `#DEC9B7`.

## Review Focus

- Modo oscuro: `leaf`/`sand` deben pasar AA también en `.dark` (test de contraste en ambos temas).
- `?status=basura` o ausente sigue cayendo a `pending` con las pestañas (la pestaña activa es `pending`).
- Teclado: flechas mueven entre pestañas y la URL cambia; el panel de la tabla queda asociado a la pestaña activa.
- Menú plegado a iconos: el logo no desborda ni se pierde el nombre accesible del enlace de inicio.
- Un estado desconocido del backend en `StatusBadge` sigue cayendo a `neutral` (no se toca; solo regresión).

---

### Task 0: Rama de trabajo

- [ ] **Step 1:** Estando en `master` con árbol limpio salvo `pnpm-lock.yaml` y los archivos de docs sin commitear, ejecutar `git switch -c fase-03-6-ajuste-visual`.
- [ ] **Step 2:** Run `pnpm test` — Expected: todo en verde (línea base antes de cambiar nada).

### Task 1: Tokens `leaf` y `sand`

**Files:**
- Modify: `src/index.css` (bloque `@theme inline`, `:root`, `.dark`)
- Test: `src/test/contrast.test.ts`

**Interfaces:**
- Produces: tokens CSS `--leaf`, `--leaf-foreground`, `--sand`, `--sand-foreground` en ambos temas y utilidades Tailwind `bg-leaf`, `text-leaf-foreground`, `fill-leaf`, `bg-sand`, `text-sand-foreground`. `--sidebar-primary` y `--sidebar-primary-foreground` pasan a ser los valores de `leaf` / `leaf-foreground` (literales).

- [ ] **Step 1: Write the failing test.** En `contrast.test.ts` añadir a `pairs`: `['leaf-foreground','leaf',4.5]`, `['sand-foreground','sand',4.5]`, `['leaf','sidebar',3]`. (Las filas existentes `sidebar-primary-foreground`/`sidebar-primary` siguen cubriendo el ítem activo.)
- [ ] **Step 2:** Run `pnpm vitest run src/test/contrast.test.ts` — Expected: FAIL con «falta --leaf» y «falta --sand» en ambos temas.
- [ ] **Step 3: Implement** en `src/index.css`: definir en `:root` y `.dark` los cuatro tokens con `oklch` literal. Claro: `leaf` ≈ `oklch(0.75 0.1 125)` (hoja), `leaf-foreground` carbón oscuro (`oklch(0.22 0.006 160)`), `sand` ≈ `oklch(0.86 0.04 70)`, `sand-foreground` carbón. Oscuro: `leaf` igual de claro, `leaf-foreground` oscuro; `sand` superficie cálida oscura (`oklch(0.3 0.02 70)`) con `sand-foreground` claro. Registrar los cuatro en `@theme inline` como `--color-leaf`, `--color-leaf-foreground`, `--color-sand`, `--color-sand-foreground`. Reemplazar `--sidebar-primary`/`--sidebar-primary-foreground` en ambos temas por los mismos literales de `leaf`/`leaf-foreground`. Ajustar L/C hasta que el test pase.
- [ ] **Step 4:** Run `pnpm vitest run src/test/contrast.test.ts` — Expected: PASS en claro y oscuro.
- [ ] **Step 5: Commit** `git add src/index.css src/test/contrast.test.ts && git commit -m "feat(ui): tonos leaf y sand con contraste verificado"` (más la línea Co-Authored-By de la sesión).

### Task 2: `BrandMark` y cabecera del menú

**Files:**
- Create: `src/components/shared/BrandMark.tsx`, `src/components/shared/BrandMark.test.tsx`
- Modify: `src/app/shell/AppSidebar.tsx`
- Test: `src/app/shell/AppShell.test.tsx` (aserción nueva)

**Interfaces:**
- Produces: `export function BrandMark({ className }: { className?: string }): JSX.Element` — SVG `viewBox="0 0 100 76"`, decorativo (`aria-hidden`), cuerpo con `fill="currentColor"` y punto con clase `fill-leaf`. Provisional: path tomado de `#i-logo` en `docs/superpowers/design-refs/2026-11-15-vistas-admin/06-inmobiliarias.html`; es el único archivo a reemplazar cuando llegue el SVG definitivo.

- [ ] **Step 1: Write the failing tests.** `BrandMark.test.tsx`: renderiza y `container.querySelector('svg')` tiene `aria-hidden="true"` y `viewBox="0 0 100 76"`; contiene un `circle` con clase `fill-leaf`. En `AppShell.test.tsx` añadir: el menú contiene el nombre `es.app.name` y un `svg[aria-hidden]` en la cabecera del sidebar.
- [ ] **Step 2:** Run `pnpm vitest run src/components/shared/BrandMark.test.tsx src/app/shell/AppShell.test.tsx` — Expected: FAIL (módulo inexistente / sin svg).
- [ ] **Step 3: Implement** `BrandMark` con el path de la maqueta (`fill-rule="evenodd"`). En `AppSidebar` reemplazar el `<span>` de la cabecera por un contenedor flex con `<BrandMark className="size-7 shrink-0" />` y el nombre (`type-section-title`), este último oculto con `group-data-[collapsible=icon]:hidden`. El ítem activo ya usa `data-active:bg-sidebar-primary`, que tras la Task 1 es `leaf`; no se toca `useSidebarPreference`.
- [ ] **Step 4:** Run los mismos tests más `pnpm vitest run src/app/shell` — Expected: PASS (incluye a11y del shell).
- [ ] **Step 5: Commit** `feat(shell): logo provisional y marca en la cabecera del menú`.

### Task 3: Pestañas de estado en agencias

**Files:**
- Create: `src/components/ui/tabs.tsx` (vía `pnpm dlx shadcn@latest add tabs`; no editar a mano salvo estilos con tokens)
- Modify: `src/features/agencies/screens/AgenciesListScreen.tsx`, `src/features/agencies/screens/AgenciesListScreen.test.tsx`

**Interfaces:**
- Consumes: `STATUS_FILTERS`, `StatusFilter` de `../hooks/useAgencies`; `es.agencies.list.filterLabel` (nombre accesible del `tablist`), `es.agencies.status[...]`, `es.agencies.list.filterAll`.
- Produces: en la pantalla, `<Tabs value={filter} onValueChange={...}>` con un `TabsTrigger` por entrada de `STATUS_FILTERS` (mismo orden, `all` al final) y la `DataTable` dentro de `TabsContent value={filter}`. Al cambiar: `navigate({ to: '/agencias', search: { status } })`. Se elimina el `<select>`.

- [ ] **Step 1: Write the failing tests** (reemplazan los del combobox en `AgenciesListScreen.test.tsx`): (a) `getByRole('tablist', { name: es.agencies.list.filterLabel })` visible y `getAllByRole('tab')` de longitud `STATUS_FILTERS.length`; (b) con `/agencias` la pestaña `pending` tiene `aria-selected="true"`; (c) con `?status=basura` también `pending`; (d) clic en la pestaña «Todos» → `history.location.search` contiene `status=all` y la última petición no lleva `status`; (e) con foco en una pestaña, `userEvent.keyboard('{ArrowRight}')` mueve la selección a la siguiente y actualiza la URL; (f) el `tabpanel` activo contiene la tabla `es.agencies.list.caption`; (g) ninguna pestaña muestra contadores (texto de cada `tab` es solo la etiqueta). Mantener intactos los tests de columnas, carga, error y «Cargar más».
- [ ] **Step 2:** Run `pnpm vitest run src/features/agencies/screens/AgenciesListScreen.test.tsx` — Expected: FAIL (no hay `tablist`).
- [ ] **Step 3: Implement.** Añadir `tabs` con shadcn CLI. Pestañas con activación manual desactivada (activación por flecha, `activationMode="automatic"`, por defecto). Estilo del `TabsTrigger` activo: borde inferior en `primary` y texto `primary`; sin colores sueltos. Conservar `PageHeader`, `Alert` de aviso de revisión, `filterLabel(filter)` para las etiquetas y el resto de props de `DataTable` sin cambio.
- [ ] **Step 4:** Run `pnpm vitest run src/features/agencies` — Expected: PASS (incluye `a11y.test.tsx` y detalle de agencia: el enlace conserva `search={{ status: filter }}`).
- [ ] **Step 5: Commit** `feat(agencias): pestañas de estado sobre el filtro de la URL`.

### Task 4: Verificación y revisión final

- [ ] **Step 1:** Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` — Expected: todo en verde. Si `format:check` falla, `pnpm format` y revisar el diff.
- [ ] **Step 2:** Revisar a mano en `pnpm dev`, tema claro y oscuro, menú expandido y plegado: logo visible, ítem activo en hoja, pestañas legibles, foco visible por teclado. Anotar resultado.
- [ ] **Step 3:** Run `git diff master --stat` y confirmar que no hay cambios fuera de los archivos listados (salvo docs).
- [ ] **Step 4:** Dejar la rama sin push ni merge; reportar a quien aprueba para decidir integración (`finishing-a-development-branch`).

## Self-review

- Cobertura del spec: tokens (T1), logo provisional aislado (T2), ítem activo `leaf` (T1+T2), pestañas por `?status=` sin contadores (T3), no objetivos respetados (sin tarjetas, buscador, contadores). Verificación del spec cubierta en T4.
- Consistencia: `BrandMark`, `leaf`, `sand`, `STATUS_FILTERS` y `filterLabel` se nombran igual en todas las tareas.
- Nota: `sand` queda definido y verificado pero aún sin uso en componentes; lo consumirán F4/F5 (avatares, superficies cálidas). Es un compromiso explícito del spec.
