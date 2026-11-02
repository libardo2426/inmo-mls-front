# Fase 2 — Autorización y shell — Diseño

- **Fecha:** 2026-11-02
- **Estado:** borrador para aprobación
- **Padre:** [Roadmap del frontend](./2026-10-31-roadmap-frontend-design.md) (fila F2 de §9), [F1](./2026-10-31-fase-01-autenticacion-design.md) y ADR-0001, ADR-0004 (se pasa a «Aceptado» al cerrar la fase)
- **Backend:** `docs/backend/contexto-para-frontend.md` §3 (roles y permisos) y `GET /v1/me` en `docs/backend/openapi.json`

**Decidido** = lo acordó el usuario. **Mi propuesta** = decisión mía, revisable.

---

## 1. Objetivo

Que quien entra al panel vea un **menú con solo lo que sus permisos le dejan ver**, dentro de un shell (menú lateral + cabecera) que usarán todas las fases siguientes. Al terminar, agregar una pantalla nueva con su permiso es declarar un ítem y una ruta, sin tocar el shell.

## 2. Alcance

### Dentro

1. **Catálogo tipado de permisos** en `lib/permissions` (**decidido**, opción A): unión de strings con los nombres del contrato; un permiso mal escrito no compila.
2. **`can(me, permission, minScope?)`** (función pura), **`useCan()`** y **`<Can>`**. Orden de alcance `own < agency < network`; sin `minScope` basta con que el permiso exista (ADR-0004 §3–4).
3. **Navegación declarativa** en `config/navigation.ts`: cada ítem declara ruta, icono, texto y el permiso que exige; el menú se filtra con `can()` (**decidido**). Solo entran ítems cuya pantalla existe (**decidido**): en F2 el único es **Inicio**, que no exige permiso (basta tener membresía).
4. **Guarda de ruta por permiso:** helper para `beforeLoad` que, sin el permiso, muestra la pantalla «sin permiso» (no redirige a otra ruta).
5. **Shell** (**decidido**: menú lateral fijo que se puede plegar a iconos):
   - Layout en la ruta `_protegido`; reemplaza la `HomePage` mínima de F1 por una página de Inicio dentro del shell.
   - Menú lateral expandido por defecto, plegable a solo iconos; **mi propuesta:** la elección se recuerda en el navegador (`localStorage`, con `try/catch`), con tooltip del nombre cuando está plegado, y en móvil el menú es un panel que se abre con botón.
   - Cabecera con el título de la pantalla, el cambio de tema y el menú de usuario (correo, país, cerrar sesión). Esos tres datos salen hoy de la página de F1.
6. **Estados compartidos** en `components/shared`: `EmptyState`, `ErrorState` (muestra el título del `ProblemDetails` y el `requestId`, sin detalles internos) y `ForbiddenState` (sin permiso). Se usan también como `errorComponent` del router.
7. **Componentes shadcn** necesarios (sidebar, tooltip, dropdown-menu, skeleton, sheet y lo que arrastren), añadidos con la CLI de shadcn.
8. **Textos** en `lib/i18n/es.ts` (namespaces `nav`, `shell`, `states`).
9. **Cierre de ADR-0004** (pasa a «Aceptado») y nota en el README sobre cómo agregar un ítem de menú con su permiso.

### Fuera de alcance

- **`DataTable`** → **F3**, donde se diseña con el uso real (**decidido**; el roadmap lo ponía en F2).
- Ítems de menú de Agencias, Miembros, Inmuebles y Consola → cada fase agrega el suyo (**decidido**).
- `platform_operator`: no tiene `/me` en `admin.api` (B-14/B-18); su acceso y su shell se resuelven en **F6**. F2 no lo maneja (**mi propuesta**).
- `allowedActions` de recursos (botones por fila): llegan con la primera pantalla que los use (F3), según ADR-0004 §6.
- Aviso de «requiere 2FA» en acciones sensibles (ADR-0004 §7): se difiere a F3, que es la primera con acciones sensibles (**mi propuesta**).
- Migas de pan, búsqueda global, notificaciones.

### Anti-objetivos

- Comparar el rol para decidir qué se ve (ya lo prohíbe la regla ESLint `no-role-comparison`).
- Tratar el menú o la guarda como seguridad: son UX; el servidor es la autoridad y su 403 manda.
- Que un permiso que el backend agregue y el catálogo no conozca rompa la sesión.

