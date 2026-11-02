# Fase 3 — Revisión de agencias — Diseño

- **Fecha:** 2026-11-02
- **Estado:** borrador para aprobación
- **Padre:** [Roadmap del frontend](./2026-10-31-roadmap-frontend-design.md) (fila F3 de §9), [F2](./2026-11-02-fase-02-autorizacion-shell-design.md), ADR-0004
- **Backend:** `docs/backend/contexto-para-frontend.md` §3, §8.1–8.2, §9.4 y `docs/backend/openapi.json` (`/v1/agencies*`, `/v1/territory/units/*`)
- **Rama / worktree:** `fase-03-revision-agencias`, en `.claude/worktrees/fase-03-revision-agencias`, creada desde `master` (F2 ya fusionada, PR #2).

**Decidido** = lo acordó el usuario. **Mi propuesta** = decisión mía, revisable.

---

## 1. Objetivo

Que el personal del MLS revise las solicitudes de inmobiliarias: ver el listado por estado, abrir el detalle con los datos que necesita para decidir, y **aprobar, devolver con cambios o rechazar**. Es la primera pantalla de datos del panel y la primera con acciones sensibles (2FA), así que también deja los componentes que reutilizan F4 y F5 (`DataTable`, confirmaciones, aviso de 2FA, nombres de territorio).

## 2. Alcance

### Dentro

1. **`DataTable` compartido** (`components/shared`), diseñado con este uso: columnas declarativas, estados de carga/vacío/error (reutiliza `EmptyState`/`ErrorState`), paginación por cursor «Cargar más» y densidad alta (**mi propuesta**: «Cargar más» y no páginas numeradas, porque el cursor es opaco y no permite saltar).
2. **Listado de agencias** (`GET /v1/agencies?status=&limit=&cursor=`), con filtro por estado guardado **en la URL** (search param). Columnas: nombre comercial, razón social, documento (tipo + número), estado, fecha de envío. Clic en la fila abre el detalle. **Mi propuesta:** el filtro abre por defecto en `pending` (lo que el revisor necesita primero), con opción «Todos».
3. **Detalle** (`GET /v1/agencies/{id}`): datos de la solicitud, estado, `reviewReason` y `reviewedAt` si existen, y sede principal con **nombre del municipio** (ver §4.4).
4. **Acciones** `approve`, `request-changes`, `reject`, visibles según permiso (`agency.approve`, `agency.request_changes`, `agency.reject`, alcance `network`) **y** estado `pending` (**decidido** que el estado habilita; ver §4.3). Confirmaciones:
   - **Aprobar:** confirmación simple, sin motivo.
   - **Devolver con cambios:** confirmación simple con motivo obligatorio (1–2000).
   - **Rechazar:** confirmación **reforzada** (**decidido**): motivo obligatorio y, **mi propuesta**, escribir el nombre comercial de la agencia para habilitar el botón; el texto avisa que se terminan las membresías y que la persona no verá el motivo.
5. **Aviso «requiere 2FA»** en el diálogo de cada acción sensible (pendiente de ADR-0004 §7). Informativo; el 403 `two_factor_required` lo sigue manejando el manejador global de F1.
6. **Nombres de territorio:** hook `useTerritoryName(code)` que resuelve código → nombre (§4.4).
7. **Ítem de menú «Agencias»** (permiso `agency.list`, alcance `network`) y rutas bajo `_protegido` con guarda por permiso; sin permiso, pantalla «sin permiso».
8. **Textos** en `lib/i18n/es.ts` (namespace `agencies`), mensajes de error por código del backend.
9. **Pruebas** y accesibilidad (§6) y nota en el README.

### Fuera de alcance

- Crear o editar agencias; el MLS solo revisa.
- Suspender/terminar agencias: no hay endpoint.
- Miembros e invitaciones de la agencia → F4.
- `allowedActions` de agencia: el backend aún no lo expone (B-15); se decide con permisos + `status`.
- Mostrar el motivo del rechazo a la persona rechazada: el backend no lo permite (pregunta 3.15 al bróker, abierta).
- Búsqueda por texto en el listado: el endpoint no la ofrece.
- Edición en lote o exportación.

### Anti-objetivos

- Que el botón aparezca por **rol**: solo por permiso y estado (regla ESLint `no-role-comparison`).
- Tratar la visibilidad del botón como seguridad: el servidor manda; un 409 `agency_not_reviewable` o 403 se muestra, no se oculta.
- Que un doble clic envíe dos veces una acción irreversible.
- Que el nombre de un municipio que no se pudo resolver rompa el detalle: se muestra el código.

## 3. Approaches

**Cómo construir.** Dos formas:

| Opción | Pros | Contras |
|---|---|---|
| **A. Por capas (elegida, decidido)** | Cada capa se prueba sola; el riesgo de las acciones queda al final, con todo lo demás probado; `DataTable` se diseña viendo el listado real | Nada usable de punta a punta hasta la capa 3 |
| B. Por flujo (listar + aprobar, luego el resto) | Algo usable antes | `DataTable` y territorio se diseñan con menos información |

**Nombres de territorio** (Q6, sin endpoint de consulta por código):

| Opción | Pros | Contras |
|---|---|---|
| A. Mostrar solo el código | Simple | Inútil para el revisor |
| **B. Resolver el nombre (elegida, decidido)** | Datos legibles | Trabajo extra y dependencia del catálogo |

**Cómo resolver B** (**decidido**): el backend implementó el filtro `codes` (pedido **B-16**, PR #78 de `inmo-mls`, pendiente de fusión): `?codes=05001,11001&limit=100`, hasta 100 códigos, desconocidos ignorados sin error, `parentCode` en cada ítem; 400 con 101 códigos o ninguno válido. El hook consulta el municipio y, con su `parentCode`, el departamento: dos peticiones, sin descargar el catálogo. Mientras el PR no esté desplegado, un backend sin el filtro devolvería la primera página sin filtrar; por eso el hook solo acepta el ítem cuyo `code` fue pedido y, si no aparece o hay un 400, muestra el código.

## 4. Diseño

### 4.1 Estructura

```
src/features/agencies/
  api/            cliente tipado (list, get, approve, requestChanges, reject) + schemas Zod
  hooks/          useAgencies (infinite), useAgency, useReviewAgency, useTerritoryName
  components/     AgencyStatusBadge, ReviewDialog, RejectDialog, AgencyDetailCard
  screens/        AgenciesListScreen, AgencyDetailScreen
  messages.ts     código de error del backend → texto en español
src/components/shared/DataTable.tsx
src/routes/_protegido/agencias/{index,$agencyId}.tsx
```

Convención: igual que `features/auth` (api, hooks, components, screens, messages). Los tipos salen del cliente generado (`lib/api/generated`); el listado y el detalle de agencias **sí** tienen esquema en el OpenAPI, así que no se tipan a mano.

### 4.2 Capas de construcción

1. **Cimientos:** `DataTable`, cliente y schemas de agencias, hook de territorio y sus pruebas.
2. **Lectura:** ítem de menú, rutas con guarda, listado con filtro en URL, detalle.
3. **Acciones:** diálogos, mutaciones con invalidación de caché, aviso de 2FA, mensajes de error.
4. **Cierre:** accesibilidad, e2e de los flujos, README, ADR si cambia el modelo de permisos.

### 4.3 Reglas de las acciones

- Visibles solo si `can(me, 'agency.approve' | 'agency.request_changes' | 'agency.reject', 'network')` **y** `status === 'pending'` (**mi propuesta** sobre `changes_requested`: no se muestran acciones, porque la agencia debe corregir y reenviar; vuelve a `pending` al reenviar).
- `compliance` tiene `agency.list` pero no las acciones: ve listado y detalle sin botones.
- Una acción en curso deshabilita todos los botones del detalle.
- Al terminar (204): se invalidan el listado y el detalle y se vuelve al listado con aviso de éxito (**mi propuesta**).
- Errores por código: 409 `agency_not_reviewable` (alguien más la revisó: se recarga el detalle y se explica), 422 `review_reason_required`, 404 `agency_not_found`, 403 `two_factor_required` (global), 429 con la espera que informe el backend.

### 4.4 Territorio

`useTerritoryName(code)` devuelve `{ name, isLoading }`. El detalle muestra «Municipio, Departamento» si el departamento se resuelve con `parentCode`; si algo falla, el código. El listado no muestra territorio (no es columna de F3).

## 5. Restricciones

- Sin endpoint de métricas ni auditoría: no se muestra historial de revisiones.
- Sin `allowedActions` de agencia (B-15) se resuelve en el front con permisos + `status`. La búsqueda por código de territorio (B-16) ya la resolvió el backend con `codes`.
- Las acciones sensibles exigen 2FA activo; sin él, el backend responde 403 `two_factor_required` y F1 lleva a activarlo.
- Densidad alta, tema claro/oscuro, textos en `lib/i18n/es.ts`.

## 6. Pruebas y calidad

- Unitarias de cliente/schemas/hook de territorio (incluye caída a código) y de las reglas de visibilidad de acciones (permiso × estado).
- De componentes: listado (carga, vacío, error, sin permiso), detalle, diálogos (motivo obligatorio, nombre a escribir en rechazo, doble envío).
- Accesibilidad con el patrón de F2 (`a11y.test`): foco al abrir y cerrar diálogos, tabla con encabezados, navegación por teclado.
- e2e en `e2e/` de aprobar/devolver/rechazar contra el backend con `compose` si está disponible (**mi propuesta**: no bloquea el cierre de la fase si el backend no está).

## 6.1 Aclaraciones tras la revisión (mis llamadas)

- **Territorio:** con el filtro `codes` (siempre con `limit=100`) cada ítem trae `parentCode`. El nombre del **departamento** sale de una segunda consulta al nivel `department` con ese `parentCode`. Si el departamento falla, se muestra solo el municipio.
- **Paginación:** `limit` máximo 100 (por defecto 20); el filtro `status` acepta un solo valor. «Todos» = no enviar `status`. El listado usa `limit=50`.
- **Filtro en URL:** search param `status`, validado con `validateSearch`; valores: los 6 estados o `all`. Sin param se interpreta como `pending` (sin redirección), de modo que el botón «atrás» desde el detalle conserva el filtro.
- **Aviso de éxito:** no hay librería de notificaciones en el proyecto y no se agrega una. Tras una acción se vuelve al listado con un `Alert` en línea (estado en la ruta de retorno, desaparece al cambiar de filtro). Tras un 409 se queda en el detalle recargado, con el aviso de que otra persona ya la revisó.
- **Guarda y «sin permiso»:** ya existen de F2 (`lib/permissions/guard.ts` con `assertCan`, y `ForbiddenState`). F3 solo las usa.
- **429:** el cliente HTTP ya expone `retryAfterSeconds`; F3 solo lo muestra en el diálogo y deshabilita reintentar durante la espera.
- **Rechazo — nombre escrito:** se compara sin distinguir mayúsculas/acentos y recortando espacios.
- **e2e:** `e2e/` ya existe con harness y `support`. Se agregan casos reutilizando ese soporte; los datos (admin con 2FA, `compliance`, agencias `pending`) se preparan con `ops-cli` (README). Si el backend no está, no bloquea el cierre.
- **Cliente generado:** el contrato ya trae `/v1/agencies*`; solo se regenera si el `openapi.json` cambia.

## 7. Qué queda al implementador

Nombres de query keys, composición exacta de los diálogos, estilos de densidad, tamaño de página (**mi propuesta:** 50), el texto de los avisos y la estructura interna de `DataTable`, siempre dentro de las convenciones de ADR-0001 y del código de F1/F2.

## 8. Preguntas abiertas

| # | Pregunta | Afecta |
|---|---|---|
| Q6 | Nombre de `territorialUnitCode`: **resuelta por el backend** con el filtro `codes` (PR #78). Falta que se fusione y despliegue; copiar el `openapi.json` nuevo y regenerar el cliente. | F3, F5 |
| — | ¿`compliance` realmente solo lee? Se confirma con un `/me` real (Q1). | F3 |
