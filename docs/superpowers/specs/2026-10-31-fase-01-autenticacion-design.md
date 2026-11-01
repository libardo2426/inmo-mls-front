# Fase 1 — Autenticación y seguridad base — Diseño

- **Fecha:** 2026-10-31
- **Estado:** borrador para aprobación
- **Padre:** [Roadmap del frontend](./2026-10-31-roadmap-frontend-design.md), [F0](./2026-10-31-fase-00-fundacion-design.md) y ADR 0001–0005 (se enmienda el ADR-0003)
- **Backend:** `docs/backend/contexto-para-frontend.md` §5–6 y `docs/backend/openapi.json`. Las rutas de Better Auth se verificaron leyendo `better-auth@1.7.14` y con respuestas de la sesión `backend` (ver §5 y §10).

**Decidido** = lo acordó el usuario. **Mi propuesta** = decisión mía, revisable.

---

## 1. Objetivo

Que un **admin MLS** pueda entrar al panel con seguridad: iniciar sesión, activar y usar 2FA (TOTP y códigos de respaldo), recuperar su contraseña y cerrar sesión, con el manejo global de 401/403/429/503 resuelto una sola vez. Al terminar hay una página autenticada mínima; el shell y la navegación por permisos llegan en F2.

## 2. Alcance

### Dentro

1. **Módulo `features/auth`** sobre `lib/http` (**decidido**, opción B): siete funciones con cuerpos y respuestas validados con Zod — `signInEmail`, `verifyTotp`, `verifyBackupCode`, `enableTwoFactor`, `signOut`, `requestPasswordReset`, `resetPassword`. Sin la librería `better-auth` en el bundle.
2. **Estado de sesión** derivado de `GET /v1/me` (consulta `meQuery`), nunca de leer la cookie.
3. **Pantallas** (**mi propuesta** para las rutas): `/iniciar-sesion`, `/verificar` (TOTP o código de respaldo), `/activar-2fa` (contraseña → QR → primer código → códigos de respaldo), `/recuperar`, `/restablecer`, `/sin-acceso`.
4. **Guardas de ruta** con `beforeLoad` y `queryClient` en el contexto del router; ruta de retorno validada.
5. **Manejo global** vía `setHttpHandlers` (401 → login con retorno; 403 `two_factor_required` → activar 2FA; 403 `no_membership` → sin acceso), pantallas de mantenimiento (503 `tenant_unavailable`) y de error de red con reintento.
6. **Extensión de `lib/http`:** `ApiError.retryAfterSeconds` (cabecera `Retry-After` o `X-Retry-After`) y título tomado de `message` cuando el error no es `problem+json` (los errores de Better Auth son `{ code, message }`).
7. **Página autenticada mínima** en `/`: correo del usuario, país y botón de cerrar sesión.
8. **Cierre de Q2, Q4, Q5 y Q10** en ADR y README (procedimiento para crear cuentas de prueba y activar 2FA).
9. **Textos en español** centralizados en `lib/i18n/es.ts` (namespace `auth`).

### Fuera de alcance

- Login del `platform_operator` y su destino post-login → **F6** (**decidido**). Hace falta pedir al backend un `/me` o `platformRole` en `admin.api` (`B-18`). El mismo `sign-in/email` ya le sirve.
- Shell, navegación, `can()`/`<Can>` y bloqueo por permisos → **F2**. En F1 cualquier sesión con membresía ve la página mínima.
- Registro de cuentas, invitaciones, registro de inmobiliaria (`/invitaciones/aceptar`) → fuera del panel admin.
- Pantalla de «Seguridad de la cuenta» (regenerar códigos, desactivar 2FA) → fase posterior. El usuario que pierda sus códigos pasa por soporte hasta entonces.
- «Confiar en este dispositivo» (`trustDevice`): **no se ofrece** (**mi propuesta**: cuentas de alto privilegio).
- Cabeceras y CSP: ya resueltas en F0; F1 solo comprueba que la pantalla del QR no las viola.

## 3. Historias de usuario

- **H1.** Como admin MLS, quiero iniciar sesión con correo y contraseña, para acceder al panel.
- **H2.** Como admin sin 2FA activo, quiero que el panel me lleve a activarlo (escanear el QR, confirmar un código y guardar mis códigos de respaldo), para poder operar.
- **H3.** Como admin con 2FA, quiero verificar con mi código TOTP o, si perdí el teléfono, con un código de respaldo.
- **H4.** Como admin, quiero recuperar mi contraseña desde un enlace de correo de un solo uso, sin que el panel revele si el correo existe.
- **H5.** Como admin, quiero cerrar sesión y que no quede nada de mis datos en la pantalla ni en caché.
- **H6.** Como admin, quiero volver a la pantalla donde estaba si mi sesión caduca.
- **H7.** Como admin, quiero un mensaje claro y el tiempo de espera cuando excedo los intentos.
- **H8.** Como desarrollador, quiero un procedimiento documentado para crear una cuenta admin de prueba y poder probar el flujo completo.

