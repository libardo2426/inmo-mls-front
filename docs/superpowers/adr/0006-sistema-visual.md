# ADR-0006 — Sistema visual

- **Estado:** Aceptado (F3.5)
- **Fecha:** 2026-11-02

## Contexto

Tras F0–F3 el panel usaba los grises por defecto de shadcn, un solo color (destructivo), un mapeo pobre de estados a variantes de `Badge` y tamaños de texto ad hoc. F4–F6 necesitan reglas claras para no repetir el problema.

## Decisión

1. **Tokens semánticos en `src/index.css`**, con tema claro (`:root`) y oscuro (`.dark`): `background`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `primary` (+ `primary-hover`, `primary-foreground`) y, por tono, `success`, `warning`, `danger`, `info` con `-foreground` y `-subtle`. Los tokens de shadcn (`card`, `popover`, `muted-foreground`, `destructive`, `sidebar-*`) se derivan de estos. **No se escriben colores sueltos en componentes.**
2. **Cuatro niveles tipográficos** (utilidades Tailwind con prefijo `type-`, no `text-`: el helper `cn` trataría `text-label` o `text-data` como color y los borraría ante una clase `text-*` posterior):
   - `type-page-title`: un único `h1` por pantalla.
   - `type-section-title`: títulos de sección, de estado (vacío/error/sin permiso) y de diálogo.
   - `type-label`: etiquetas y cabeceras de tabla (color atenuado).
   - `type-data`: valores y celdas (cifras tabulares).
3. **Primitivos** en `components/shared`: `PageHeader` (título, descripción, acciones, enlace de regreso), `Section`, `DescriptionList`/`DescriptionItem` (sin valor muestra «No informado») y `StatusBadge` (por `Tone`). Una pantalla nueva compone estos antes de crear marcado propio.
4. **Estados con tono, siempre con texto.** El color nunca es el único portador de significado. Un estado nuevo del backend cae a `neutral` mostrando su valor.
5. **Contraste verificado:** `src/test/contrast.test.ts` exige ≥ 4.5:1 en texto y ≥ 3:1 en color de tono sobre fondo, en ambos temas. Un tono o par nuevo se añade a ese test en el mismo cambio.

## Cómo añadir

- **Un tono:** definir `--T`, `--T-foreground`, `--T-subtle` en ambos temas, registrarlos en `@theme inline`, añadirlo a `Tone`, a `badge.tsx` y al test de contraste.
- **Un estado de dominio:** un `Record<Estado, Tone>` junto a su feature (ver `AgencyStatusBadge`).

## Consecuencias

- Cambiar la marca es editar `primary` y los neutros en un solo lugar.
- `PageHeader` es un `div`, no `header`, para no duplicar el landmark `banner` del shell.
- La verificación formal de accesibilidad y la revisión visual final quedan en F9.

## Ajuste de marca (flyer de referencia)

La paleta se alineó con el flyer de Viviendata: `primary` verde (`oklch(0.5 0.085 159)`, ≈ `#3D7A5A`), menú lateral en carbón, fondo gris claro con superficies blancas, radio de 0.75 rem, tipografía Lato (400/700/900) y títulos en negrita con el subtítulo en verde (`PageHeader`). El test de contraste cubre también los pares del menú lateral y el verde como texto.