## 3. Approaches considerados

**Decisión estructural: de dónde sale la lista de permisos válidos.** El contrato OpenAPI declara `permissions` como `Record<string, 'own'|'agency'|'network'>`, sin nombres, así que no se puede generar.

| Opción | Pros | Contras |
|---|---|---|
| **A. Catálogo escrito a mano (elegida)** | Un error de tipeo no compila; encaja con ADR-0004 | Hay que agregar a mano los permisos nuevos |
| B. Strings libres en `can('…')` | Cero mantenimiento | Un error de tipeo oculta un ítem sin avisar |
| C. Copiar toda la tabla del backend | Cómodo a futuro | Incluye permisos no probados contra un `/me` real (Q1) |

**Decidido:** A. **Mi propuesta de contenido:** el catálogo lista los permisos de usuario de la tabla de §3 del contexto del backend (no los de sistema que «nunca aparecen en `/me`»), porque el tipo es barato y F3–F6 los usarán; un test compara el catálogo con esa tabla. Lo que se construye «a medida» son los **ítems de menú y pantallas**, no los nombres.

## 4. Diseño

### Permisos
- `Permission` (unión), `Scope = 'own' | 'agency' | 'network'`, orden numérico interno.
- `can(me, permission, minScope?)`: lee `me.membership.permissions[permission]`. Un permiso desconocido para el catálogo que llegue en `/me` **se ignora**, no falla el parseo.
- `useCan()` lee `/me` de la caché de TanStack Query; `<Can permission minScope fallback?>` renderiza o no. Ninguno de los dos decide acceso real.

### Rutas
- `_protegido` pasa a ser el layout del shell. Las rutas con permiso declaran `beforeLoad: requirePermission('…')` (compone con la guarda `enforce('protected')` de F1, sin repetir la llamada a `/me`: sale de la caché).
- Sin permiso → `ForbiddenState` dentro del shell (el usuario conserva el menú y puede volver).

### Menú
- `config/navigation.ts` exporta una lista de `{ to, labelKey, icon, permission?, minScope? }`. El componente del menú la filtra con `can()` y marca el ítem activo.
- Con solo Inicio, el menú filtrado nunca queda vacío; si un día lo estuviera, se muestra `EmptyState`.

### Estados
- `ErrorState` recibe un `ApiError`/`Error` y muestra título + `requestId`; botón «Reintentar» cuando se le da una acción. `ForbiddenState` no revela qué permiso falta.

## 5. Criterios de aceptación

1. Un usuario con `/me` sin permisos de agencia no ve ningún ítem de agencias; con ellos, sí (probado con ítems de prueba inyectados en el test, porque en F2 solo existe Inicio).
2. `can()` respeta el orden de alcances y devuelve `false` si el permiso falta.
3. Un permiso desconocido en `/me` no rompe la sesión.
4. Entrar por URL a una ruta con permiso sin tenerlo muestra «sin permiso» con el shell visible.
5. El menú se pliega y se despliega con teclado; plegado muestra el nombre en tooltip; el estado se recuerda y la app funciona sin `localStorage`.
6. En móvil el menú se abre y cierra como panel.
7. Cerrar sesión desde el menú de usuario limpia la caché (ya hecho en F1) y lleva a login.
8. El test del catálogo falla si difiere de la tabla de permisos del contexto del backend.
9. Accesibilidad: foco visible, navegación completa por teclado, `aria-current` en el ítem activo, contraste en ambos temas.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` en verde; CI sin vulnerabilidades altas.

## 6. Restricciones

- Sin imports entre features (ADR-0001, regla ESLint); lo compartido va a `lib/` o `components/shared`.
- Textos en español, centralizados; sin `dangerouslySetInnerHTML`; sin `fetch` fuera de `lib/http`.
- shadcn solo por CLI; no se editan a mano sus archivos salvo lo estrictamente necesario.
- Sin commit, push ni merge sin aprobación (convención del roadmap §12).

## 7. Qué queda al implementador

Nombres de archivos y de query keys, composición interna de los componentes del shell, iconos concretos, ancho del menú, claves exactas de `localStorage`, y qué subconjunto de componentes shadcn se necesita realmente.

## 8. Preguntas abiertas

- **Q1** (permisos exactos de `admin` y `compliance`): se confirma leyendo `/me` de usuarios reales; no bloquea F2, porque el catálogo sale de la documentación y se contrasta con un `/me` real al probar.