## 4. Criterios de aceptación (verificables)

| # | Criterio | Cómo se verifica |
|---|---|---|
| CA1 | `signInEmail` envía `{ email, password }` y distingue por schema entre sesión creada y `{ twoFactorRedirect: true, twoFactorMethods }`; descarta el campo `token` de la respuesta | Test del módulo con MSW |
| CA2 | `verifyTotp`, `verifyBackupCode`, `enableTwoFactor` (con contraseña), `signOut`, `requestPasswordReset` y `resetPassword` usan las rutas y cuerpos de §5 | Tests del módulo con MSW |
| CA3 | Un error de Better Auth `{ code, message }` produce `ApiError` con `code` y título legible; un 429 `{ message }` expone `retryAfterSeconds` desde `X-Retry-After` | Tests de `lib/http` |
| CA4 | Login correcto sin 2FA → se consulta `/me` y se navega al destino | Test de pantalla |
| CA5 | Login con `twoFactorRedirect` → `/verificar`; un código válido completa la sesión; un código inválido muestra el error sin salir de la pantalla | Test de pantalla |
| CA6 | `/me` con 403 `two_factor_required` → `/activar-2fa`; el flujo contraseña → QR → primer código → códigos de respaldo → `/me` funciona de punta a punta | Test de pantalla + manual con backend real |
| CA7 | El QR se genera sin violar la CSP (sin `unsafe-inline` en scripts, sin `dangerouslySetInnerHTML`) y se ofrece la clave en texto como alternativa | e2e / revisión |
| CA8 | Los códigos de respaldo viven solo en memoria de la pantalla, se pueden copiar y descargar, y el avance exige confirmar que se guardaron | Test de pantalla |
| CA9 | Sin sesión (401) cualquier ruta protegida redirige a `/iniciar-sesion?redirect=<ruta>`; tras el login se vuelve a ella | Test de guarda con memory history |
| CA10 | `redirect` solo acepta rutas internas: `//x`, `https://x` y `javascript:` se ignoran y se va a `/` | Test unitario |
| CA11 | Con sesión válida, entrar a `/iniciar-sesion` redirige a `/` | Test de guarda |
| CA12 | `membership: null` o 403 `no_membership` → `/sin-acceso` con opción de cerrar sesión | Test de pantalla |
| CA13 | `/recuperar` muestra siempre el mismo mensaje, exista o no el correo, y maneja el 429 | Test de pantalla |
| CA14 | `/restablecer` lee `#token=`, lo borra de la URL de inmediato, valida contraseña ≥ 12 y confirmación, y trata el token vencido o inválido con un mensaje y enlace a `/recuperar` | Test de pantalla |
| CA15 | Cerrar sesión llama `sign-out`, limpia toda la caché de TanStack Query y navega a `/iniciar-sesion`, incluso si `sign-out` falla | Test de pantalla |
| CA16 | 401 en cualquier llamada con sesión previa → login con retorno, sin bucles (los 401 de las rutas públicas de auth no redirigen) | Test del manejador global |
| CA17 | 503 `tenant_unavailable` y error de red muestran pantallas propias con reintento | Test de pantalla |
| CA18 | No se escribe ningún token, contraseña ni código en `localStorage`/`sessionStorage`, consola ni URL; los campos usan `autocomplete` correcto (`current-password`, `new-password`, `one-time-code`) | Test + `grep` en el cierre |
| CA19 | Una petición de auth desde un origen no permitido es rechazada por el backend (403 `INVALID_ORIGIN`) | Manual con `curl` contra el backend real (ADR-0003 punto 6) |
| CA20 | Con un admin real: login → activar 2FA → cerrar sesión → login + TOTP → cerrar sesión → login + código de respaldo funciona de punta a punta | e2e local contra backend real (no corre en CI) |
| CA21 | Las pantallas se manejan solo con teclado, los errores se anuncian (`aria-live`) y el foco va al primer error | Test de componente + revisión |
| CA22 | `pnpm ci:verify` y el e2e de humo de F0 siguen en verde | CI / Docker |

## 5. Endpoints usados

Todas bajo el host del país, prefijo `API_BASE_PATH` (`/v1`), con `credentials: 'include'`. Los de auth son `TenantOptional`.

