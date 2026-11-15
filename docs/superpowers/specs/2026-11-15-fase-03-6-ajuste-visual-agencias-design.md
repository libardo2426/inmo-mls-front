# F3.6 — Ajuste visual del shell y de agencias (diseño corto)

- **Fecha:** 2026-11-15
- **Estado:** pendiente de aprobación
- **Origen:** `docs/superpowers/prompts/2026-11-15-vistas-admin-diseno-visual.md` y maquetas en `docs/superpowers/design-refs/2026-11-15-vistas-admin/` (`06-inmobiliarias.html`)
- **Contexto:** primera de tres entregas (F3.6 → F4 miembros → F5 inmuebles, un spec y un plan por fase). Panel, Nueva propiedad y Solicitudes quedan fuera: el backend no los soporta.

## Intención

Llevar al panel ya construido la dirección visual de la marca (paleta del flyer, logo, pestañas por estado) sin cambiar comportamiento ni inventar datos.

## Objetivos

1. **Tokens nuevos**, siguiendo el procedimiento «cómo añadir un tono» del ADR-0006: `leaf` (hoja `#9BB96D`) y `sand` (arena `#DEC9B7`), con su par oscuro y su fila en `src/test/contrast.test.ts` en el mismo cambio. Sin hex sueltos en componentes.
2. **Logo:** componente `BrandMark` (símbolo «m» con puertas) tomado de las maquetas, **provisional**, aislado en un solo archivo para reemplazarlo cuando llegue el SVG definitivo. Se usa en `AppSidebar` junto al nombre.
3. **Menú:** ítem activo con el tono `leaf`, sin romper `useSidebarPreference`.
4. **Agencias:** el `<select>` de estado pasa a pestañas (`role="tablist"`) que siguen escribiendo `?status=` en la URL. Sin contadores. Mismos estados, `AgencyStatusBadge` y diálogos de revisión sin cambios de lógica.

## No objetivos

- Vista de tarjetas (se mantiene solo tabla por la densidad alta del roadmap).
- Buscador de texto (el backend no tiene búsqueda), planes, membresías, vencimientos, contadores, métricas.
- Cambiar el `primary` verde actual o el comportamiento de autorización.

## Anti-objetivos

Que se rompa el contraste AA, el modo oscuro, el landmark `banner` o la navegación por teclado.

## Restricciones

Permisos por `can()`, nunca por rol; Zod en respuestas; UI en `es-CO`; sin `dangerouslySetInnerHTML`; el `--accent` existente de shadcn **no se toca**.

## Enfoques considerados

- **A. Usar el nombre `accent` para la hoja:** descartado, cambiaría hover de menús y botones ya hechos.
- **B. Tonos nuevos `leaf` y `sand` (elegido):** aditivo, sin regresiones.
- **C. Solo el verde actual:** descartado, la maqueta usa la hoja como acento.

## Decisiones tomadas por mí (a validar)

- Nombres `leaf` y `sand`.
- Sin buscador en la cabecera: no tendría función real.
- Las pestañas conservan el orden actual de `STATUS_FILTERS`.

## Qué queda al constructor

Valores oklch exactos de cada tono que pasen AA (se verifican con el test), y el detalle de estilos de las pestañas.

## Verificación

Tests de contraste, de las pantallas de agencias (filtro en URL, estados de carga, vacío, error), a11y y revisión en claro y oscuro.
