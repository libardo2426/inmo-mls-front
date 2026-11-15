# F5a — Inmuebles en solo lectura (listado y ficha) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Listado `/inmuebles` con filtros en la URL y ficha `/inmuebles/$propertyId`, solo lectura, para admin y compliance del MLS.

**Architecture:** Feature nueva `src/features/properties/` (api → hooks → pantallas) siguiendo agencias y miembros. El listado usa un esquema Zod a mano (B-11) aislado en un archivo; la ficha usa el esquema generado. Una consulta única de agencias alimenta el selector, la columna y el historial.

**Tech Stack:** React 19, TypeScript strict, TanStack Router/Query (rutas por archivo), Zod, shadcn, Vitest + Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-11-15-fase-05a-inmuebles-lectura-design.md`

## Global Constraints

- Permisos por `can()`/`assertCan` con `property.read` y alcance `network`; nunca por rol.
- Ruta `/inmuebles`, claves de URL `type`, `status`, `territory`, `agency`; valores inválidos se descartan (`type` solo si está en `apartment|house|lot|retail|office|warehouse|farm`; `status` solo en `draft|active|reserved|closed|suspended|withdrawn|expired`; `agency` solo UUID; `territory` no vacío).
- Listado: `limit=50`, cursor, «Cargar más», solo tabla; columna y filtro rotulados «Agencia editora» (`editorAgencyId`).
- Agencias: una consulta `GET /v1/agencies?limit=100` sin `status`; el selector muestra solo `active` (filtrado en cliente). Su fallo no bloquea el listado.
- Importes: `amountMinor` (string) ÷ 100 con `BigInt` y 2 decimales fijos (`MINOR_UNIT_DECIMALS = 2`), formato `es-CO` con `currency`; nunca los decimales de `Intl`, nunca `Number`.
- Ficha: se omiten `media`, coordenadas, `visitInstructions`, `memberNotes`; 404 y sin permiso como estados dentro de la página.
- Estado o tipo desconocido: tono `neutral` y valor crudo. UI es-CO (`src/lib/i18n/es.ts`), tokens sin colores sueltos, modo oscuro, estados de carga/vacío/error/sin permiso.
- TDD. Commits en rama `fase-05a-inmuebles-lectura` (desde `fase-04-miembros`, donde ya está integrado F3.6); sin push ni merge sin aprobación.

## Review Focus

- Precio `35000000000` COP se muestra como `$ 350.000.000,00` (no 100× mayor) y un importe de 18 dígitos no pierde precisión.
- `?type=raro`, `?status=raro`, `?agency=no-uuid` se descartan y no llegan al backend.
- Fila cuya agencia no está en la lista (o si `/v1/agencies` falla): texto neutro, el listado sigue; el selector queda deshabilitado.
- Inmueble con `status` o `propertyType` desconocidos: etiqueta cruda en neutro, sin romper.
- Ficha con `history` cuyo `oldValue`/`newValue` es `null`, string u objeto no reconocido: no muestra `[object Object]`.

---

### Task 0: Rama

- [ ] **Step 1:** `git switch -c fase-05a-inmuebles-lectura` (desde `fase-04-miembros`).
- [ ] **Step 2:** Run `pnpm test` — Expected: todo en verde (525).

### Task 1: Esquemas, fixtures y utilidades puras

**Files:**
- Create: `src/features/properties/api/property-list-schema.ts` (comentario `B-11`), `src/features/properties/model.ts`, `src/features/properties/format-money.ts`
- Modify: `src/lib/api/schemas.ts`, `src/test/fixtures.ts`
- Test: `src/features/properties/api/property-list-schema.test.ts`, `src/features/properties/model.test.ts`, `src/features/properties/format-money.test.ts`

**Interfaces:**
- Produces:
  - `property-list-schema.ts`: `propertyListItemSchema` (`id`, `uniqueIdentifier`, `propertyType`, `status`, `territorialUnitCode`, `address`, `editorAgencyId` nullable, `createdAt` — todos string salvo nullables; `status` y `propertyType` como `z.string()`), `propertyPageSchema = z.object({ items: z.array(propertyListItemSchema), nextCursor: z.string().nullable() })`, tipos `PropertyListItem`, `PropertyPage`.
  - `schemas.ts`: `export type Property = PropertyDetailResponse` (alias) si hace falta; reexporta tipos de historial/encargo derivados con `PropertyDetailResponse['history'][number]`, etc.
  - `fixtures.ts`: `propertyListItemFixture(overrides)` y `propertyDetailFixture(overrides)` válidos contra los esquemas (detalle con 1 precio, 1 encargo, 2 entradas de historial, 1 documento, `media` vacía, `allowedActions` todo `false`).
  - `model.ts`: `PROPERTY_TYPES` (7 códigos), `PROPERTY_STATUSES` (7), `type PropertyFilters = { type?: string; status?: string; territory?: string; agency?: string }`, `parsePropertyFilters(search: Record<string, unknown>): PropertyFilters` (descarta inválidos), `statusTone: Record<known status, Tone>` + `propertyStatusTone(status: string): Tone` (desconocido ⇒ `neutral`; propuesta: `active: success`, `draft: neutral`, `reserved: info`, `closed: neutral`, `suspended: danger`, `withdrawn: warning`, `expired: warning`).
  - `format-money.ts`: `MINOR_UNIT_DECIMALS = 2`, `formatMinorAmount(amountMinor: string, currency: string): string`.

- [ ] **Step 1: Write the failing tests.** Esquema: ítem válido pasa; `editorAgencyId: null` pasa; falta `id` falla; `status: 'raro'` pasa (se tolera). Filtros: `parsePropertyFilters({type:'house', status:'active', agency:'0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c', territory:'05001'})` devuelve los cuatro; `{type:'raro', status:'raro', agency:'x', territory:''}` devuelve `{}`. Tono: `propertyStatusTone('active')==='success'`, `('raro')==='neutral'`. Dinero: `formatMinorAmount('35000000000','COP')` contiene `350.000.000,00`; `'5'` ⇒ `0,05`; `'999999999999999999'` conserva todos los dígitos; entrada no numérica devuelve el texto original sin lanzar.
- [ ] **Step 2:** Run `pnpm vitest run src/features/properties` — Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implement** los archivos de Interfaces. `formatMinorAmount` separa enteros y decimales con `BigInt` y formatea la parte entera con `Intl.NumberFormat('es-CO')` según la moneda.
- [ ] **Step 4:** Run `pnpm vitest run src/features/properties` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(inmuebles): esquema del listado, filtros y formato de importes`.