| Llamada | Cuerpo | Respuesta 200 | Notas |
|---|---|---|---|
| `POST /v1/auth/sign-in/email` | `{ email, password }` | sesión (incluye `token`, que se descarta) **o** `{ twoFactorRedirect: true, twoFactorMethods: string[] }` | 5/min |
| `POST /v1/auth/two-factor/verify-totp` | `{ code }` | `{ status }` | 5/min; sin `trustDevice` |
| `POST /v1/auth/two-factor/verify-backup-code` | `{ code }` | `{ user, session }` | |
| `POST /v1/auth/two-factor/enable` | `{ password }` | `{ method, totpURI, backupCodes[] }` | requiere sesión; 2FA queda activo al verificar el primer código |
| `POST /v1/auth/sign-out` | `{}` | `{ success }` | |
| `POST /v1/auth/request-password-reset` | `{ email }` (+ `redirectTo` si el backend lo exige) | `{ status }` | 3 cada 5 min; el correo lleva `PASSWORD_RESET_URL#token=` |
| `POST /v1/auth/reset-password` | `{ newPassword, token }` | `{ status }` | revoca todas las sesiones |
| `GET /v1/me` | — | `MeResponse` | 401, 403 `two_factor_required`, `membership: null` |

Errores de Better Auth: `{ code, message }` en mayúsculas — `INVALID_CODE`, `INVALID_BACKUP_CODE`, `INVALID_EMAIL_OR_PASSWORD`, `INVALID_PASSWORD`, `INVALID_TOKEN`, `TOTP_ALREADY_ENABLED`, `ACCOUNT_TEMPORARILY_LOCKED`, `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`, `INVALID_TWO_FACTOR_COOKIE`, `INVALID_ORIGIN`, `MISSING_OR_NULL_ORIGIN`. El 429 es `{ message }` + `X-Retry-After`, sin `code`.

**Pendiente de comprobar contra el backend en ejecución** (se leyó el código, no se probó): la respuesta exacta de `sign-in/email`, el cuerpo de `sign-out`, si `request-password-reset` exige `redirectTo`, y la forma real del 429. El implementador los confirma con `curl` en la Task 1 del plan y deja los schemas ajustados a la realidad.

## 6. Decisiones de diseño

### 6.1 Máquina de estados de la sesión

`meQuery` (clave `['me']`) decide el destino. `beforeLoad` hace `ensureQueryData`.

| Resultado de `/me` | Destino |
|---|---|
| 200 con `membership` | la ruta pedida |
| 200 con `membership: null` o 403 `no_membership` | `/sin-acceso` |
| 403 `two_factor_required` | `/activar-2fa` |
| 401 | `/iniciar-sesion?redirect=…` |
| 503 `tenant_unavailable` | pantalla de mantenimiento |
| error de red | pantalla de reintento |

Un 401 en `/me` durante el arranque es el estado normal «sin sesión»: no muestra error ni notificación.

### 6.2 Flujos

- **Login:** `signInEmail` → si hay `twoFactorRedirect`, `/verificar` (Better Auth guarda una cookie temporal firmada; recargar la página conserva el paso) → éxito → `invalidateQueries(['me'])` → guarda decide el destino.
- **Activar 2FA** (**mi propuesta** de orden): contraseña → `enable` → QR + clave en texto → primer código (`verify-totp`) → pantalla de códigos de respaldo (copiar, descargar `.txt` con un `Blob`, casilla «ya los guardé») → `/me`. Los códigos solo viven en el estado del componente. Si la página se recarga entre verificar y confirmar, se pierden: el administrador queda con 2FA activo y sin códigos hasta que exista la pantalla de seguridad (riesgo aceptado, ver §9).
- **Recuperar:** `/recuperar` pide el correo y responde siempre lo mismo. `/restablecer` toma `#token=`, lo elimina con `history.replaceState`, pide contraseña nueva (≥ 12) y su confirmación, y al terminar lleva a `/iniciar-sesion` con un aviso.
- **Cierre de sesión:** `signOut` en `finally` → `queryClient.clear()` → `/iniciar-sesion`.

### 6.3 Manejo global

`setHttpHandlers` se registra en `providers.tsx`. Las rutas públicas de auth (`/auth/*`) no disparan la redirección por 401 (un login fallido devuelve 401/400 y no debe expulsarlo). Los errores propios de cada pantalla (código inválido, contraseña incorrecta, 429) los traduce una función `authErrorMessage(error)` en `features/auth`, con textos en `es.ts`.

### 6.4 Formularios

**Mi propuesta:** sin librería de formularios en F1. Cinco formularios pequeños con estado controlado, validación Zod en el envío y componentes `Field`/`Input` de shadcn. La decisión sobre `react-hook-form` se toma en F3, cuando haya formularios grandes. QR con `qrcode.react` (renderiza SVG como elementos React, sin HTML crudo), versión exacta y revisada con `pnpm audit`. Código TOTP con `input-otp` de shadcn.

### 6.5 Estructura

```
src/features/auth/
  api/        # siete funciones + schemas Zod + tests
  routes/…    # componentes de pantalla (las rutas en src/routes/ solo montan)
  me.ts       # meQuery, useMe
  guard.ts    # requireSession(), safeRedirect()
  messages.ts # authErrorMessage()
```

