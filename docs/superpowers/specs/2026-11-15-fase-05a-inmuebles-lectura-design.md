# F5a — Inmuebles en solo lectura: listado y ficha

- **Fecha:** 2026-11-15
- **Estado:** pendiente de aprobación
- **Contexto:** tercera entrega del diseño visual (F3.6 → F4 → F5). F5 se divide en dos: **F5a** (este documento: listado y ficha) y **F5b** (galería, descarga de soportes y terminar encargo; spec aparte). Origen: `docs/superpowers/prompts/2026-11-15-vistas-admin-diseno-visual.md` (maquetas `02-propiedades-listado.html` y `03-propiedad-detalle.html`). Roadmap: F5, solo lectura.

## Intención

Que el personal del MLS (admin y compliance) consulte el inventario de la red y vea la ficha de un inmueble, sin poder cambiar nada. Es la primera vista de inmuebles del panel y fija el patrón que F5b y F10 reutilizan.

## Goals

1. **Listado** `/inmuebles` con tabla y filtros en la URL: tipo (`propertyType`), estado (`status`), territorio (`territorialUnitCode`) y agencia (`agencyId`). Paginación por cursor con «Cargar más» (`limit` 50). Un `Link` por fila a la ficha.
2. **Filtro de agencia** como selector con las agencias activas (`GET /v1/agencies?status=active`, `limit=100`). Muestra nombre, envía `id`. La columna «Agencia» del listado traduce `editorAgencyId` con esa misma lista; si no aparece, texto neutro, sin romper la fila.
3. **Ficha** `/inmuebles/$propertyId` con `GET /v1/properties/{id}` (esquema generado `zPropertyDetailResponse`): datos del inmueble (identificador, tipo, estado, dirección con nombre de territorio, áreas, descripción, características), editor, precios de lista, encargos (agencia, operación, tipo, fechas, estado), historial de cambios y lista de documentos (nombre, tipo, visibilidad, fecha; sin descarga).
4. **Nombres de territorio** con `useTerritoryName` (B-16); sin el filtro `codes` desplegado, se muestra el código.
5. **Menú:** ítem «Inmuebles» con `property.read` y alcance de red; rutas protegidas con `assertCan`.
6. **Esquemas Zod a mano** solo para la respuesta del listado (`GET /v1/properties`), en un archivo propio, marcado `B-11`.

## Non-goals

Galería y variantes de imagen (F5b), descarga de soportes (F5b), terminar encargo (F5b), alta o edición de inmuebles (F10), búsqueda de texto (el backend no la tiene), vista de tarjetas, contadores por pestaña, acciones masivas, mapa, vistas, contactos y favoritos (inventados en la maqueta), mostrar `privateTerms` (el admin MLS no los ve), cambiar estados.

## Anti-goals

Que un fallo del listado de agencias rompa el listado de inmuebles; que la ficha muestre datos que el backend no entrega; que se compare por rol en vez de por permiso; que se guarden URLs firmadas.

## Constraints

- Permisos por `can()` / `useCan()` (`property.read`, red), nunca por rol.
- Zod en toda respuesta; UI es-CO; textos en `src/lib/i18n/es.ts`; tokens de F3.5/F3.6, sin colores sueltos; modo oscuro; densidad alta; estados de carga, vacío, error y sin permiso en cada pantalla.
- Paginación por cursor; filtros en la URL; un valor inválido de filtro cae al valor por defecto (patrón `parseStatusFilter`).
- Estados del inmueble: `draft | active | reserved | closed | suspended | withdrawn | expired`; uno desconocido se muestra con tono neutro y valor crudo (patrón de `StatusBadge`).
- Tipos de inmueble hoy: `apartment`, `house`, `lot`, `retail`, `office`, `warehouse`, `farm`; uno desconocido se muestra crudo.
- El personal del MLS pasa la regla `agency_not_active` de las rutas de propiedades.

## Enfoques considerados

- **A. Feature `properties` con Zod a mano para el listado (elegido):** sigue el patrón de agencias y miembros; lo provisional queda en un archivo que se borra cuando B-11 llegue.
- **B. Esperar B-11:** descartado, bloquea F5a por algo ajeno.
- **C. Zod a mano en `src/lib/api/schemas.ts`:** descartado, mezcla un parche con tipos estables.

