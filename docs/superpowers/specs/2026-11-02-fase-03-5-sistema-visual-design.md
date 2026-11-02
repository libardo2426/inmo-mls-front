# F3.5 — Sistema visual: diseño

## Contexto y porqué

F0–F3 funcionan pero se ven grises y planos: `src/index.css` conserva los neutros por defecto de shadcn (`oklch(x 0 0)`), el único color es `--destructive`, `AgencyStatusBadge` mapea 6 estados a 4 variantes de shadcn (pendiente y devuelta casi no se distinguen) y las pantallas usan tamaños de texto ad hoc. El roadmap (§9) pide consolidar un sistema visual antes de F4 para que F4–F6 lo hereden.

## Qué duele (respuesta del usuario)

«Todo es gris y plano» y «jerarquía y tipografía». Orden pedido: primero tokens (paleta semántica + escala tipográfica), luego aplicarlos a tablas, shell y diálogos.

## Goals / non-goals / anti-goals

- **Goals:** identidad de color, estados semánticos distinguibles, jerarquía tipográfica clara, primitivos reutilizables por F4–F6.
- **Non-goals:** pantallas o funciones nuevas, cambios de API, logo/ilustraciones, cambiar de preset shadcn, verificación a11y formal (F9).
- **Anti-goals:** romper tests/e2e; que el color sea el único portador de significado (el texto del estado siempre se muestra).

## Restricciones (roadmap §6)

Sobrio, densidad alta, tema claro y oscuro desde tokens, sin gradientes ni ilustraciones, WCAG 2.1 AA, UI en español centralizada en `src/lib/i18n/es.ts`.

## Enfoques

- **A. Solo tokens:** mínimo, pero la jerarquía depende de la disciplina de cada pantalla.
- **B. Tokens + primitivos (elegido):** además `PageHeader`, `Section`, `DescriptionList`, `StatusBadge`; la jerarquía queda incorporada y F4–F6 la heredan.
- **C. Cambiar preset shadcn:** descartado; reescribe componentes con ajustes y tests y no resuelve la jerarquía.

## Decisiones

- Paleta: azul sobrio como `primary`, neutros fríos; estados `success`/`warning`/`danger`/`info` (+ `-subtle`). **Propuesta mía, ajustable con capturas.**
- Estado de agencia → tono: `pending`→warning, `active`→success, `rejected`→danger, `changes_requested`→info, `suspended`→danger, `terminated`→neutral.
- Escala tipográfica de 4 niveles: `text-page-title`, `text-section-title`, `text-label`, `text-data`.
- Contraste verificado con un test propio (sin dependencia nueva): ≥ 4.5:1 texto, ≥ 3:1 UI, en ambos temas.

## Deja al implementador

Valores finos de oklch (afinar con capturas), espaciados exactos, y ajustes mínimos a tests que consulten clases concretas.
