# Contexto del backend para la sesión del frontend

> **Para quién:** la sesión de Claude que construirá el frontend de Innmo MLS en un repo aparte. No verá
> el repo del backend: este documento es todo lo que sabrá de él.
>
> **Base:** `origin/main` en el commit `c947947` (PR #75, 2026-10-31). Todo se leyó del código en ese
> commit (controllers, DTO Zod, `apps/core-api/openapi.json`, `ROLE_MAP`, `catalog.ts`, guards,
> interceptores de errores, `tenants/co.yaml`, `ops-cli`, `.env.example`, `docker-compose.yml`), no de
> la documentación. Donde la documentación contradice al código, manda el código y está en §16.
>
> **Convenciones de este documento:** «no encontrado» = lo busqué y no está; «no verificado» = no lo
> leí o depende de la librería (Better Auth) y no del código del repo. Los ejemplos JSON se construyeron
> a partir de los esquemas del `openapi.json` con datos ficticios.
>
> **Estado:** borrador para revisión. Sin commit.

---

## 1. Qué es el producto

Innmo MLS es un **MLS inmobiliario multi-país**: una red donde las inmobiliarias comparten inventario.
Cada país es un *tenant* con su propia base de datos y su propia configuración (moneda, zona horaria,
reglas con números, tipos de inmueble, formularios). El primer país es Colombia (`co`).

- Un **inmueble** se registra una sola vez en el país (por su matrícula) y varias inmobiliarias pueden
  tener un **encargo** sobre él. Quien lo registra primero queda como **editora**: la única que cambia
  los datos del inmueble.
- Cada encargo guarda **condiciones privadas** (precio neto, precio mínimo, comisión, contacto del
  propietario) que solo ve la inmobiliaria dueña del encargo.
- Toda persona entra por una **membresía** en un país, con un rol, ligada a una inmobiliaria (salvo el
  personal del MLS).

### Glosario (términos que aparecerán en la UI)

| Término | Significa |
|---|---|
| Inmobiliaria (`agency`) | Empresa miembro del MLS. Se registra (`pending`), el MLS la revisa y queda `active`. |
| Sede (`office`) | Oficina de una inmobiliaria. Toda inmobiliaria tiene una **sede principal** obligatoria. |
| Matrícula (`uniqueIdentifier`) | Identificador único del inmueble en Colombia (matrícula inmobiliaria, p. ej. `50C-1557984`). El país define la etiqueta (`uniqueIdentifierLabel`). |
| Estado del identificador | `definitive`, `provisional` (predio sin matrícula propia) o `alternate` (requiere aprobación). |
| Inmueble (`property`) | La ficha: tipo, ubicación, áreas, atributos, características, descripción. |
| Encargo (`mandate`) | Vínculo de una inmobiliaria con un inmueble para una operación (`sale` o `lease`), con fechas y tipo. |
| Exclusiva (`exclusive`) / no exclusiva (`non_exclusive`) | Tipo de encargo. Una exclusiva excluye otros encargos vigentes de la misma operación. |
| Editora | Inmobiliaria que puede editar los datos del inmueble. `editor` en el detalle. |
| Líder de operación | Inmobiliaria que fija el precio de lista de una operación (`sale`/`lease`). |
| Captador | Quien registró el encargo. Un `agent` solo modifica lo que captó. |
| Condiciones privadas (`privateTerms`) | Precio neto, mínimo, comisión y contacto del propietario. Solo las ve quien es dueño del encargo. |
| Precio de lista (`listPrices`) | Precio público por operación: `{ amountMinor, currency }`. |
| Miembro (`member`) | Persona con rol activo en una inmobiliaria o en el MLS. |
| Invitación | Forma de sumar personas a una inmobiliaria; el enlace trae un token. |
| Personal del MLS | Roles `admin` y `compliance`: sin inmobiliaria, ven toda la red. |

---

## 2. Usuarios y roles

El **front nunca compara roles**. Decide menús y rutas con `membership.permissions` de `GET /v1/me` y
los botones de cada recurso con `allowedActions` (§7). El rol (`membership.role`) sirve solo para
mostrarlo como texto.

Fuente: `ROLE_MAP` en `libs/shared/permissions/src/lib/role-map.ts`.

| Rol | Nivel | Se invita | Qué hace en la UI |
|---|---|---|---|
| `admin` | MLS (red) | No | Revisa inmobiliarias (aprobar, devolver con cambios, rechazar), lista toda la red, ve inmuebles y soporte de encargos, termina encargos y miembros de cualquier inmobiliaria. **Exige 2FA.** |
| `compliance` | MLS (red) | No | Solo lectura: inmuebles, soporte de encargos, inmobiliarias, miembros. |
| `broker` | Inmobiliaria | Sí | Administra su inmobiliaria: edita su solicitud, invita y gestiona miembros, crea y edita inmuebles y encargos, multimedia y documentos de toda su inmobiliaria. |
| `agent` | Inmobiliaria | Sí | Crea inmuebles y encargos; edita, termina encargos y maneja multimedia/documentos **solo de lo que captó** (alcance `own`). Puede renunciar. |
| `assistant` | Inmobiliaria | Sí | Como el broker en inmuebles/encargos/multimedia/documentos de su inmobiliaria, pero no administra miembros ni la solicitud de la inmobiliaria. Puede renunciar. |
| `read_only` | Inmobiliaria | Sí | Solo consulta (inmuebles de la red e información de su inmobiliaria). Puede renunciar. |
| `platform_operator` | Plataforma | No | Rol global (no es membresía de un país). Opera el plano de control en `admin.api.<dominio>`: ve y publica la configuración de un país. **Exige 2FA.** |
| `system` | Sistema | No | Solo los jobs del worker. Nunca llega al front. |

**Permisos** (`recurso.acción`) y alcances posibles. Alcances anidados: `own` < `agency` < `network`.

| Permiso | Alcances | Sensible (2FA) |
|---|---|---|
| `property.read` | network | No |
| `property.create` | agency | No |
| `property.update` | own, agency | No |
| `mandate.create` / `mandate.update` | agency | No |
| `mandate.terminate` | own, agency | No |
| `mandate.terminate_any` | network | **Sí** |
| `media.manage` / `document.manage` | own, agency | No |
| `document.read_support` | network | No |
| `agency.read` | agency, network | No |
| `agency.list` | network | No |
| `agency.update` / `agency.resubmit` | agency | No |
| `agency.approve` / `agency.request_changes` / `agency.reject` | network | **Sí** |
| `member.invite` / `member.update_role` | agency | No |
| `member.read` | agency, network | No |
| `member.terminate` | own, agency | No |
| `member.terminate_any` | network | **Sí** |
| `tenant_config.read` / `tenant_config.publish` | network | **Sí** |

Los permisos `media.process`, `upload.cleanup`, `outbox.*`, `audit.verify_chain`, `config_audit.deliver`
y `user_index.write` son del sistema y **nunca** aparecen en `/me`.

Quien tenga **cualquier permiso sensible** (`admin`, `platform_operator`) debe tener 2FA activo; sin él,
casi todas las rutas responden 403 `two_factor_required` (ver §6).

---

## 3. Hosts, entornos y desarrollo local

### Hosts

| Host | Para qué |
|---|---|
| `<país>.api.<dominio>` (p. ej. `co.api.localtest.me`) | API de un país. El país se resuelve por el `Host`. |
| `admin.api.<dominio>` | Plano de control (`@ControlPlaneRoute()`): solo `platform_operator`. Hoy: `GET/PUT /v1/admin/tenants/{code}/config`. |
| `app.<dominio>` | El frontend. |

`X-Tenant: <código>` sustituye al `Host` **solo fuera de producción**. En loopback (`localhost`,
`127.0.0.1`) Better Auth acepta la solicitud; con otro `Host` da 500.

El dominio base sale de la variable `BASE_DOMAIN` del backend (local: `localtest.me`; `localtest.me` y
todos sus subdominios resuelven a `127.0.0.1`).

### Levantar el backend en local

Requisitos: Docker, pnpm. Comandos (en el repo del backend):

```bash
cp .env.example .env            # y completar TENANT_SECRETS_MASTER_KEY y BETTER_AUTH_SECRET:
                                #   openssl rand -base64 32   (para cada una)
pnpm dev:up                     # Postgres+PostGIS, PgBouncer, SeaweedFS (S3), Mailpit
pnpm ops migrate --plane=control
pnpm ops tenant provision co
pnpm ops tenant activate co
pnpm nx serve core-api          # http://localhost:3000
pnpm nx serve worker            # health en :3001 (procesa multimedia, outbox y jobs)
```

El **worker es necesario** para el flujo de multimedia: es quien procesa las imágenes (§9.1).

| Servicio | Puerto local |
|---|---|
| core-api | 3000 |
| worker (health) | 3001 |
| Postgres (admin, directo) | 5432 |
| PgBouncer (app) | 6432 |
| SeaweedFS (S3) | 8333 (otro puerto interno 23646) |
| Mailpit SMTP / bandeja | 1025 / **http://localhost:8025** |
| Swagger UI | `http://localhost:3000/v1/docs` · JSON: `/v1/docs/json` |

### Usuarios de prueba

No hay seeds de usuarios (no encontrado). Se crean en dos pasos, con comandos de `ops-cli`
(`pnpm ops ...`):

1. **Registrar la cuenta** vía API: `POST /v1/auth/sign-up/email` (contraseña mínimo **12** caracteres).
2. **Darle membresía o rol** con ops-cli:

```bash
# Inmobiliaria activa con su sede principal (devuelve ids; --city = código de municipio)
pnpm ops agency add co --trade-name "Inmobiliaria Demo" --legal-name "Demo S.A.S." \
  --office-name "Sede Principal" --city <código-municipio> --tax-id-type NIT --tax-id <NIT-con-DV>
pnpm ops agency list co

# Membresía (roles: admin, compliance, broker, agent, assistant, read_only)
pnpm ops member add co broker@demo.test --role broker --agency <agencyId>
pnpm ops member add co agent@demo.test  --role agent  --agency <agencyId>
pnpm ops member add co admin@demo.test  --role admin            # sin --agency (personal del MLS)

# Operador de plataforma (rol global)
pnpm ops user grant-operator operador@demo.test
```

`admin` y `platform_operator` necesitan **activar 2FA** antes de usar casi cualquier ruta (§5). Los
códigos de municipio salen de `GET /v1/territory/units/co/municipality?q=...`.

### Configuración que necesita el front local

Variables del `.env` del **backend** (el front no las lee, pero deben apuntar al front):

| Variable | Valor local | Uso |
|---|---|---|
| `FRONTEND_ORIGINS` | `http://app.localtest.me:5173` | CORS (con `credentials: true`) y CSRF de Better Auth. Varios, separados por coma. |
| `INVITATION_ACCEPT_URL` | `http://app.localtest.me:5173/invitaciones/aceptar` | Página donde se acepta una invitación; el correo agrega `#token=<token>`. |
| `PASSWORD_RESET_URL` | `http://app.localtest.me:5173/restablecer` | Página donde se elige la contraseña nueva; el correo agrega `#token=<token>` (según `docs/development/frontend-local.md`; no verifiqué el mailer). |

- **El front local debe correr en `http://app.localtest.me:5173`, no en `localhost`.** La cookie de sesión
  lleva `Domain=localtest.me` (`crossSubDomainCookies`), se comparte entre `app.` y `<país>.api.`.
- El host del front es siempre una variable, nunca fijo en el código.
- **Proxy recomendado de Vite** (el navegador solo habla con el origen del front; el país va en `X-Tenant`):

```ts
// vite.config.ts
export default defineConfig({
  server: {
    host: 'app.localtest.me',
    port: 5173,
    proxy: { '/v1': { target: 'http://localhost:3000', headers: { 'X-Tenant': 'co' } } },
  },
});
```

- Los correos (recuperación de contraseña, invitaciones) se leen en Mailpit: `http://localhost:8025`.
- S3 local: SeaweedFS en `http://localhost:8333`, bucket `innmo-local`. Las URL firmadas de subida
  apuntan ahí; el front hace el `PUT` directo a esa URL.
- Datos de prueba: el único dato sembrado es el catálogo del país (`co`): 33 departamentos y 1.122
  municipios (DIVIPOLA), tipos de inmueble y características de `tenants/co.yaml`.

---

## 4. Contrato

- **Archivo:** `apps/core-api/openapi.json` en el repo del backend (5077 líneas). También en vivo:
  `GET /v1/docs/json` del backend corriendo.
- **Desde el repo del front:** el CI del backend sube el contrato como artefacto de GitHub Actions
  llamado `openapi` (carpeta `dist/openapi/`, archivo `core-api.json`). No encontré una publicación
  versionada fuera de CI; habrá que acordar si el front lo descarga del artefacto, de un release, o lo
  copia a mano.
- **Cuándo cambia:** cada PR que cambia la API actualiza `openapi.json` con `pnpm openapi:update`; el CI
  falla si el contrato generado difiere del guardado. Los cambios de forma son **aditivos** por
  política (no se cambian rutas, códigos, cuerpos ni permisos sin decisión explícita).
- **Cambios que rompen:** no hay `oasdiff` automatizado todavía (figura en el ROADMAP). Hay que
  comparar el diff del `openapi.json` entre versiones.
- **Lo que el contrato NO describe aún:**
  - `GET /v1/properties` responde 200 **sin esquema** (ver §8.4 para su forma).
  - `GET /v1/properties/{id}/media` y `POST /v1/media/{id}/complete` responden 200 sin esquema (§9.1).
  - Las rutas `/v1/auth/*` aparecen como comodines (`{path}`); son de Better Auth.
  - El esquema `ProblemDetails` **sí** existe e incluye el enum completo de `code` (§10).

### Convenciones

| Tema | Convención |
|---|---|
| Ids | UUID v7 (`string<uuid>`). |
| Dinero | `{ "amountMinor": "250000000000", "currency": "COP" }`. **`amountMinor` es un string** de dígitos (`^\d{1,18}$`), en unidades menores de la moneda; nunca number. |
| Instantes | ISO-8601 UTC (`string<date-time>`), p. ej. `2026-10-31T16:11:16.000Z`. |
| Fechas calendario | `string<date>` (`YYYY-MM-DD`), en la zona horaria del país (fechas del encargo). |
| Áreas | `number`, en la unidad del país (`areaUnit`: `m2` o `ft2`). |
| Paginación | Por cursor y **opaca**: `?limit=` (1–100, por defecto 20) y `?cursor=`; respuesta `{ items, nextCursor }`, `nextCursor: null` en la última página. Cursor inválido: 400 `invalid_cursor`. |
| Comisión | `{ "kind": "percent" \| "amount", "value": "3.5" }`, `value` string con hasta 4 decimales. |
| Errores | `application/problem+json` (§10). |
| Idioma | Los títulos de error salen en español de Colombia (`es-CO`). |

---

## 5. Autenticación

Better Auth montado en **`/v1/auth/*`** (`basePath: '/v1/auth'`), sobre el host del país o de
`admin.api.<dominio>`. La identidad es **global** (una cuenta sirve para todos los países; la membresía
es por país).

### Cliente

Usar `better-auth/react` con `baseURL` hacia la API y `basePath: '/v1/auth'`, con el plugin
**`twoFactorClient`** (la API usa los plugins `twoFactor` y `bearer`). Las solicitudes llevan
`credentials: 'include'` (cookie) y el proxy de Vite las manda al país.

### Registro e inicio de sesión

- **Registro:** correo + contraseña, abierto (no encontré `disableSignUp`). Contraseña mínima: **12
  caracteres** (`minPasswordLength: 12`). No hay verificación de correo obligatoria (no encontrado).
- **Inicio de sesión:** correo + contraseña.
- **Cookie:** `httpOnly`, `sameSite: 'lax'`, `Domain=<BASE_DOMAIN>` (compartida entre `app.` y
  `<país>.api.`), `Secure` solo en producción.
- **Bearer:** el plugin `bearer` permite `Authorization: Bearer <token>` para clientes que no son
  navegador. La SPA debe usar la cookie.
- **Duración de la sesión:** no configurada en el código; vale el valor por defecto de Better Auth
  (7 días con renovación diaria) — no verificado en la librería.
- **Cierre de sesión / sesión actual:** rutas estándar de Better Auth (`sign-out`, `get-session`).

### Recuperación de contraseña

- Solicitud: ruta estándar de Better Auth `request-password-reset`; el correo lleva un enlace a
  `PASSWORD_RESET_URL#token=<token>` que **vence en una hora** (texto del correo).
- Restablecer: `reset-password` con el token y la contraseña nueva. Al restablecer **se revocan todas las
  sesiones** (`revokeSessionsOnPasswordReset: true`).

### Límite de intentos (guardado en base, vale entre instancias)

| Ruta | Límite |
|---|---|
| `/sign-in/email` | 5 por minuto |
| `/two-factor/verify-totp` | 5 por minuto |
| `/request-password-reset` | 3 cada 5 minutos |
| Resto de rutas de auth | 100 por minuto |

Al excederlo: 429 (`rate_limited` en la forma de `problem+json` del backend; la respuesta de Better Auth
puede venir con su propia forma — no verificado).

### 2FA (TOTP)

Plugin `twoFactor` (emisor «Innmo MLS»). Rutas estándar de Better Auth: activar (`two-factor/enable`,
devuelve el URI TOTP y los **códigos de respaldo**), verificar el primer código
(`two-factor/verify-totp`), generar códigos de respaldo nuevos (`two-factor/generate-backup-codes`),
verificar con respaldo (`two-factor/verify-backup-code`), desactivar. El nombre exacto y el cuerpo de
cada una **no están en este repo**: se toman de la documentación/cliente de Better Auth.

Reglas del backend (verificadas en `PermissionsGuard`):

- El estado vive en `user.twoFactorEnabled` (de `GET /v1/me` y de la sesión).
- **Quien tenga un permiso sensible** (`admin`, `platform_operator`) y **no** tenga 2FA activo recibe
  **403 `two_factor_required`** en cualquier ruta de país (aunque la ruta no pida permiso) y en las del
  plano de control. **Esto incluye `GET /v1/me`** para un `admin` sin 2FA: la respuesta no trae el
  `membership`. El front debe llevarlo a activar 2FA al ver ese 403.
- `membership.twoFactorRequired` en `/me` solo **informa** (el rol tiene permisos sensibles). Llega
  cuando la persona ya cumple el requisito.

### Qué pasa al perder la membresía

- La **sesión sigue viva**: es global.
- Las rutas del país responden **403 `no_membership`** (salvo las `MembershipOptional`: `/v1/me`,
  `/v1/me/tenants`, `POST /v1/agencies`, `POST /v1/invitations/accept`, territorio).
- El backend guarda la membresía encontrada **5 segundos** en caché: una suspensión o terminación puede
  tardar hasta 5 s en surtir efecto. La ausencia de membresía no se cachea.
- `GET /v1/me` en ese caso devuelve `membership: null`.

---

## 6. Entrada a la app

### `GET /v1/me`

Cualquier sesión (no exige membresía). Ejemplo para un `broker` (construido desde `MeResponse`):

```json
{
  "user": {
    "id": "0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "email": "broker@demo.test",
    "name": "Ana Demo",
    "twoFactorEnabled": false
  },
  "tenant": { "code": "co", "name": "Colombia", "configVersion": 1 },
  "membership": {
    "role": "broker",
    "agencyId": "0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c",
    "agencyStatus": "active",
    "permissions": {
      "agency.read": "agency",
      "agency.resubmit": "agency",
      "agency.update": "agency",
      "document.manage": "agency",
      "mandate.create": "agency",
      "mandate.terminate": "agency",
      "mandate.update": "agency",
      "media.manage": "agency",
      "member.invite": "agency",
      "member.read": "agency",
      "member.terminate": "agency",
      "member.update_role": "agency",
      "property.create": "agency",
      "property.read": "network",
      "property.update": "agency"
    },
    "twoFactorRequired": false
  },
  "config": {
    "currency": "COP",
    "timezone": "America/Bogota",
    "locale": "es-CO",
    "areaUnit": "m2",
    "uniqueIdentifierLabel": "Matrícula inmobiliaria"
  }
}
```

- Sin membresía: `"membership": null`.
- Personal del MLS (`admin`, `compliance`): `membership.agencyId` y `agencyStatus` son `null`; `permissions`
  trae los suyos.
- `permissions` es un mapa `permiso → alcance` ordenado por nombre; **un permiso ausente = no lo tiene**.
- `/me` de `platform_operator` (host `admin.api.<dominio>`): **no encontrado**. `MeController` vive en el
  host de país; no vi una ruta equivalente para el plano de control.

### `GET /v1/me/tenants`

Funciona en **cualquier host** (no necesita país) y sin membresía; solo sesión. Sirve para elegir país.

```json
[{ "code": "co", "name": "Colombia", "apiHost": "co.api.localtest.me" }]
```

Sale de `user_tenant_index` + tenants activos. Se llena cuando la persona registra una inmobiliaria o
acepta una invitación. **Limitación conocida:** nada lo limpia hoy cuando se pierde la membresía
(`member_removed` se publica pero nadie lo consume en `main`), así que puede listar países donde la
persona ya no tiene membresía; el siguiente `/v1/me` en ese país devolverá `membership: null`.

### Qué hacer ante cada respuesta

| Respuesta | Qué hace el front |
|---|---|
| **401** `unauthorized` | No hay sesión: llevar a iniciar sesión (guardar la ruta de retorno). |
| **403** `no_membership` | Sesión sin membresía en este país: pantalla de registro de inmobiliaria (`POST /v1/agencies`) o aceptar una invitación. |
| **403** `two_factor_required` | El rol exige 2FA y no está activo: llevar a activarlo; reintentar al terminar. |
| **403** `agency_not_active` | La inmobiliaria no está `active` (`pending`, `changes_requested`, `rejected`, …): mostrar el estado de la solicitud (`GET /v1/agencies/{id}`) y, si corresponde, editarla y reenviarla. No hay acceso a inmuebles. |
| **403** `role_not_allowed` / `insufficient_role` / `not_*` | La acción no corresponde al rol/relación: ocultar el botón (debió venir `allowedActions: false`); si llegó, mostrar el título del error. |
| **404** `property_not_found` / `mandate_not_found` / … | Fuera de alcance o no existe: **se responde igual** para no revelar existencia. Mostrar «no encontrado». |
| **404** `tenant_not_found` | El host o `X-Tenant` no corresponde a un país: revisar configuración. |
| **503/`tenant_unavailable`** | El país no está activo/disponible: mensaje de mantenimiento. |
| **429** `rate_limited` | Pedir esperar unos minutos. |

---

## 7. Autorización para la UI

### Forma de `permissions`

`membership.permissions: Record<Permiso, 'own' | 'agency' | 'network'>`. Alcance:

- `own`: solo lo propio (lo que captó la persona, o ella misma).
- `agency`: todo lo de su inmobiliaria.
- `network`: toda la red del MLS.

Uso: **los permisos deciden menús y rutas** (p. ej. mostrar «Revisión de agencias» si existe
`agency.list`; «Equipo» si existe `member.read`; «Nuevo inmueble» si existe `property.create`).

### `allowedActions` por recurso

Calculado por el servidor con las mismas reglas que los casos de uso. **Informativo:** cada acción se
vuelve a verificar al ejecutarse. **Los botones de cada recurso se deciden con `allowedActions`.**

Hoy existe en el **detalle del inmueble** (`GET /v1/properties/{id}`), en sus encargos y documentos:

```json
{
  "allowedActions": {
    "update": true,
    "manageMedia": true,
    "manageDocuments": true,
    "linkMandate": true,
    "setListPrice": { "sale": true, "lease": false }
  },
  "mandates": [
    { "id": "…", "allowedActions": { "terminate": true, "updatePrivateTerms": true } }
  ],
  "documents": [
    { "id": "…", "allowedActions": { "remove": false } }
  ]
}
```

| Recurso | Campos | Se refleja en |
|---|---|---|
| Inmueble | `update`, `manageMedia`, `manageDocuments`, `linkMandate`, `setListPrice.{sale,lease}` | Editar ficha, multimedia, documentos, vincular encargo, fijar precio por operación |
| Encargo | `terminate`, `updatePrivateTerms` | Terminar encargo, editar condiciones privadas |
| Documento | `remove` | Eliminar documento (refleja `remove-document`) |

**Aún no existe en las respuestas** (el autorizador de `members` ya está en `main`, PR #75, pero no lo
exponen los DTO): `allowedActions` de **agencia** (`update`, `resubmit`, `approve`, `requestChanges`,
`reject`), **miembros** (`updateRole`, `terminate`, considerando `last_broker`) e **invitaciones**
(`resend`, `cancel`). Hasta entonces el front decide esos botones con `permissions` y el `status` del
recurso, y trata el error del servidor como la fuente de verdad.

---

## 8. Endpoints por pantalla

Todas las rutas de país exigen sesión. «Quién» indica el permiso (cualquiera de los listados). «Cualquier
miembro» = `@AnyMember`: cualquier membresía activa; sus límites son las reglas de relación.
**Todas las rutas de `properties` exigen además que la inmobiliaria esté `active`** (si no: 403
`agency_not_active`); el personal del MLS pasa.

### 8.1 Onboarding de agencia (registro)

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `POST /v1/agencies` | Solo sesión (sin membresía) | `RegisterAgencyBody` | 201 `{ agency, warnings }` |
| `GET /v1/agencies/{id}` | Cualquier miembro (alcance: la suya; el MLS ve cualquiera) | — | 200 `AgencyApplicationResponse` |
| `PATCH /v1/agencies/{id}` | `agency.update` (broker) | `UpdateAgencyBody` (parcial) | 200 `{ agency, warnings }` |
| `POST /v1/agencies/{id}/resubmit` | `agency.resubmit` (broker) | — | 204 |

Cuerpo de registro (resumido):

```json
{
  "tradeName": "Inmobiliaria Demo",
  "legalName": "Demo S.A.S.",
  "taxIdType": "NIT",
  "taxId": "9001234567",
  "email": "contacto@demo.test",
  "phone": "+573001234567",
  "mainOffice": {
    "name": "Sede Principal",
    "territorialUnitCode": "11001",
    "address": "Calle 1 # 2-3",
    "location": { "lat": 4.711, "lng": -74.0721 }
  }
}
```

- Quien registra queda como `broker` de esa inmobiliaria, que nace `pending`.
- `warnings`: `[{ "code": "trade_name_in_use" }]` si ya existe otro nombre comercial igual (no bloquea).
- El `taxId` se valida con el dígito de verificación DIAN (NIT en Colombia).
- `attributes` (campos adicionales de la inmobiliaria) los define la configuración del país.
- Errores: 409 `tax_id_in_use`, 409 `already_member`, 409 `agency_not_editable`, 409 `agency_not_reviewable`,
  422 `invalid_tax_id`, 422 `unknown_territorial_unit`, 422 `invalid_agency_attributes`.

### 8.2 Revisión de agencias (personal del MLS)

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `GET /v1/agencies?status=&limit=&cursor=` | `agency.list` (admin, compliance) | — | 200 `{ items: AgencySummary[], nextCursor }` |
| `POST /v1/agencies/{id}/approve` | `agency.approve` (admin, **2FA**) | — | 204 |
| `POST /v1/agencies/{id}/request-changes` | `agency.request_changes` (admin, **2FA**) | `{ "reason": "…" }` (1–2000) | 204 |
| `POST /v1/agencies/{id}/reject` | `agency.reject` (admin, **2FA**) | `{ "reason": "…" }` | 204 |

Item de la lista: `{ id, tradeName, legalName, taxIdType, taxId, status, submittedAt }`.
Errores: 409 `agency_not_reviewable`, 422 `review_reason_required`, 404 `agency_not_found`.

Al aprobar, la inmobiliaria pasa a `active`. Al rechazar, **se terminan las membresías activas** de esa
solicitud: la persona queda sin acceso y **no hay forma de que vea el motivo por la API** (pregunta 3.15
al bróker, abierta; §13). Al devolver con cambios, el motivo sí se ve en `reviewReason` de
`GET /v1/agencies/{id}`.

### 8.3 Equipo e invitaciones

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `GET /v1/agencies/{agencyId}/members` | `member.read` | — | 200 `MemberResponse[]` (**sin paginar**) |
| `PATCH /v1/members/{memberId}/role` | `member.update_role` (broker) | `{ "role": "…" }` | 204 |
| `POST /v1/members/{memberId}/terminate` | `member.terminate` (mín. alcance `agency`) o `member.terminate_any` | `{ "reason"?: "…" }` (1–1000) | 204 |
| `POST /v1/members/me/leave` | Cualquier miembro | — | 204 (renunciar) |
| `POST /v1/agencies/{agencyId}/invitations` | `member.invite` | `InviteMemberBody` | 201 `{ invitation, warnings }` |
| `GET /v1/agencies/{agencyId}/invitations` | `member.invite` | — | 200 `{ items, nextCursor }` |
| `POST /v1/agencies/{agencyId}/invitations/{invitationId}/resend` | `member.invite` | — | 200 `{ invitation, warnings }` |
| `POST /v1/agencies/{agencyId}/invitations/{invitationId}/cancel` | `member.invite` | — | 204 |
| `POST /v1/invitations/preview` | **Público** (sin sesión) | `{ "token": "…" }` | 200 `InvitationPreview` |
| `POST /v1/invitations/accept` | Solo sesión (sin membresía) | `{ "token": "…" }` | 201 `{ memberId, agencyId, role }` |

```json
// POST /v1/agencies/{agencyId}/invitations
{ "email": "agente@demo.test", "fullName": "Luis Demo", "role": "agent", "officeId": "…" }
// → 201
{
  "invitation": {
    "id": "…", "agencyId": "…", "officeId": null, "email": "agente@demo.test",
    "fullName": "Luis Demo", "role": "agent", "status": "pending",
    "expiresAt": "2026-11-07T16:11:16.000Z", "invitedByUserId": "…", "createdAt": "2026-10-31T16:11:16.000Z"
  },
  "warnings": [{ "code": "email_not_sent" }]
}
```

- Roles invitables: `broker`, `agent`, `assistant`, `read_only` (las otras dan 422 `role_not_invitable`).
  El esquema del cuerpo lista los seis roles; el servidor rechaza `admin` y `compliance`.
- `warnings: email_not_sent` = la invitación se creó pero el correo no salió (usar `resend`).
- `MemberResponse`: `{ memberId, userId, fullName, email, role, officeId, status: active|suspended|terminated, since }`.
- Errores: 409 `invitation_already_pending`, `invitation_not_pending`, `invitation_expired`, `last_broker`,
  `member_not_active`, `office_not_available`; 403 `invitation_email_mismatch`; 422 `invalid_invitation_email`,
  `termination_reason_required`; 404 `invitation_not_found`, `member_not_found`.
- Flujo de invitación (enlace, preview, aceptación): §9.5.

### 8.4 Inventario

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `GET /v1/properties?propertyType=&status=&territorialUnitCode=&agencyId=&limit=&cursor=` | Cualquier miembro | — | 200 `{ items: PropertyListItem[], nextCursor }` (**sin esquema en OpenAPI**) |
| `GET /v1/properties/{id}` | Cualquier miembro | — | 200 `PropertyDetailResponse` |
| `POST /v1/properties` | `property.create` | `RegisterPropertyBody` | 201 `{ propertyId, mandateId, possibleDuplicates }` |
| `PATCH /v1/properties/{id}` | `property.update` | `UpdatePropertyBody` (parcial) | 204 |
| `PUT /v1/properties/{id}/list-prices/{operation}` | `property.update` | `{ "amountMinor": "…" }` | 204 |
| `POST /v1/properties/{id}/mandates` | `mandate.create` | `LinkMandateBody` | 201 `{ mandateId }` |
| `PATCH /v1/mandates/{id}/private-terms` | `mandate.update` | `PrivateTermsBody` | 204 |
| `POST /v1/mandates/{id}/terminate` | `mandate.terminate` o `mandate.terminate_any` | — | 204 |

`{operation}` = `sale` o `lease`.

**Item de la lista** (`PropertyListItemView`, no está en OpenAPI):

```json
{
  "id": "…", "uniqueIdentifier": "50C-1557984", "propertyType": "apartment", "status": "draft",
  "territorialUnitCode": "11001", "address": "Calle 1 # 2-3",
  "editorAgencyId": "…", "createdAt": "2026-10-31T16:11:16.000Z"
}
```

Aviso: el `agencyId` del filtro lo manda el cliente (inconsistencia conocida del backend, §16).

**Registro** (`POST /v1/properties`): crea el inmueble **y** su primer encargo a la vez.

```json
{
  "propertyType": "apartment",
  "territorialUnitCode": "11001",
  "address": "Calle 1 # 2-3",
  "addressVisibility": "approximate",
  "location": { "latitude": 4.711, "longitude": -74.0721 },
  "builtArea": 78.5,
  "attributes": { "bedrooms": 3, "bathrooms": 2, "stratum": "4" },
  "features": ["elevator", "security"],
  "description": "Apartamento remodelado",
  "uniqueIdentifier": "50C-1557984",
  "listPriceMinor": "35000000000",
  "mandate": {
    "operation": "sale",
    "type": "exclusive",
    "startDate": "2026-11-01",
    "endDate": "2027-05-01",
    "visitInstructions": "Coordinar con portería",
    "privateTerms": {
      "netPriceMinor": "33000000000",
      "commission": { "kind": "percent", "value": "3" },
      "ownerContact": { "name": "Carlos Propietario", "phone": "+573001112233" }
    }
  }
}
```

- `listPriceMinor` es COP en centavos de unidad menor (string).
- Respuesta 201: `{ "propertyId": "…", "mandateId": "…", "possibleDuplicates": ["<uuid>", …] }`.
  `possibleDuplicates` lista inmuebles parecidos (aviso, no bloquea) — ver §9.6.
- 409 `property_already_registered` **trae `details.propertyId`** (la matrícula ya existe): llevar al
  usuario a vincular su encargo a ese inmueble con `POST /v1/properties/{id}/mandates`.
- Errores: 422 `invalid_identifier`, `unknown_property_type`, `operation_not_enabled`,
  `unknown_territorial_unit`, `invalid_attributes`, `invalid_features`, `mandate_too_short`,
  `mandate_not_started`, `mandate_already_expired`; 409 `exclusive_mandate_conflict`,
  `mandate_conflict_with_exclusive`, `mandate_already_active`; 403 `not_property_editor`,
  `not_operation_leader`, `not_mandate_creator`, `not_mandate_owner`.
- En Colombia hoy solo está habilitada la operación **`sale`** (`operations: [sale]`); `lease` da 422
  `operation_not_enabled`.

**Detalle** (`GET /v1/properties/{id}`): forma completa en el `openapi.json` (`PropertyDetailResponse`).
Resumen de campos: `id`, `uniqueIdentifier`, `identifierLabel`, `identifierStatus`, `propertyType`,
`status`, `territorialUnitCode`, `address`, `addressVisibility`, `location`, `builtArea`, `landArea`,
`areaUnit`, `attributes`, `features`, `description`, `editor {id,name}|null`, `listPrices[]`, `mandates[]`
(con `mine`, `active`, `privateTerms` **solo si es de tu inmobiliaria**), `history[]`
(`list_price`/`status`/`editor`), `media`, `documents[]`, `allowedActions`.

Notas de visibilidad:
- `mandates[].privateTerms` aparece **solo** en los encargos de la inmobiliaria de quien consulta.
- `documents[]` incluye solo los que quien consulta puede ver (`visibility`: `agency` o
  `property_agencies`; el personal del MLS ve el soporte con `document.read_support`).
- `media.pending[]` solo lo ve la editora; el resto ve `photos` y `floorPlans`.
- Los enlaces `media.*.variants[].url` son firmados y vencen; no se guardan.

**Precio de lista:** lo fija **solo la inmobiliaria líder de la operación** (error 403
`not_operation_leader`); el mismo precio no genera cambio.

### 8.5 Multimedia

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `POST /v1/properties/{id}/media/uploads` | `media.manage` | `{ kind: photo\|floor_plan, contentType, size }` | 201 `UploadTicket` |
| `POST /v1/media/{id}/complete` | `media.manage` | — | 200 `{ status }` |
| `GET /v1/properties/{id}/media` | Cualquier miembro | — | 200 `PropertyMediaView` |
| `PUT /v1/properties/{id}/media/order` | `media.manage` | `{ kind, mediaIds: [uuid] (≤200) }` | 204 |
| `DELETE /v1/media/{id}` | `media.manage` | — | 204 |
| `PUT /v1/properties/{id}/media-links` | `media.manage` | `{ links: [{ kind: video\|virtual_tour, url }] (≤10) }` | 204 |

Flujo y estados: §9.1. Errores: 422 `unsupported_file_type`, `file_too_large`, `upload_mismatch`,
`invalid_media_link` (debe ser `https`), `invalid_media_order` (debe incluir cada imagen una sola vez);
409 `upload_missing`; 404 `media_not_found`.

### 8.6 Documentos

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `POST /v1/properties/{id}/documents/uploads` | `document.manage` | `DocumentUploadBody` | 201 `UploadTicket` |
| `POST /v1/documents/{id}/complete` | `document.manage` | — | 204 |
| `GET /v1/documents/{id}/download` | Cualquier miembro (con visibilidad) | — | 200 `{ url, expiresInSeconds, fileName, contentType }` |
| `DELETE /v1/documents/{id}` | `document.manage` | — | 204 |

`DocumentUploadBody`: `{ kind: mandate_support|property_certificate|deed|cadastral|other, mandateId?,
visibility?: agency|property_agencies, fileName, contentType, size }`. Flujo: §9.2.

### 8.7 Catálogos y definiciones

| Método y ruta | Quién | Salida |
|---|---|---|
| `GET /v1/property-types` | Cualquier miembro | 200 `{ items: [{ code, label }] }` (con `ETag`; 304) |
| `GET /v1/property-types/{code}/definitions` | Cualquier miembro | 200 `PropertyDefinitionsResponse` (con `ETag`; 304) |
| `GET /v1/territory/units/{país}/{nivel}?parent=&q=&limit=&cursor=` | Solo sesión | 200 `{ items: [{ code, name, level, parentCode }], nextCursor }` (con `ETag`; 304) |

Formularios dinámicos: §9.3. Territorio: §9.4.

### 8.8 Consola de plataforma (host `admin.api.<dominio>`)

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `GET /v1/admin/tenants/{code}/config` | `tenant_config.read` (`platform_operator`, **2FA**) | — | 200 configuración |
| `PUT /v1/admin/tenants/{code}/config` | `tenant_config.publish` (`platform_operator`, **2FA**) | `TenantConfigBody` | 200 |

Detalle del cuerpo en `TenantConfigBody` del `openapi.json`. Error: 404 `tenant_not_found`. El `403
platform_operator_required` sale si el usuario no tiene el rol global.

### 8.9 Salud

`GET /health` y `GET /ready` (públicos, sin tenant).

---

## 9. Flujos especiales

### 9.1 Subida de multimedia

1. **Pedir subida:** `POST /v1/properties/{id}/media/uploads` con `{ kind, contentType, size }`.
   Tipos: `image/jpeg`, `image/png`, `image/webp`; máximo **15 MB**. Respuesta (201):
   `{ id, uploadUrl, headers: { "content-type": "image/jpeg" }, expiresInSeconds: 600 }`.
2. **Subir a S3:** `PUT <uploadUrl>` con el cuerpo del archivo y **exactamente** el header
   `content-type` recibido (es parte de la firma). Sin cookies ni `Authorization`. La URL vence en
   **600 s**.
3. **Completar:** `POST /v1/media/{id}/complete`. El servidor verifica que el archivo exista y coincida
   (`upload_missing` 409 si no se subió; `upload_mismatch` 422 si tamaño/tipo no coinciden) y encola el
   procesamiento. Respuesta: `{ "status": "processing" }` (si ya estaba `ready` o `rejected`, devuelve
   ese estado).
4. **Esperar el procesamiento** (lo hace el worker): consultar `GET /v1/properties/{id}/media` (no
   `GET /v1/properties/{id}`) y mirar `pending[]` — solo la editora lo ve.
   - Estados de un archivo: `pending` (ticket creado, sin subir) → `processing` → `ready` | `rejected`.
   - Cuando está `ready` deja `pending[]` y aparece en `photos` o `floorPlans` con `variants[]`.
   - Cadencia de polling: **no hay una recomendada en el código** (no encontrado). Sugerencia: cada 2–3 s,
     con tope.
5. **Reordenar:** `PUT .../media/order` con **todos** los `mediaIds` del `kind`. **Eliminar:**
   `DELETE /v1/media/{id}`. **Enlaces** (video/recorrido): `PUT .../media-links`, solo `https`, máx. 10.

`photoRequirement { min, current, met }` indica el mínimo de fotos del tipo (config: 6 por defecto; 2
para `lot`; 4 para `farm`); "se exige al publicar", pero **no hay endpoint de publicación todavía**
(§13).

### 9.2 Documentos

1. `POST /v1/properties/{id}/documents/uploads` con `{ kind, mandateId?, visibility?, fileName, contentType, size }`.
   Tipos: `application/pdf`, `image/jpeg`, `image/png`; máximo **20 MB**. Respuesta igual que multimedia.
2. `PUT` a la `uploadUrl` (mismo trato que §9.1).
3. `POST /v1/documents/{id}/complete` (204). Antes de completar, descargar da 409 `document_not_ready`.
4. **Visibilidad:** `agency` (solo su inmobiliaria) o `property_agencies` (todas las inmobiliarias con
   encargo sobre el inmueble). El personal del MLS ve el soporte con `document.read_support`.
5. **Descarga:** `GET /v1/documents/{id}/download` → `{ url, expiresInSeconds: 300, fileName, contentType }`;
   abrir la `url` firmada (vence en 300 s) y no guardarla.
6. **Eliminar:** `DELETE /v1/documents/{id}`; se decide el botón con `documents[].allowedActions.remove`.

### 9.3 Formularios dinámicos

`GET /v1/property-types` da los tipos del país. `GET /v1/property-types/{code}/definitions` da el
formulario de un tipo (con `ETag`; enviar `If-None-Match` para 304):

```json
{
  "propertyType": { "code": "apartment", "label": "Apartamento" },
  "groups": [
    {
      "code": "interior", "label": "Interior",
      "fields": [
        { "code": "bedrooms", "label": "Habitaciones", "type": "integer", "required": true, "min": 0, "max": 30 },
        { "code": "stratum", "label": "Estrato", "type": "enum", "required": true,
          "options": [{ "code": "1", "label": "1" }, { "code": "2", "label": "2" }] }
      ],
      "features": [{ "code": "balcony", "label": "Balcón" }]
    }
  ]
}
```

- `groups[]` va en el orden en que se muestra (config `fieldGroups`); `help` opcional del grupo.
- Tipos de campo: `text | integer | number | boolean | enum | date`; `required`, `min`, `max`,
  `maxLength`, `options`.
- `features[]` de cada grupo solo trae las características que aplican al tipo (`appliesTo` se aplica en
  el servidor, no se envía).
- Los valores van en `attributes` (`Record<string, string | number | boolean>`) y las características en
  `features` (códigos). **Se validan en el servidor**: errores 422 `invalid_attributes` /
  `invalid_features` con `details.issues`. El front puede validar para ayudar, pero no es la autoridad.

### 9.4 Catálogo territorial

`GET /v1/territory/units/{país}/{nivel}`:

- `{país}` debe ser el del host (si no: 404 `tenant_not_found`); `{nivel}` es un nivel del país
  (`department`, `municipality` en Colombia; si no: 404 `territory_level_not_found`).
- `parent`: código de la unidad superior (para listar municipios de un departamento).
- `q`: **mínimo 3 letras** (si no: 400), busca en el nombre sin acentos ni mayúsculas, en cualquier parte.
- `limit`: 10 por defecto, máximo 100. `cursor` opaco. `ETag`/304.
- Solo exige sesión (no membresía): quien registra una inmobiliaria aún no la tiene.
- **Último nivel obligatorio:** la sede y el inmueble se guardan con el `territorialUnitCode` del nivel
  más bajo (municipio); si el código no corresponde a una unidad del país: 422
  `unknown_territorial_unit`. (Que sea exactamente el nivel más bajo, no lo verifiqué en el validador.)
- **Mostrar el nombre de un `territorialUnitCode` ya guardado:** no existe un endpoint de consulta por
  código (decisión abierta en la spec). Alternativas hoy: cachear los resultados de la búsqueda o buscar
  con `q`.

### 9.5 Invitaciones

1. Un `broker` invita (`POST /v1/agencies/{agencyId}/invitations`). El correo (Mailpit en local) lleva el
   enlace `INVITATION_ACCEPT_URL#token=<token>`. El token va en el **fragmento**, nunca en la ruta ni la
   query (no llega al servidor del front).
2. La página lee el token del fragmento y lo manda en el **cuerpo** (`POST /v1/invitations/preview`,
   público, sin sesión) para mostrar `{ agencyName, officeName, email, fullName, role, expiresAt }`.
3. La persona inicia sesión o crea la cuenta (correo y contraseña ≥ 12).
4. `POST /v1/invitations/accept` con `{ token }` **con sesión**: el correo de la cuenta debe coincidir con
   el de la invitación (si no, 403 `invitation_email_mismatch`). Respuesta 201: `{ memberId, agencyId, role }`.
5. Errores: 404 `invitation_not_found`, 409 `invitation_not_pending`, `invitation_expired`, `already_member`
   (ya tiene membresía activa en el país), 403 `agency_not_active`.
- Una persona tiene **una sola membresía activa por país**.

### 9.6 Avisos (`warnings`) y duplicados

- **Nombre comercial repetido:** `POST /v1/agencies` y `PATCH /v1/agencies/{id}` devuelven
  `warnings: [{ "code": "trade_name_in_use" }]`. No bloquea; la UI pregunta «¿es la misma empresa?».
- **Posibles duplicados de inmueble:** `POST /v1/properties` devuelve `possibleDuplicates: [uuid]` (no
  bloquea). La regla de qué cuenta como duplicado vive en el servidor.
- **Correo de invitación no enviado:** `warnings: [{ "code": "email_not_sent" }]`.

---

## 10. Errores

Forma (`application/problem+json`, RFC 9457, esquema `ProblemDetails`):

```json
{
  "type": "https://…/problems/property_already_registered",
  "title": "El inmueble ya está registrado en el MLS: vincule su encargo",
  "status": 409,
  "instance": "/v1/properties",
  "code": "property_already_registered",
  "requestId": "01JC…",
  "details": { "propertyId": "0192a3b4-…" }
}
```

- `code`: enumeración estable; **el front decide con `code`, no con el `title`** (el título es texto
  traducido).
- `errors[]` (solo validación, 400 `validation_failed`): `[{ "path": "mandate.endDate", "code": "…", "message": "…" }]`.
- `details`: datos del error (p. ej. `propertyId`, `issues`, `allowed`).
- `warnings` **no** es parte del error: viaja en respuestas exitosas (§9.6).
- `requestId`: citarlo al reportar un problema.

### Códigos transversales (plataforma, auth y guards)

| Código | HTTP | Título (es-CO) |
|---|---|---|
| `bad_request` | 400 | La solicitud no es válida |
| `validation_failed` | 400 | Los datos enviados no son válidos |
| `invalid_cursor` | 400 | El cursor de paginación no es válido o expiró |
| `unauthorized` | 401 | Debe iniciar sesión |
| `forbidden` | 403 | No tiene permiso para esta operación |
| `no_membership` | 403 | No tiene una membresía activa en este país |
| `platform_operator_required` | 403 | Solo el operador de la plataforma puede hacer esto |
| `two_factor_required` | 403 | Su rol exige la verificación en dos pasos |
| `role_not_allowed` | 403 | Su rol no permite esta acción |
| `agency_not_active` | 403 | Su inmobiliaria todavía no está activa |
| `not_found` | 404 | No se encontró el recurso |
| `tenant_not_found` | 404 | No hay un MLS en esta dirección |
| `territory_level_not_found` | 404 | El país no tiene ese nivel territorial |
| `tenant_unavailable` | 503* | El MLS de {tenantCode} no está disponible por ahora |
| `method_not_allowed` | 405 | El método no está permitido en este recurso |
| `conflict` | 409 | La operación entra en conflicto con el estado actual |
| `payload_too_large` | 413 | La solicitud es demasiado grande |
| `unsupported_media_type` | 415 | El tipo de contenido no es compatible |
| `rate_limited` | 429 | Demasiadas solicitudes. Intente de nuevo en unos minutos |
| `unavailable` | 503 | El servicio no está disponible por ahora |
| `internal` | 500 | Ocurrió un error inesperado. Ya lo estamos revisando |

\* El estado exacto de `tenant_unavailable` no lo verifiqué (el código lo lanza en `tenancy.http.ts`); el
resto de HTTP de esta tabla sale de `CODE_BY_STATUS` y de los guards. `agency_not_active` es 403 tanto
desde `ActiveAgencyGuard` como desde `members`.

### Códigos de `properties`

| Código | HTTP | Título (es-CO) |
|---|---|---|
| `property_not_found` | 404 | No existe el inmueble |
| `mandate_not_found` | 404 | No existe el encargo |
| `media_not_found` | 404 | No existe la imagen |
| `document_not_found` | 404 | No existe el documento |
| `property_already_registered` | 409 | El inmueble ya está registrado en el MLS: vincule su encargo |
| `exclusive_mandate_conflict` | 409 | No se puede registrar una exclusiva: el inmueble tiene otros encargos vigentes |
| `mandate_conflict_with_exclusive` | 409 | El inmueble tiene una exclusiva vigente para esta operación |
| `mandate_already_active` | 409 | Su inmobiliaria ya tiene un encargo vigente para esta operación |
| `mandate_not_active` | 409 | El encargo ya terminó |
| `upload_missing` | 409 | No se recibió el archivo: súbalo antes de confirmar |
| `document_not_ready` | 409 | El documento todavía no termina de subirse |
| `not_property_editor` | 403 | Solo la inmobiliaria editora puede cambiar los datos del inmueble |
| `not_operation_leader` | 403 | Solo la inmobiliaria que lidera la operación fija su precio de lista |
| `not_mandate_creator` | 403 | Un agente solo modifica los inmuebles y encargos que captó |
| `not_mandate_owner` | 403 | El encargo es de otra inmobiliaria |
| `insufficient_role` | 403 | Su rol no permite esta operación |
| `invalid_identifier` | 422 | El identificador del inmueble no tiene el formato del país |
| `unknown_property_type` | 422 | El tipo de inmueble no existe en el país |
| `operation_not_enabled` | 422 | La operación no está habilitada en el país |
| `unknown_territorial_unit` | 422 | La ubicación no corresponde a una unidad territorial del país |
| `invalid_attributes` | 422 | Los datos del tipo de inmueble no son válidos |
| `invalid_features` | 422 | Las características no son válidas para el tipo de inmueble |
| `mandate_too_short` | 422 | El encargo no alcanza la vigencia mínima del reglamento |
| `mandate_not_started` | 422 | La fecha de inicio del encargo aún no llega |
| `mandate_already_expired` | 422 | El encargo ya venció |
| `unsupported_file_type` | 422 | El tipo de archivo no está permitido |
| `file_too_large` | 422 | El archivo supera el tamaño permitido |
| `upload_mismatch` | 422 | El archivo recibido no coincide con el declarado |
| `invalid_media_link` | 422 | El enlace de video o recorrido debe ser una dirección https |
| `invalid_media_order` | 422 | El orden debe incluir cada imagen una sola vez |

### Códigos de `members`

| Código | HTTP | Título (es-CO) |
|---|---|---|
| `agency_not_found` | 404 | No existe la inmobiliaria |
| `office_not_found` | 404 | No existe la sede |
| `invitation_not_found` | 404 | No existe la invitación |
| `member_not_found` | 404 | No existe el miembro |
| `already_member` | 409 | Ya tiene una membresía activa en el país |
| `tax_id_in_use` | 409 | Ya hay una inmobiliaria registrada con ese documento tributario |
| `agency_not_reviewable` | 409 | La solicitud no admite esa revisión en su estado actual |
| `agency_not_editable` | 409 | La solicitud ya no se puede editar |
| `main_office_closed` | 409 | No se puede cerrar la sede principal: designe otra primero |
| `office_closed` | 409 | La sede está cerrada |
| `invitation_not_pending` | 409 | La invitación ya no está pendiente |
| `invitation_expired` | 409 | La invitación venció |
| `invitation_already_pending` | 409 | Ya hay una invitación pendiente para ese correo |
| `office_not_available` | 409 | La sede no está disponible |
| `last_broker` | 409 | La inmobiliaria no puede quedarse sin un broker activo |
| `member_not_active` | 409 | La membresía ya no está activa |
| `invitation_email_mismatch` | 403 | El correo de su cuenta no es el de la invitación |
| `insufficient_role` | 403 | Su rol no permite esta operación |
| `agency_not_active` | 403 | Su inmobiliaria todavía no está activa |
| `invalid_tax_id` | 422 | El documento tributario no es válido |
| `review_reason_required` | 422 | Falta el motivo de la revisión |
| `unknown_territorial_unit` | 422 | La ubicación no corresponde a una unidad territorial del país |
| `invalid_agency_attributes` | 422 | Los datos de la inmobiliaria no son válidos |
| `role_level_mismatch` | 422 | El personal del MLS no pertenece a una inmobiliaria y los demás roles sí |
| `invalid_invitation_email` | 422 | El correo de la invitación no es válido |
| `role_not_invitable` | 422 | No se puede invitar a ese rol |
| `termination_reason_required` | 422 | Falta el motivo de la terminación |

---

## 11. Estados y reglas visibles en la UI

La UI **no reimplementa** estas reglas: las explica y muestra el error del servidor.

### Estados y transiciones

**Agencia** (`status`: `pending | changes_requested | active | rejected | suspended | terminated`):

```
registro → pending ──approve──────────────→ active
              │  └──request-changes──→ changes_requested ──resubmit──→ pending
              └──reject──→ rejected (terminal)        changes_requested ──reject──→ rejected
```

- `approve` y `request-changes` solo desde `pending`; `resubmit` solo desde `changes_requested`;
  `reject` desde `pending` o `changes_requested`. Editar (`PATCH`) solo en `pending` o `changes_requested`.
- `suspended` y `terminated` existen como valores pero **no hay endpoint que lleve a ellos** (§13).

**Membresía** (`status`): `active | suspended | terminated`. Se termina por renuncia, por un broker o por
el MLS, o al rechazarse la inmobiliaria.

**Invitación** (`status`): `pending → accepted | cancelled | expired`. Vence a los **7 días**
(`INVITATION_TTL_DAYS = 7`); reenviarla renueva el plazo. El front usa `expiresAt`, no calcula nada.

**Encargo** (`status`): `active → terminated`. Además `active` (booleano) indica si hoy está vigente según
las fechas.

**Ficha del inmueble** (`status`: `draft | active | reserved | closed | suspended | withdrawn | expired`):
nace `draft`. **No hay endpoint que cambie el estado** en `main`; el cambio de estado no está implementado
(§13).

**Multimedia** (`status`): `pending → processing → ready | rejected`.

**Identificador** (`identifierStatus`): `definitive | provisional | alternate`.

### Reglas de negocio que el usuario verá (una línea cada una)

- **Exclusiva:** una exclusiva vigente impide otros encargos de la misma operación, y no se puede
  registrar una exclusiva si ya hay otros vigentes (`exclusive_mandate_conflict`,
  `mandate_conflict_with_exclusive`).
- **Un encargo vigente por inmobiliaria y operación** (`mandate_already_active`).
- **Vigencia mínima del encargo:** la define el país (`minMandateValidityDays`, hoy 90 días); menos da
  `mandate_too_short`. No se acepta un encargo que ya venció ni (para registrar) uno cuya fecha de inicio
  no ha llegado.
- **Editora:** solo la inmobiliaria editora cambia los datos del inmueble (`not_property_editor`). El
  editor vigente se ve en `editor`.
- **Precio de lista:** solo lo fija la inmobiliaria líder de la operación (`not_operation_leader`).
- **Alcance del `agent`:** solo modifica los inmuebles y encargos que captó (`not_mandate_creator`).
- **Condiciones privadas:** solo las ve y edita la inmobiliaria dueña del encargo (`not_mandate_owner`).
- **Mismo precio sin efecto:** fijar el mismo precio no genera cambio ni historial.
- **`last_broker`:** una inmobiliaria no puede quedarse sin un broker activo.
- **Un solo miembro activo por país** por persona (`already_member`).
- **Inmobiliaria no activa:** no usa ningún endpoint de `properties` (`agency_not_active`).
- **Mínimo de fotos:** lo define el país por tipo de inmueble (`photoRequirement`).
- **Nombre comercial repetido:** aviso, no bloqueo.
- **Rechazo de inmobiliaria:** definitivo; termina las membresías.

---

## 12. Configuración del país

Lo que el front recibe en `GET /v1/me` → `config`:

| Campo | Colombia (`co`) |
|---|---|
| `currency` | `COP` |
| `timezone` | `America/Bogota` |
| `locale` | `es-CO` |
| `areaUnit` | `m2` |
| `uniqueIdentifierLabel` | `Matrícula inmobiliaria` |

El resto de la configuración **no** va en `/me` (solo el plano de control la entrega completa). Lo
relevante, de `tenants/co.yaml`:

- **Formatos:** fecha `dd/MM/yyyy`; número con coma decimal y punto de miles. Distancia en `km`. (El
  front debe formatear con `Intl` y `config.locale`; los formatos no llegan por API.)
- **Operaciones habilitadas:** solo `sale` en la primera versión.
- **Tipos de inmueble:** `apartment`, `house`, `lot`, `retail`, `office`, `warehouse`, `farm`
  (llegan por `GET /v1/property-types`).
- **Territorio:** niveles `department` y `municipality` (DIVIPOLA/DANE).
- **Documentos tributarios de inmobiliaria:** `NIT`.
- **Reglas con números** (`rules`): `listingUploadBusinessDays: 2`, `minMandateValidityDays: 90`,
  `statusUpdateMaxHours: 24`, `closingReportDays: 5`, `correctionResponseDays: 5`,
  `certificateMaxAgeDays: 30`, `minPhotos: { default: 6, lot: 2, farm: 4 }`. **Estos valores no llegan
  por API al front** (el `/me` no los trae); solo se reflejan en `photoRequirement` y en los errores.

### Valores marcados `PENDIENTE` en `co.yaml`

- Patrón de la matrícula y el de la matrícula provisional (validar con certificados reales).
- Lista de tipos de documento de identidad (equipo legal).
- Campos configurables por tipo de inmueble (propuesta inicial, validar con inmobiliarias piloto).
- Clasificación de características y entorno (FP-7, 2.22).
- Reglas del operador (`rules`: valores iniciales de trabajo, RF-50).

Cualquiera de estos puede cambiar sin cambiar el contrato (son datos): el front no debe codificarlos.

---

## 13. Qué no existe todavía

La UI debe construirlo como «próximamente» o no construirlo:

- **Ciclo de vida de la ficha:** no hay publicar/reservar/cerrar/suspender/retirar ni cambio de `status`.
  Todas las fichas quedan `draft`.
- **Búsqueda de inmuebles:** el listado solo filtra por `propertyType`, `status`, `territorialUnitCode`,
  `agencyId` (búsqueda es el paso 5 del plan). No hay texto libre, rango de precios ni mapa.
- **Sedes:** no hay endpoints para crear, editar o cerrar sedes (solo la sede principal del registro y
  `officeId` en invitaciones).
- **Suspensión/terminación de agencias:** existen los estados, no los endpoints.
- **Logo de la inmobiliaria** y portal público.
- **Notificaciones en tiempo real:** no hay WebSockets ni SSE; el progreso se consulta (polling).
- **Operación `lease` (arriendo):** el contrato la acepta, pero Colombia solo habilita `sale`.
- **Paginación en `GET /v1/agencies/{agencyId}/members`:** devuelve la lista completa.
- **`allowedActions` de agencia, miembros e invitaciones** (§7).
- **`/me` del `platform_operator`:** no encontrado.
- **Pregunta abierta 3.15 al bróker (¿ve el motivo del rechazo quien fue rechazado?):** hoy no lo ve; pierde
  la membresía y el motivo queda en auditoría. Opción mínima propuesta (no implementada): que `/me`
  incluya `hasRejectedApplication: boolean`.
- **Consulta por código de una unidad territorial** (para mostrar el nombre de un `territorialUnitCode`).
- **Verificación de correo** y **códigos de respaldo en pantalla** dependen de Better Auth; no los
  configuré aquí.
- **`oasdiff`** para detectar cambios que rompen el contrato.

---

## 14. Decisiones del frontend (resumen)

> **No encontrado.** La spec del front que cita el prompt de origen (`2026-10-28-frontend-design.md`) no
> existe en `docs/superpowers/specs/` de `main`. Lo único relacionado es
> `2026-10-29-api-para-frontend-design.md`, que es sobre **la API**, no sobre el stack ni la
> arquitectura del front. Esta sección se completa cuando se aporte la spec del front.

Lo que sí se sabe por el backend (no por una spec del front):

- SPA React en repo aparte; consume `openapi.json`; **no compara roles ni reimplementa reglas**.
- Front en `app.<dominio>`; el país viaja en el host de la API (`<país>.api.<dominio>`) o en
  `X-Tenant` en desarrollo.
- El prompt de origen enumera el stack (React, Tailwind, Vite, TanStack Router/Query, cliente generado
  desde OpenAPI, cliente de Better Auth, shadcn/ui, TanStack Table, dnd-kit, Vitest, Testing Library,
  MSW, Playwright, Sentry; despliegue estático) y la arquitectura `app → routes → domains → shared`
  con el país en la URL (`/co/...`). **Es información del prompt, no verificada contra una spec.**

### Decisiones abiertas que la sesión del front debe resolver o preguntar

1. Cómo obtiene el front el `openapi.json` versionado (§4).
2. Cómo mostrar el nombre de un `territorialUnitCode` ya guardado (§9.4).
3. Cuál de las URL de `GET /v1/me/tenants` (`apiHost`) usar si un país tuviera varias.
4. Cadencia del *polling* de multimedia (§9.1).

---

## 15. Forma de trabajo

Para que la sesión del front trabaje igual que el repo del backend:

- **Flujo:** `brainstorming` → spec (`docs/superpowers/specs/`) → plan (`writing-plans`) → ejecución con
  `executing-plans` (ledger y `Ruling:`).
- **Ramas y commits:** prefijo = tipo de Conventional Commit (`feat/`, `fix/`, `docs/`, `chore/`,
  `refactor/`); commits en español con alcance (`feat(properties-api): …`); un PR por incremento;
  **sin commit, push ni merge sin aprobación**.
- **Idioma:** código, comentarios, commits y documentación en español.
- **Ahorro de tokens:** ejecución inline, sin subagentes salvo pedido, lectura mínima, narración mínima.
- **Reglas ambiguas:** preguntar; verificar antes de afirmar un defecto.
- **Cuando el front necesite algo del backend:** no inventarlo; anotarlo como pedido al backend con el
  formato `B-n` (como los ajustes B-1…B-10 de `2026-10-29-api-para-frontend-design.md`).
- **Skills y scripts del repo del backend que NO existen en el repo del front** (a crear o adaptar):
  `task-start` / `task-done`, las plantillas de spec y plan, el comando `.claude/commands/project-review`,
  el generador `pnpm g:domain` (específico de Nx del backend). No verifiqué la existencia exacta de
  `task-start`/`task-done` en el backend (no encontré esos nombres en `.claude/commands/`, que solo tiene
  `project-review`).

### Estado de los pedidos B-1 a B-10 (de `2026-10-29-api-para-frontend-design.md`)

| Pedido | Estado en `main` | Evidencia |
|---|---|---|
| B-1, B-5 `/me` con permisos y `twoFactorRequired` | **Hecho** | `me-membership.ts`, `MeResponse` |
| B-2 `allowedActions` en `properties` | **Hecho** | `PropertyDetailResponse.allowedActions`, `mandates[]`, `documents[]` |
| B-2 `allowedActions` en `members` | **Pendiente** | Autorizador en `main` (PR #75); sin DTO que lo exponga |
| B-3 `GET /v1/me/tenants` | **Hecho** | `me-tenants.controller.ts` |
| B-3 limpieza de `user_tenant_index` en `member_removed` | **Pendiente** (no encontré el consumidor) | — |
| B-4 territorio | **Hecho** | `territory.controller.ts` |
| B-6 solicitud rechazada | **Pendiente** (espera al bróker, 3.15) | Sin `hasRejectedApplication` |
| B-7 desarrollo local / `PASSWORD_RESET_URL` | **Hecho** | `.env.example`, `docs/development/frontend-local.md` |
| B-8 esquema de error en el contrato | **Hecho** | `ProblemDetails` con el enum `code` en `openapi.json` |
| B-8 `oasdiff` | **Pendiente** (ROADMAP) | — |
| B-9 `GET /v1/properties/{id}/media` | **Hecho** (200 sin esquema) | `properties.controller.ts` |
| B-10 paginación | **Descartada** (ya existía) | `cursorPageQuerySchema` |

No identifiqué el número de PR de cada uno (no se pidió y exige leer el historial por separado).

---

## 16. Discrepancias (documento ↔ código)

| # | Documento dice | El código hace | Efecto en el front |
|---|---|---|---|
| 1 | El prompt de origen cita la spec `2026-10-28-frontend-design.md` | No existe; solo `2026-10-29-api-para-frontend-design.md` (de la API) | §14 queda sin spec del front |
| 2 | La spec de la API (§3) dice que `Property` ya usa el autorizador en `core` y los pasos de `members` están por hacer | El autorizador de `members` ya está en `main` (PR #75), pero **no se expone** en ningún DTO | `allowedActions` de `members` sigue pendiente (§7) |
| 3 | `twoFactorRequired` de `/me` «informa» al front | Un `admin` sin 2FA **no llega a leer `/me`**: recibe 403 `two_factor_required` primero | El front debe manejar ese 403 antes de pedir `/me` |
| 4 | `GET /v1/properties` aparece en el contrato | Responde 200 **sin esquema** (la forma está en `PropertyListItemView`) | Tipar a mano esa lista hasta que el contrato la declare |
| 5 | `GET /v1/properties/{id}/media` aparece en el contrato | Responde 200 **sin esquema** (`PropertyMediaView`) | Tipar a mano |
| 6 | `POST /v1/media/{id}/complete` responde 200 | El cuerpo `{ status }` no está declarado en el contrato | Tipar a mano |
| 7 | La documentación de seguridad sugiere que la limpieza de `user_tenant_index` existe | `member_removed` se publica y nadie lo consume | `GET /v1/me/tenants` puede listar países sin membresía vigente |
| 8 | El esquema de `InviteMemberBody.role` lista los seis roles | El servidor solo acepta los invitables (`broker`, `agent`, `assistant`, `read_only`) | No ofrecer `admin`/`compliance` al invitar |
| 9 | `ListProperties` filtra por `agencyId` | El `agencyId` lo manda el cliente (inconsistencia registrada del backend) | No confiar en él como control de acceso; el servidor aplica sus reglas |
| 10 | `complete-document-upload` frente a `remove-document` | Reglas de relación distintas (inconsistencia registrada, fuera de alcance de la API-para-front) | `documents[].allowedActions.remove` refleja solo `remove-document` |
| 11 | El prompt pide «códigos de respaldo de 2FA, plugins del cliente» | Solo se configuran los plugins `twoFactor` y `bearer`; las rutas son las de Better Auth | Consultar la documentación de Better Auth para los cuerpos exactos |

---

## Resumen por sección: qué no pude verificar

1. **Producto/glosario:** definiciones de «líder de operación» y «editora» tomadas de los mensajes de error, no de las reglas fuente.
2. **Roles:** completo (`ROLE_MAP` y `catalog.ts`).
3. **Hosts/local:** no ejecuté el arranque; los comandos salen de `package.json`/`ops-cli`/`.env.example`. Seeds de usuarios: no existen. El mailer del enlace de reseteo no se leyó.
4. **Contrato:** no encontré publicación versionada fuera del artefacto de CI.
5. **Autenticación:** los nombres y cuerpos exactos de las rutas de Better Auth, la duración de sesión y la forma de un 429 de auth son de la librería, no del repo.
6. **Entrada a la app:** ejemplos construidos del esquema; `/me` de `platform_operator` no encontrado.
7. **Autorización UI:** completo para `properties`; `members` pendiente en el backend.
8. **Endpoints por pantalla:** todos los cuerpos leídos del contrato; `GET /v1/properties`, `/media` y `complete` sin esquema; `TenantConfigBody` solo referido.
9. **Flujos especiales:** cadencia de polling no definida; «último nivel obligatorio» del territorio no verificado en el validador.
10. **Errores:** todos los códigos y títulos verificados; el HTTP de `tenant_unavailable` no.
11. **Estados:** transiciones de agencia verificadas en la entidad; las de invitación y membresía solo por esquema.
12. **Configuración:** leída de `tenants/co.yaml`; no verifiqué qué se publicó en la base.
13. **Qué no existe:** verificado por ausencia de controllers/rutas.
14. **Decisiones del frontend:** sin spec del front.
15. **Forma de trabajo:** tomada del prompt; `task-start`/`task-done` no encontrados en `.claude/commands/`.
16. **Discrepancias:** las 11 listadas.
