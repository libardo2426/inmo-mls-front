# Roadmap del Frontend — Diseño

- **Fecha:** 2026-10-31
- **Estado:** borrador para aprobación
- **Fuente de verdad del backend:** `docs/backend/contexto-para-frontend.md` (base `origin/main` @ `c947947`)
- **Ciclo:** este documento es el spec del **proyecto completo**. No se implementa directamente; cada fase tendrá su propio `brainstorming → spec → plan → ejecución`.

Convención: lo decidido con el usuario va como **Decidido**. Lo que propongo yo va como **Mi propuesta** (se puede cambiar). Lo que depende del backend y no está confirmado va a *Preguntas abiertas* (§10).

---

## 1. Visión e intención

Construir el panel interno (SPA) de **Innmo MLS**, un MLS inmobiliario multi-país donde las inmobiliarias comparten inventario. El panel lo usa el **personal que opera la red**, no las inmobiliarias ni el público.

**Por qué:** el MLS necesita revisar y aprobar inmobiliarias, supervisar el inventario y los encargos de la red, y administrar la configuración de cada país. Hoy eso solo se puede hacer con el CLI del backend (`ops-cli`) o a mano contra la API.

### Goals

- Un panel profesional, denso y sobrio para operar el MLS de un país.
- Una consola de plataforma, dentro de la misma SPA, para el super admin.
- Autorización por **permisos del servidor** (`/me`), nunca por rol.
- Arquitectura lista para sumar el portal de Inmobiliaria/Agente **sin reescribir**.
- Seguridad y despliegue (Docker + Nginx, mismo origen, configuración en runtime) resueltos desde la Fase 0/1.

### Non-goals

- Pantallas para `broker`, `agent`, `assistant` o `read_only` (solo se prepara la arquitectura).
- Portal público o de cliente final.
- **Crear, aprovisionar o activar países desde la UI.** Hoy es solo CLI; el usuario lo descartó por ahora y no se planifica ni como fase ni como pedido al backend. Queda como idea futura.
- Reimplementar reglas de negocio del backend: la UI las explica y muestra el error del servidor.

### Anti-goals (fallaría aunque "funcione")

- Comparar roles en el código (`role === 'admin'`).
- Guardar tokens o datos sensibles en `localStorage`/`sessionStorage`.
- Inventar endpoints, campos o reglas que el backend no tiene.
- Construir pantallas vacías para funciones que el backend no soporta (auditoría, dashboard).

---

## 2. Actores y alcance

| Actor | Rol(es) backend | Host de API | Alcance |
|---|---|---|---|
| **Admin MLS** | `admin` (opera la red; **exige 2FA**), `compliance` (solo lectura) | `<país>.api.<dominio>` | ✅ Se construye. **Decidido:** opera **un solo país** por ahora |
| **Super admin** | `platform_operator` (rol global, **exige 2FA**) | `admin.api.<dominio>` | ✅ Se construye lo que el backend permite: ver/publicar la configuración de un país existente. **Decidido** |
| Inmobiliaria / Agente | `broker`, `agent`, `assistant`, `read_only` | host del país | 🔜 Futuro. Solo arquitectura + spec en F10 |
| Cliente final | — | — | ❌ Fuera de alcance |

**Decidido:** una sola SPA que habla con **dos hosts de API** (país y plataforma). El menú y las rutas salen de los permisos.

**Nota de contexto:** el backend ya tiene como usuarios principales a `broker`/`agent` (registran inmuebles y encargos). El "admin" del backend es personal del MLS con un conjunto de acciones **más reducido** que el descrito en el prompt original (§5).

---

## 3. Modelo de dominio inferido del backend

