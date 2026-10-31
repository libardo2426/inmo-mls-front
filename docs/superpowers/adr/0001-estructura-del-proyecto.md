# ADR-0001 — Estructura del proyecto

- **Estado:** Propuesto
- **Fecha:** 2026-10-31

## Contexto

SPA interna en React que crecerá por dominios (agencias, miembros, inmuebles, plataforma) y a futuro sumará un portal para Inmobiliaria/Agente. Necesitamos que agregar un dominio o un rol no obligue a reescribir ni a crear dependencias cruzadas.

## Decisión

Estructura **por features**, con capas compartidas explícitas:

```
src/
  app/                  # providers.tsx, router.tsx
  routes/               # árbol de rutas; solo composición y lazy loading
  features/<feature>/
    api/                # llamadas, schemas Zod de respuesta, query keys
    components/
    hooks/              # useXxxQuery / useXxxMutation
    schemas/            # schemas de formularios
    types.ts
  components/
    ui/                 # shadcn (generado por CLI)
    shared/             # DataTable, PageHeader, EmptyState, ErrorState, ConfirmDialog
  lib/
    http/               # cliente HTTP único (selección de host, errores tipados)
    api/generated/      # tipos y Zod generados desde openapi.json (no se editan a mano)
    auth/  permissions/  config.ts
  config/navigation.ts  # menú declarativo con permiso requerido
```

Reglas:

1. Una feature **no importa** de otra. Lo compartido sube a `components/shared` o `lib`.
2. Toda respuesta se valida con Zod dentro de `features/*/api` (usando los schemas generados cuando existan; a mano para los endpoints sin esquema, marcados `B-n`).
3. Un solo cliente HTTP; ningún `fetch` fuera de `lib/http`.
4. Query keys por feature, con factory.
5. Rutas con lazy loading por feature.
6. Cada pantalla define estados de carga, vacío, error y sin permiso.
7. La regla 1 se hace cumplir con ESLint (`no-restricted-imports` o `eslint-plugin-boundaries`), no por convención.

## Alternativas consideradas

- **Por capas técnicas** (`components/`, `hooks/`, `services/`): se vuelve inmanejable al crecer y acopla dominios.
- **Monorepo con paquetes por feature:** sobredimensionado para un solo equipo y una SPA.

## Consecuencias

- (+) Cada fase del roadmap mapea a una feature.
- (+) El portal Inmobiliaria/Agente reutiliza features sin copiar código.
- (−) Requiere disciplina y regla de lint para evitar imports cruzados.
- (−) Código compartido que dos features necesitan debe promoverse a `shared`/`lib`, con costo de diseño.