### Task 2: Cliente y hooks

**Files:**
- Create: `src/features/properties/api/properties-api.ts`, `src/features/properties/api/keys.ts`, `src/features/properties/hooks/usePropertiesApi.ts`, `src/features/properties/hooks/useProperties.ts`, `src/features/properties/hooks/useProperty.ts`, `src/features/properties/hooks/useAgencyDirectory.ts`
- Test: `src/features/properties/api/properties-api.test.ts` (modelo: `agencies-api.test.ts`)

**Interfaces:**
- Consumes: `PropertyFilters`, `propertyPageSchema` (T1); `propertyDetailResponseSchema`.
- Produces:
  - `PropertiesApi = { list(input: PropertyFilters & { limit?: number; cursor?: string; signal?: AbortSignal }): Promise<PropertyPage>; get(id: string, signal?: AbortSignal): Promise<PropertyDetailResponse> }` y `createPropertiesApi(http)`; mapea `type→propertyType`, `territory→territorialUnitCode`, `agency→agencyId`, `status→status`; omite los `undefined`.
  - `propertyKeys = { all: ['properties'] as const, list: (f: PropertyFilters) => ['properties','list', f] as const, detail: (id: string) => ['properties','detail', id] as const }`.
  - `useProperties(filters: PropertyFilters)` (`useInfiniteQuery`, `limit` 50, cursor), `useProperty(id: string)` (`useQuery`).
  - `useAgencyDirectory(): { agencies: AgencySummary[]; byId: Map<string, string>; isError: boolean; isPending: boolean }` — consulta `GET /v1/agencies?limit=100` sin `status` (reutiliza `useAgenciesApi().list`), clave propia `['agencies','directory']`; `byId` mapea `id → tradeName`.