| Concepto | Qué es | Notas para la UI |
|---|---|---|
| **Tenant (país)** | Unidad de configuración y datos. Hoy `co`. | Llega en `/me → tenant` y `config` (moneda, zona horaria, locale, `areaUnit`, etiqueta del identificador). |
| **Agencia** | Inmobiliaria. Estados: `pending`, `changes_requested`, `active`, `rejected`, `suspended`, `terminated` | Revisión: `approve`/`request-changes`/`reject`. `suspended`/`terminated` no tienen endpoint. |
| **Sede** | Oficina; toda agencia tiene una principal | Sin endpoints de gestión. |
| **Miembro** | Persona con rol en una agencia o en el MLS. `active`/`suspended`/`terminated` | Listado por agencia (sin paginar); el MLS puede terminar (`member.terminate_any`, 2FA). |
| **Invitación** | Forma de sumar personas a una agencia | La gestiona el `broker`; el admin MLS no tiene `member.invite`. |
| **Inmueble** | Ficha única por matrícula; estados `draft…withdrawn` | Todas quedan `draft`: no hay ciclo de vida. El admin solo lee. |
| **Encargo** | Vínculo agencia↔inmueble por operación (`sale`/`lease`; hoy solo `sale`) | El MLS puede terminar cualquiera (`mandate.terminate_any`, 2FA). |
| **Condiciones privadas** | Precio neto, mínimo, comisión, contacto | Solo las ve la agencia dueña: **el admin MLS no las ve**. |
| **Multimedia / Documentos** | Archivos del inmueble | El MLS solo lee soporte (`document.read_support`). |
| **Configuración del país** | Se publica desde el plano de control | `GET/PUT /v1/admin/tenants/{code}/config` (`TenantConfigBody`). |

**Convenciones transversales** (de §4 del contexto): ids UUID v7; dinero `{ amountMinor: string, currency }` (**string**, nunca number); instantes ISO UTC; paginación por cursor opaco (`limit` 1–100, `nextCursor`); errores `application/problem+json` decididos por `code`.

---

## 4. Qué puede hacer cada actor hoy (según el backend)

### Admin MLS (`admin` / `compliance`)

| Capacidad | Endpoints | Permiso | Notas |
|---|---|---|---|
| Listar solicitudes de agencias | `GET /v1/agencies?status=&limit=&cursor=` | `agency.list` | Cursor |
| Ver una agencia | `GET /v1/agencies/{id}` | cualquier miembro | `reviewReason` visible si `changes_requested` |
| Aprobar / devolver / rechazar | `POST /v1/agencies/{id}/approve \| request-changes \| reject` | `agency.approve` / `request_changes` / `reject` | **2FA**; motivo 1–2000 |
| Ver miembros de una agencia | `GET /v1/agencies/{agencyId}/members` | `member.read` (network) | Sin paginar |
| Terminar un miembro | `POST /v1/members/{id}/terminate` | `member.terminate_any` | **2FA**; error `last_broker` |
| Ver inmuebles de la red | `GET /v1/properties` (+ filtros), `GET /v1/properties/{id}` | `property.read` | Lista **sin esquema** en OpenAPI |
| Descargar soporte | `GET /v1/documents/{id}/download` | `document.read_support` | URL firmada 300 s, no se guarda |
| Terminar un encargo | `POST /v1/mandates/{id}/terminate` | `mandate.terminate_any` | **2FA** |

> El **conjunto exacto** de permisos de `admin` y `compliance` no está listado por rol en el contexto: aquí se deduce de la tabla de permisos y de la descripción de roles. Se confirma con `/me` real (pregunta abierta Q1).

### Super admin (`platform_operator`)

| Capacidad | Endpoints | Notas |
|---|---|---|
| Ver configuración de un país | `GET /v1/admin/tenants/{code}/config` | **2FA**. Cuerpo `TenantConfigBody` en `openapi.json` |
| Publicar configuración | `PUT /v1/admin/tenants/{code}/config` | **2FA** |

Limitaciones: no hay endpoint para **listar países** (el `code` se escribe o viene de configuración), ni `/me` para este rol (Q3).

### Sesión y entrada (todos)

`POST /v1/auth/*` (Better Auth: sign-in, sign-out, get-session, reset de contraseña, 2FA `enable`/`verify-totp`/códigos de respaldo), `GET /v1/me`, `GET /v1/me/tenants`.

