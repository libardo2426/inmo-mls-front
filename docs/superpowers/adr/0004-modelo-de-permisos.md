# ADR-0004 — Modelo de permisos

- **Estado:** Aceptado (F2)
- **Fecha:** 2026-10-31

## Contexto

El backend entrega en `GET /v1/me` el mapa `membership.permissions: Record<Permiso, 'own' | 'agency' | 'network'>`. Un permiso ausente significa que no se tiene. El rol (`membership.role`) es solo texto para mostrar. Los botones de cada recurso se deciden con `allowedActions` (hoy solo existe en el detalle del inmueble, sus encargos y documentos). Hay permisos **sensibles** que exigen 2FA. Hoy solo entran admin MLS y super admin, pero a futuro entran `broker`/`agent`.

## Decisión

1. **Nunca se compara el rol.** Prohibido `role === ...` en lógica; el rol solo se renderiza. Se hace cumplir con una regla de ESLint.
2. **Catálogo tipado de permisos** en `lib/permissions`, derivado de los nombres del contrato (`property.read`, `agency.approve`, …) como unión de strings. Un permiso desconocido no compila.
3. **`can(permission, minScope?)`:** devuelve `true` si el permiso existe y su alcance es ≥ `minScope`, con el orden `own < agency < network`. Sin `minScope`, basta con que exista.
4. **`<Can permission="…" minScope="…">`** y el hook `useCan()` para UI. Son UX; el servidor es la autoridad y se re-verifica cada acción.
5. **Navegación declarativa** en `config/navigation.ts`: cada ítem declara el permiso que requiere; el menú se filtra con `can()`. Una ruta también declara su permiso en `beforeLoad`.
6. **Acciones de un recurso:** se usa `allowedActions` cuando el backend lo entrega. Mientras no exista (agencia, miembros, invitaciones: pedido `B-15`), el botón se decide con `can()` **más el `status` del recurso**, y el error del servidor es la fuente de verdad (el front muestra el título del `ProblemDetails`).
7. **Permisos sensibles:** el front los puede marcar para mostrar un aviso de "requiere 2FA", pero **no** decide el acceso con eso. Si el servidor responde 403 `two_factor_required`, se aplica el flujo de ADR-0003.
8. **Multi-tenant ready:** el alcance (`agency`/`network`) no se interpreta en componentes. Las queries reciben el contexto (agencia, país) desde la sesión; las features no asumen "red completa".
9. **Plano de plataforma:** el `platform_operator` no tiene `/me` (Q3). Mientras el backend no lo exponga, el acceso a la consola se decide por la sesión y la respuesta del servidor (403 `platform_operator_required`), y el catálogo de permisos admite una fuente alterna de permisos sin cambiar `can()`.

## Implementación (F2)

- `lib/permissions` es puro: `PERMISSIONS` (catálogo, comparado por un test con la tabla del backend), `can()`, `assertCan()` y `PermissionDeniedError`. `PermissionsProvider`, `useCan()` y `<Can>` leen la sesión de un contexto de React que provee el shell.
- La ruta `_protegido` resuelve `/me` una vez (`enforce` devuelve el estado) y lo pone en el contexto del router como `context.me`; las rutas hijas con permiso usan `beforeLoad: ({ context }) => assertCan(context.me, '…')`.
- Una ruta sin permiso lanza `PermissionDeniedError`; `RouteErrorBoundary` (el `defaultErrorComponent` del router) lo muestra como «sin permiso» **dentro del shell**.
- El shell vive en `src/app/shell` (no en una feature) porque compone la feature `auth` (cierre de sesión) y una feature no importa otra.
- Quedan para F3: `allowedActions`/botones por recurso y el aviso «requiere 2FA».

## Alternativas consideradas

- **Guardas por rol (`isAdmin`):** se rompe al agregar roles y duplica reglas del backend. Descartado.
- **Copiar `ROLE_MAP` al frontend:** se desincroniza. Descartado; el servidor ya entrega los permisos efectivos.

## Consecuencias

- (+) Agregar el rol Inmobiliaria/Agente es dar permisos distintos en `/me`; las pantallas no cambian.
- (+) El menú y las rutas se mantienen en un único lugar.
- (−) Hasta B-15, algunas decisiones de botones combinan permiso + estado y pueden mostrar una acción que el servidor luego rechaza.
- (−) El conjunto exacto de permisos de `admin`/`compliance` se confirma con `/me` real (Q1).