- [ ] **Step 1: Write the failing test.** `list({type:'house', status:'active', territory:'05001', agency:'<uuid>', limit:50, cursor:'c1'})` pide `/v1/properties` con `propertyType`, `status`, `territorialUnitCode`, `agencyId`, `limit`, `cursor` y no envía los ausentes; respuesta inválida lanza `ValidationError`; `get('p1')` pide `/v1/properties/p1` y parsea con el esquema generado.
- [ ] **Step 2:** Run `pnpm vitest run src/features/properties/api/properties-api.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces (calcar `createAgenciesApi` y `useAgencies`).
- [ ] **Step 4:** Run el mismo test — Expected: PASS.
- [ ] **Step 5: Commit** `feat(inmuebles): cliente, claves y hooks`.

### Task 3: Textos y listado

**Files:**
- Create: `src/features/properties/components/PropertyStatusBadge.tsx`, `src/features/properties/components/PropertyFiltersBar.tsx`, `src/features/properties/screens/PropertiesListScreen.tsx`, `src/routes/_protegido/inmuebles/index.tsx`
- Modify: `src/lib/i18n/es.ts` (bloque `properties` y `nav.properties: 'Inmuebles'`), `src/config/navigation.ts`, `src/routeTree.gen.ts` (regenerado por la herramienta de rutas al ejecutar `pnpm dev`/`vite build`; no editar a mano)
- Test: `src/features/properties/screens/PropertiesListScreen.test.tsx`, `src/config/navigation.test.ts` (si existe; si no, en el test del shell)

**Interfaces:**
- Consumes: `useProperties`, `useAgencyDirectory`, `parsePropertyFilters`, `propertyStatusTone`, `PROPERTY_TYPES`, `PROPERTY_STATUSES`, `useTerritoryName` de `@/lib/territory/useTerritoryName`, `DataTable`, `PageHeader`.
- Produces: `PropertiesListScreen({ filters }: { filters: PropertyFilters })`; `PropertyStatusBadge({ status }: { status: string })`; `PropertyFiltersBar({ filters, agencies }: { filters: PropertyFilters; agencies: AgencySummary[] | null })` — cuatro controles con etiqueta (`type`, `status`, `territory` como campo de código municipal, `agency` selector «Agencia editora» deshabilitado si `agencies` es `null`); cada cambio navega a `/inmuebles` con el nuevo `search` y vacía el valor para quitar el filtro. Ruta con `validateSearch: parsePropertyFilters` y `beforeLoad: assertCan(context.me, 'property.read', 'network')`. Nav: `{ to: '/inmuebles', label: es.nav.properties, icon: House o Building, permission: 'property.read', minScope: 'network' }` (icono lucide `Home`/`Building`, a elección).
- Columnas: identificador (enlace a la ficha), tipo (etiqueta traducida o cruda), estado (`PropertyStatusBadge`), territorio (`useTerritoryName`), dirección, agencia editora (nombre del directorio o `es.properties.unknownAgency`), creado (`formatDate` de `@/lib/format`).

- [ ] **Step 1: Write the failing tests** (patrón `AgenciesListScreen.test.tsx`): (a) lista una fila con sus celdas y el enlace a `/inmuebles/{id}`; (b) abre sin filtros, `limit=50`; (c) `?type=raro&status=raro&agency=x` no envía esos parámetros; (d) elegir tipo/estado/agencia en los controles cambia la URL y la petición; (e) «Cargar más» pide con `cursor`; (f) agencia sin coincidencia ⇒ texto neutro; con `/v1/agencies` en 500 el listado sigue y el selector está deshabilitado; (g) estados de carga, vacío, error con reintento; (h) sin `property.read` la ruta muestra sin acceso y el menú no tiene «Inmuebles»; (i) estado y tipo desconocidos muestran el valor crudo.
- [ ] **Step 2:** Run `pnpm vitest run src/features/properties/screens src/app/shell` — Expected: FAIL.
- [ ] **Step 3: Implement** textos, componentes, pantalla, ruta y menú. Ejecutar `pnpm exec vite build` (o `pnpm dev` unos segundos) para regenerar `routeTree.gen.ts` y confirmar el cambio en el diff.
- [ ] **Step 4:** Run `pnpm vitest run src/features/properties src/app/shell && pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(inmuebles): listado con filtros en la URL y menú`.

### Task 4: Ficha del inmueble

**Files:**
- Create: `src/features/properties/screens/PropertyDetailScreen.tsx`, `src/features/properties/components/PropertySections.tsx` (o un archivo por sección si crece), `src/routes/_protegido/inmuebles/$propertyId.tsx`
- Modify: `src/lib/i18n/es.ts` (textos de la ficha)
- Test: `src/features/properties/screens/PropertyDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `useProperty`, `useAgencyDirectory`, `formatMinorAmount`, `useTerritoryName`, `Section`, `DescriptionList`, `PageHeader`, `EmptyState`, `ErrorState`, `ForbiddenState`.
- Produces: `PropertyDetailScreen({ propertyId, filters }: { propertyId: string; filters: PropertyFilters })` (los filtros viajan en el enlace «Volver» para conservar el listado). Secciones con `Section`: **Datos** (identificador y su estado, tipo, estado, dirección + nombre de territorio, nota si `addressVisibility` no es total, áreas con `areaUnit`, descripción, `features`, `attributes` como lista clave-valor, editor), **Precios de lista** (operación + `formatMinorAmount`), **Encargos** (agencia por nombre o texto neutro, operación, tipo, fechas es-CO, estado, activo), **Historial** (campo traducido, anterior → nuevo con formateo por campo y fallback a texto seguro, agencia por nombre, fecha), **Documentos** (nombre, tipo, visibilidad, tamaño, fecha; sin enlace de descarga). Estados: carga (esqueleto), 404 `property_not_found` ⇒ `EmptyState`, 403 ⇒ `ForbiddenState`, otro error ⇒ `ErrorState` con reintento. Sin `media`, coordenadas, `visitInstructions`, `memberNotes` ni `privateTerms`.
- Ruta: `/inmuebles/$propertyId` con el mismo `validateSearch` y `assertCan`.