## Decisiones tomadas por el usuario

Dos entregas (F5a y F5b); selector de agencias activas para el filtro y la columna; enfoque A.

## Decisiones mías (a validar)

- Solo tabla en el listado (densidad alta), coherente con agencias.
- Ruta `/inmuebles`, con `?type=`, `?status=`, `?territory=`, `?agency=` como claves de la URL.
- El selector de agencias no pagina (máximo 100 activas); si hubiera más, queda anotado como límite conocido.
- La ficha se organiza en secciones (`Section`): Datos, Encargos, Precios de lista, Historial, Documentos.
- **Importes:** `amountMinor` es un string en unidades menores (el backend lo documenta como centavos de COP: `35000000000` = 350.000.000). Se divide siempre por 100 (2 decimales fijos, constante `MINOR_UNIT_DECIMALS = 2`) y se formatea con `Intl.NumberFormat('es-CO', { style: 'currency', currency })`. **No** se usan los decimales de `Intl` (para COP darían 0 y multiplicarían el precio por 100). Se opera sobre el string con `BigInt`, nunca con `Number`.
- **Agencia:** el filtro `agencyId` y la columna se rotulan «Agencia editora» y usan `editorAgencyId`. Es una inconsistencia conocida del backend (§16): no es control de acceso y se anota como supuesto.
- **Búsqueda de nombres de agencia:** una sola consulta `GET /v1/agencies?limit=100` **sin** filtro de estado alimenta la columna y el historial (así aparecen agencias suspendidas o terminadas); el selector del filtro muestra solo las `active`, filtradas en cliente.
- **Filtros en la URL:** `type` solo se acepta si está en la lista de tipos conocidos y `status` si está en el conjunto cerrado; `agency` solo si es un UUID; `territory` se envía tal cual si no está vacío. Un valor inválido se descarta (cae al valor por defecto, sin filtro).
- **Historial:** cada entrada muestra campo (`list_price` → «Precio de lista», `status` → «Estado», `editor` → «Editor»), valor anterior → valor nuevo con formateo por campo (dinero si es `amountMinor`, etiqueta de estado, nombre si es objeto con `name`, y el valor crudo en texto si no encaja), agencia por nombre y fecha. El `userId` no se muestra (nada lo resuelve a nombre).
- **Alcance de la ficha:** se muestran `identifierLabel` con el estado del identificador, tipo, estado, dirección con nombre de territorio (se anota si `addressVisibility` no es total), áreas, descripción, `features`, `attributes` como lista clave-valor, editor, precios, encargos y documentos. **Se omiten**: `media` completa (F5b), coordenadas, `visitInstructions` y `memberNotes`.
- **Estados de la ficha:** el 404 y el «sin permiso» son estados dentro de la página (patrón de `AgencyDetailScreen`), sin redirección; no se valida el UUID en cliente.
- Un fallo de `/v1/agencies` deja el filtro de agencia deshabilitado y la columna con texto neutro, sin bloquear el listado.

## Preguntas abiertas / pedidos al backend

- **B-11:** esquema OpenAPI de `GET /v1/properties` (ya registrado).
- Los decimales de otras monedas distintas de COP: hoy solo existe COP; se asumen 2 decimales y se revisará al sumar otro país.
- Qué agencias ve `compliance` en el listado (sin verificar con usuarios reales; Q1 del roadmap).

## Qué queda al constructor

Nombres de claves de caché y hooks, estructura de la tabla y del panel de filtros, el modelo de `PropertyStatus`/tipo → tono y etiqueta, y la disposición exacta de las secciones de la ficha.

## Verificación

Tests de: esquema del listado (válido, inválido, estado desconocido), filtros desde la URL (válidos, inválidos, combinados) y su envío al backend, paginación «Cargar más», columna de agencia con y sin coincidencia, fallo del listado de agencias sin romper el de inmuebles, ficha con cada sección y estados de carga / error / 404 / sin permiso, permiso por `can()` y a11y; pasada en claro y oscuro con `pnpm lint`, `typecheck`, `test` y `build`.