**Importante:** un `admin` o `platform_operator` **sin 2FA** recibe 403 `two_factor_required` en casi todo, **incluido `/me`**. El flujo de login debe llevarlo a activar 2FA antes de pedir `/me` (discrepancia #3 del contexto).

---

## 5. Diferencia con el prompt original (impacto en el roadmap)

El prompt original esperaba un admin que "gestiona inmobiliarias, agentes, propiedades, configuración, auditoría". Con el backend real:

| Esperado en el prompt | Realidad del backend | Efecto |
|---|---|---|
| CRUD de inmobiliarias | Solo **revisión** (aprobar/devolver/rechazar); el admin no crea ni edita. Suspender/terminar: sin endpoint | F3 es revisión, no CRUD |
| CRUD de agentes/usuarios | El admin MLS solo **lee y termina** miembros. Invita/cambia roles solo el `broker` | F4 reducida |
| Propiedades (alta, edición, ciclo de vida) | Admin MLS **solo lee**. No hay publicar/cambiar estado. Alta/edición son de `broker`/`agent` | F5 es solo lectura |
| Dashboard | **No hay endpoints de métricas** | Bloqueada |
| Auditoría | **No hay endpoint** (el log existe en base, no en API) | Bloqueada |
| Catálogos editables | Solo lectura (`property-types`, territorio). La config se edita vía `PUT .../config` | Dentro de la consola de plataforma |
| Subida de imágenes | Solo `media.manage` (agencias) | Fuera del admin MLS |

---

## 6. Dirección visual (requisitos)

- **Audiencia:** personal interno del MLS, uso diario y prolongado. Prima la eficiencia sobre la decoración.
- **Tono:** profesional y sobrio. Sin ilustraciones decorativas ni gradientes. **Decidido.**
- **Densidad:** alta. Tablas compactas, filtros visibles, poco espacio muerto, navegación por teclado. **Decidido.**
- **Modo oscuro:** desde el primer día, con tema claro y oscuro a partir de tokens. **Decidido.**
- **Referencia:** *Alpino Admin Dashboard* (Envato). No pude ver sus capturas (la página solo describe texto: Bootstrap 4, menús claro/oscuro, 15+ dashboards). Se toma como **inspiración de estructura**, no como copia. **Mi propuesta:** sidebar fijo colapsable, cabecera con usuario y estado de sesión, contenido en tablas y paneles; el selector de país queda previsto en la cabecera pero oculto mientras haya un solo país.
- **Idioma:** UI en español (`es-CO`), textos centralizados para permitir i18n después. Formatos con `Intl` y `config.locale` (los formatos no llegan por API).
- **Estados obligatorios** en cada pantalla: carga, vacío, error, y "sin permiso".
- **Importante para la UX:** las acciones sensibles (aprobar, rechazar, terminar, publicar configuración) llevan confirmación explícita y, cuando el backend lo exige, motivo.

---

## 7. Requisitos no funcionales

### Rendimiento
- SPA con code splitting por feature (lazy routes). Presupuesto de bundle inicial a definir en F0 (**Mi propuesta:** ≤ 200 kB gzip de JS inicial).
- Tablas con paginación por cursor; caché con TanStack Query; `ETag`/304 en catálogos.
- Revisión final con las reglas de **cliente** de `vercel-react-best-practices` (no aplican RSC/SSR).

### Seguridad
- Sesión por **cookie `httpOnly`** de Better Auth; el frontend **no guarda tokens** (ADR-0003). Nada en `localStorage`/`sessionStorage`.
- **Mismo origen:** Nginx proxea la API; Vite proxy en desarrollo. Sin CORS en producción.
- CSP estricta sin `unsafe-inline` en scripts, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, HSTS.
- Guardas de ruta y `<Can>` son UX; **el backend es la autoridad**. Manejo global de 401/403 y de los códigos de §6 del contexto.
- Zod en toda respuesta y formulario; sin `dangerouslySetInnerHTML`; errores sin detalles internos (mostrar `requestId`); sin source maps públicos; `npm audit` en CI.
- Logout limpia la caché de TanStack Query.
- Los enlaces firmados (documentos, multimedia) **no se guardan**.

### Accesibilidad
- WCAG 2.1 AA como objetivo: contraste en ambos temas, foco visible, navegación por teclado completa, roles ARIA correctos (se apoya en los primitivos de shadcn/Radix). Verificación formal en F9.

### Escalabilidad
- Estructura por features, sin imports entre features (ADR-0001).
- Permisos con alcance (`own < agency < network`) y navegación declarativa (ADR-0004).
- Cliente HTTP con **selección de host** (país / plataforma) y contexto de tenant (ADR-0005), sin país en la URL.
- Las pantallas se escriben contra permisos y `allowedActions`, de modo que el portal Inmobiliaria/Agente reutilice las mismas features con otro alcance.

---

## 8. Approaches considerados

**Decisión estructural: cómo conoce el frontend el contrato del backend.**

| Opción | Pros | Contras |
|---|---|---|
| A. Zod escritos a mano por feature | Control total, sin herramientas | Se desincroniza; mucho trabajo manual (OpenAPI de ~5.000 líneas) |
| B. Todo generado desde `openapi.json` | Siempre sincronizado | 3 endpoints sin esquema; no cubre auth (Better Auth); hay que acordar cómo versionar el archivo |
| **C. Híbrido (elegida)** | Tipos y Zod generados desde una copia versionada de `openapi.json`; los 3 endpoints sin esquema con Zod a mano marcados `B-n`; auth con `better-auth/react` | Requiere un script de actualización y vigilar el diff del contrato |

**Decidido:** C. Los pedidos al backend se numeran `B-n` según el formato del contexto (§15).

**País en la URL:** no se pone `/co/...` en las rutas. **Decidido** (el admin MLS opera un solo país). El país viene de `/me` y del proxy; el cliente HTTP lo recibe como contexto. Agregar el selector después no exige reescritura.

**Una SPA vs dos:** **Decidido** una sola SPA con dos hosts de API. Se descartó separar el super admin (aislaría mejor la superficie, pero duplica tooling, Docker y componentes).

---

## 9. Roadmap de fases (ajustado al backend real)

Estado: ✅ viable · ⚠️ viable con límites · 🚫 bloqueada por el backend.

| Fase | Nombre | Entregable | Depende de | Estado |
|---|---|---|---|---|
| **F0** | Fundación | Vite + React + TS strict, shadcn init + tokens claro/oscuro, router, TanStack Query, cliente HTTP con 2 hosts, config de runtime, `openapi.json` versionado + generación de tipos/Zod, tooling, tests base, Docker dev/prod + Nginx, CI | — | ✅ |
| **F1** | Autenticación y seguridad base | Login, logout, sesión, recuperación de contraseña, **flujo de activación de 2FA**, manejo global 401/403/`two_factor_required`/`no_membership`, headers y CSP | F0; Q2, Q4, Q5 | ⚠️ (cuerpos de Better Auth no verificados) |
| **F2** | Autorización y shell | Catálogo de permisos, `can()`/`<Can>`, navegación por permisos, layout, `DataTable`, estados vacío/error/sin permiso | F1 | ✅ |
| **F3** | Revisión de agencias | Listado por estado (cursor), detalle, aprobar / devolver / rechazar con motivo y 2FA | F2 | ✅ |
| **F4** | Miembros | Listado por agencia, terminar miembro (`last_broker`) | F3 | ⚠️ sin paginación y sin `allowedActions` de miembros (se decide por permisos + `status`) |
| **F5** | Inmuebles (solo lectura) | Listado con filtros en URL, ficha, historial, descarga de soporte, terminar encargo | F2 | ⚠️ lista sin esquema (tipado a mano, `B-n`); sin búsqueda de texto; mostrar nombre de `territorialUnitCode` requiere solución (§10 Q6) |
| **F6** | Consola de plataforma | Ver/publicar configuración de un país (host `admin.api`) | F1, F2; Q3 | ⚠️ sin `/me` ni lista de países para `platform_operator`; el `code` se configura |
| **F7** | Dashboard | — | endpoints de métricas | 🚫 |
| **F8** | Auditoría | — | endpoint de auditoría | 🚫 |
| **F9** | Hardening y observabilidad | e2e de flujos críticos, accesibilidad, rendimiento (bundle, Web Vitals), revisión de seguridad, monitoreo de errores | F1–F6 | ✅ |
| **F10** | Preparación multi-rol *(solo diseño)* | Spec del portal Inmobiliaria/Agente reutilizando features con alcance por organización | F2, F5 | ✅ |

**Orden sugerido:** F0 → F1 → F2 → F3 → F4 → F5 → F6 → F9 → F10. F7 y F8 se retoman cuando el backend exponga los endpoints.

### Pedidos al backend (formato `B-n`)

| Id | Pedido | Bloquea / afecta |
|---|---|---|
| B-11 | Declarar esquema de respuesta de `GET /v1/properties`, `GET /v1/properties/{id}/media`, `POST /v1/media/{id}/complete` y `GET/PUT /v1/admin/tenants/{code}/config` en OpenAPI (verificado en `openapi.json`) | Evita Zod a mano en F5 y F6 |
| B-12 | Endpoints de métricas del sistema | F7 |
| B-13 | Endpoint de consulta de auditoría | F8 |
| B-14 | `/me` (o equivalente) y lista de países para `platform_operator` en `admin.api` | F6 |
| B-15 | `allowedActions` en agencia, miembros e invitaciones (ya pendiente en el contexto, §7) | F3/F4 |
| B-16 | Consulta de nombre por `territorialUnitCode` | F3/F5 |
| B-17 | Publicación versionada del `openapi.json` fuera del artefacto de CI | F0 |
| B-18 | `GET /me` (o un campo `platformRole`) en `admin.api`: el `platform_operator` inicia sesión por la misma ruta `/v1/auth/sign-in/email`, pero hoy el frontend no puede saber su rol ni sus países sin probar endpoints. Precisa B-14 | F6 |

> La numeración continúa la serie del contexto (B-1…B-10). Es **Mi propuesta**; se confirma al registrarlos.

---

## 10. Preguntas abiertas

| # | Pregunta | Afecta |
|---|---|---|
| Q1 | ¿Cuál es el conjunto exacto de permisos de `admin` y `compliance`? Se confirma leyendo `/me` de usuarios reales. | F2, F3, F4, F5 |
| Q2 | ~~Nombres y cuerpos exactos de las rutas de Better Auth (`two-factor/enable`, `verify-totp`, `generate-backup-codes`, reset). Forma de un 429 de auth.~~ **Resuelta en F1** leyendo `better-auth@1.7.14` y con la sesión `backend`: `enable` y `generate-backup-codes` exigen `{password}`; los errores llegan como `{code, message}`; el 429 de auth es `{message}` con cabecera `X-Retry-After` (no problem+json). *Pendiente: confirmarlo contra el backend en marcha (`e2e/auth.spec.ts`).* | F1 |
| Q3 | ¿Cómo establece sesión y se identifica el `platform_operator` en `admin.api`? No hay `/me` allí. ¿La cookie con `Domain=<BASE_DOMAIN>` sirve en ambos hosts (parece que sí, sin verificar)? | F1, F6 |
| Q4 | ~~Con el proxy de mismo origen, ¿qué `Origin` ve Better Auth?~~ **Resuelta en F1:** Better Auth valida el `Origin` que envía el navegador contra `FRONTEND_ORIGINS` (lista separada por comas; en producción, orígenes https). Un origen ajeno recibe 403 `INVALID_ORIGIN`. La cookie es `SameSite=lax`. *Pendiente: comprobar el 403 con `curl` contra el backend en marcha (CA19).* | F1, ADR-0003 |
| Q5 | ~~Duración de la sesión~~ **Resuelta en F1:** valores por defecto de Better Auth (7 días, renovación diaria); el panel no gestiona la expiración: un 401 lleva a login con la ruta de retorno. *Pendiente: confirmarlo con `get-session` en vivo.* | F1 |
| Q6 | Cómo mostrar el nombre de un `territorialUnitCode` guardado (no hay endpoint de consulta por código). | F3, F5 |
| Q7 | Cadencia de polling: no aplica al admin MLS (no sube multimedia); solo relevante en F10. | F10 |
| Q8 | Cómo obtiene el frontend el `openapi.json` versionado (artefacto de CI, release o copia manual). **Mi propuesta:** copia versionada en el repo + script, hasta que el backend publique (B-17). | F0 |
| Q9 | Sentry (o similar) para monitoreo de errores: ¿se usa? El contexto lo menciona sin spec. | F9 |
| Q10 | ~~Cómo se crean las cuentas de admin.~~ **Resuelta en F1:** `ops-cli` no crea usuarios; se registra la cuenta con `POST /v1/auth/sign-up/email` y se le da membresía con `pnpm ops member add co <correo> --role admin`. Procedimiento en el README. | F1, F9 |

---

## 11. Decisiones registradas (ADR)

| ADR | Tema | Estado |
|---|---|---|
| [0001](../adr/0001-estructura-del-proyecto.md) | Estructura del proyecto | Propuesto |
| [0002](../adr/0002-router.md) | Router | Propuesto |
| [0003](../adr/0003-autenticacion-y-sesion.md) | Autenticación y sesión | Aceptado (F1) |
| [0004](../adr/0004-modelo-de-permisos.md) | Modelo de permisos | Aceptado (F2) |
| [0005](../adr/0005-configuracion-de-runtime-docker.md) | Configuración de runtime en Docker | Propuesto |

---

## 12. Qué queda al implementador

Detalles que cada spec de fase resuelve sin volver al usuario: composición exacta de componentes, nombres de query keys, estructura interna de cada feature, presupuesto de bundle definitivo, elección de librería de gráficos (cuando exista F7), y convención de commits/ramas (se adopta la del contexto §15: Conventional Commits en español, un PR por incremento, **sin commit/push/merge sin aprobación**).