- [ ] **Step 1: Write the failing tests:** (a) con `propertyDetailFixture` muestra cada sección con sus datos y el precio `350.000.000,00`; (b) historial: entrada `list_price` con objeto `amountMinor`, `status` con código traducido, `editor` con `{id,name}`, y valores `null` o desconocidos sin `[object Object]`; (c) `visitInstructions`, `memberNotes`, `privateTerms` y coordenadas no aparecen en el DOM aunque vengan en la respuesta; (d) encargo con agencia ausente del directorio ⇒ texto neutro; (e) 404 ⇒ estado «no existe», 500 ⇒ error con reintento que vuelve a pedir, 403 ⇒ sin acceso; (f) el enlace «Volver» conserva los filtros en la URL; (g) a11y: un único `h1`, secciones como regiones con nombre.
- [ ] **Step 2:** Run `pnpm vitest run src/features/properties/screens/PropertyDetailScreen.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** pantalla, secciones y ruta; formateo del historial en una función pura `formatHistoryValue(field: string, value: unknown, ctx)` con su propio test (casos de (b)).
- [ ] **Step 4:** Run `pnpm vitest run src/features/properties && pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(inmuebles): ficha del inmueble en solo lectura`.

### Task 5: Verificación final

- [ ] **Step 1:** Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` — Expected: todo en verde; si `format:check` falla, `pnpm format` y revisar el diff.
- [ ] **Step 2:** Confirmar que `routeTree.gen.ts` está actualizado y commiteado.
- [ ] **Step 3:** Revisión visual en `pnpm dev` (claro/oscuro, menú plegado) o declarar explícitamente que no se hizo.
- [ ] **Step 4:** Dejar la rama sin push ni merge.

## Self-review

- Cobertura del spec: filtros y URL (T1+T3), selector y columna de agencias con fallo aislado (T2+T3), ficha con alcance recortado (T4), precios en centavos (T1), historial robusto (T4), nombres de territorio (T3+T4), menú y permisos (T3), B-11 aislado (T1).
- Consistencia: `PropertyFilters`, `parsePropertyFilters`, `useAgencyDirectory`, `formatMinorAmount`, `propertyStatusTone` y `PropertyStatusBadge` se nombran igual en todas las tareas.
- Proporción: cinco tareas con tests por comportamiento; los cuerpos los escribe quien ejecuta.
