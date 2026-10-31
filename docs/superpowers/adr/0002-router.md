# ADR-0002 — Router

- **Estado:** Propuesto
- **Fecha:** 2026-10-31

## Contexto

El panel tendrá tablas con filtros (estado, tipo de inmueble, territorio) que deben vivir en la URL, rutas protegidas por permisos y code splitting por feature. La paginación del backend es por **cursor opaco**.

## Decisión

**TanStack Router** (modo SPA, rutas basadas en archivos con code splitting automático).

- Search params tipados y validados con **Zod** (`validateSearch`) para filtros y paginación.
- `beforeLoad` en rutas para las guardas (sesión, 2FA, permiso). Son UX: el backend es la autoridad.
- Integración con TanStack Query para precargar datos en `loader`.
- El **país no va en la URL** (ver ADR-0005): las rutas son `/agencias`, `/inmuebles`, etc.
- Rutas en español para la URL pública del panel.

Sobre la paginación por cursor: el cursor es opaco y no permite saltar a una página. Se guarda **el cursor actual en el search param** para que recargar o compartir el enlace funcione, y la navegación "anterior" se resuelve con el historial del navegador.

## Alternativas consideradas

- **React Router (modo SPA):** más conocido y estable, pero sus search params no están tipados de forma nativa y habría que envolverlos a mano.

## Consecuencias

- (+) Filtros y cursor tipados de punta a punta; menos errores en tablas.
- (+) Code splitting y loaders integrados.
- (−) Ecosistema y base de ejemplos menores que React Router.
- (−) Las rutas generadas por archivos añaden una dependencia de build (plugin de Vite).

## Cuándo revisarlo

Si el plugin de rutas bloquea una necesidad real (p. ej. permisos dinámicos por ruta que no encajen en `beforeLoad`), se reevalúa en la Fase 0 antes de escribir rutas.