`src/routes/` añade `iniciar-sesion`, `verificar`, `activar-2fa`, `recuperar`, `restablecer`, `sin-acceso`. `createAppRouter` pasa `queryClient` en el contexto.

### 6.6 Tests

Vitest + MSW para el módulo, guardas y pantallas (memory history). Playwright añade un spec de auth contra backend real, activable con variables (`E2E_BACKEND=1`, correo y contraseña del admin); genera los códigos TOTP con `node:crypto` (RFC 6238) sin dependencias. No corre en CI.

### 6.7 ADR y documentación

Se enmienda el ADR-0003 (punto 2: módulo propio sobre `lib/http`, no `better-auth/react`; estado → «Aceptado»). El README documenta: crear la cuenta (`sign-up/email` + `pnpm ops member add co <correo> --role admin`), la activación de 2FA en la UI, `FRONTEND_ORIGINS` en producción y el `X-Forwarded-For` (`TRUST_PROXY_HOPS=1`).

## 7. Requisitos visuales

Tono sobrio de F0, claro y oscuro. Pantallas de autenticación como una tarjeta centrada de ancho acotado, logotipo de texto «Innmo MLS», un solo botón primario por pantalla. El QR siempre sobre fondo claro (para que lo lean las aplicaciones en modo oscuro). Estados de carga con `Spinner` y botón deshabilitado; errores en `Alert`. Contraste AA.

## 8. Requisitos de seguridad

- Cookie de sesión `httpOnly`: el front no lee ni guarda tokens. El `token` que Better Auth devuelve en el cuerpo del login se descarta en el schema y no se registra.
- Contraseñas, códigos TOTP y de respaldo nunca se guardan en almacenamiento del navegador, ni se escriben en consola o URL.
- Token de recuperación en el fragmento: sale de la URL al cargar y nunca se envía al servidor ni en `Referer`.
- `redirect` validado contra redirecciones abiertas.
- Mensaje de recuperación idéntico exista o no la cuenta; mensajes de login que no distinguen correo y contraseña.
- Sin `trustDevice`. Mutaciones solo con `Origin` permitido (verificado en CA19).
- Autocompletado correcto para gestores de contraseñas; `type="password"`; el QR y los códigos no se cachean.
- Sin `dangerouslySetInnerHTML`; la CSP de F0 no cambia.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cuerpos de Better Auth leídos de la versión 1.7.14; `main` del backend usa 1.7.11 hasta fusionar el PR #76 | Task 1 los confirma con `curl`; los schemas son estrictos en lo que se usa y tolerantes en el resto; el e2e los vigila |
| El 429 de auth tiene forma distinta a la del resto (sin `code`) | Se normaliza en `lib/http` con test; se confirma en vivo |
| Cookie con `Domain` compartida detrás del proxy sin probar | Se verifica en el e2e real; si falla, se escala al backend antes de seguir |
| Rate limit cuenta `X-Forwarded-For` (`TRUST_PROXY_HOPS=1`) | Nginx en producción suma un salto; se revisa que el proxy de Vite en dev no añada otro |
| El administrador pierde los códigos de respaldo (recarga entre verificar y confirmar) | Aviso explícito; la pantalla de seguridad lo resolverá en una fase posterior |
| Cuentas admin sin procedimiento de alta | Documentado en README (H8) |
| `qrcode.react` es una dependencia nueva | Versión exacta, `pnpm audit` y revisión en el cierre |

## 10. Preguntas abiertas

| # | Pregunta | Estado |
|---|---|---|
| Q2 | Rutas y cuerpos de Better Auth, forma del 429 | **Resuelta por lectura de código y backend**; falta confirmar en vivo (§5) |
| Q3 | Identidad del `platform_operator` en `admin.api` | Login resuelto; identidad → F6, petición `B-18` |
| Q4 | Origen que ve Better Auth | **Resuelta**: el del navegador; `FRONTEND_ORIGINS` debe listarlo (dev ya lo tiene) |
| Q5 | Duración de la sesión | **Resuelta**: valores por defecto (7 días, renovación diaria); confirmar con `get-session` |
| Q10 | Alta de cuentas admin | **Resuelta**: `sign-up/email` + `ops member add`; 2FA se activa en la UI |
| Q11 | ¿Hace falta una pantalla de seguridad (regenerar códigos, desactivar 2FA) antes de producción? | Abierta; no bloquea F1 |

## 11. Lo que queda al implementador

Texto exacto de los mensajes en español, estructura interna de los componentes, nombres de claves de consulta, detalles de maquetación y la forma de las pruebas dentro de las reglas anteriores. Si algún cuerpo de Better Auth difiere de §5 al probar en vivo, gana el comportamiento real: se ajusta el schema, se anota como ruling y no se inventa un campo.
