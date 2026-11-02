# ADR-0003 — Estrategia de autenticación y sesión

- **Estado:** Aceptado (F1)
- **Fecha:** 2026-10-31

## Contexto

El backend usa **Better Auth** montado en `/v1/auth/*`. La identidad es global; la membresía es por país. La sesión es una **cookie `httpOnly`** con `SameSite=lax` y `Domain=<BASE_DOMAIN>`, compartida entre `app.` y `<país>.api.`; `Secure` solo en producción. El plugin `bearer` existe pero es para clientes que no son navegador. `admin` y `platform_operator` **exigen 2FA** (TOTP) y sin él reciben 403 `two_factor_required` en casi todo, **incluido `/me`**.

## Decisión

Corresponde a la **opción 1** del prompt (cookie de sesión del backend):

1. **Cookie `httpOnly` de Better Auth**, enviada con `credentials: 'include'`. El frontend **no almacena tokens** ni en `localStorage` ni en `sessionStorage` ni en memoria persistente. No se usa `bearer`.
2. **Cliente:** módulo propio `features/auth` sobre `lib/http` (el único lugar con `fetch`), sin la librería `better-auth`. *Enmienda de F1:* son siete rutas `POST` con cuerpos pequeños; una librería de cliente añadiría un segundo cliente HTTP, otro manejo de errores y más peso en el bundle, y duplicaría el manejo global de 401/403/429. Se valida cada respuesta con Zod y se descarta el `token` de `sign-in` (nunca se guarda ni se muestra). Todas las rutas usan el mismo origen vía proxy (ADR-0005).
3. **Sin cookie legible:** el estado de sesión del frontend se deriva de `GET /v1/me` (TanStack Query), no de leer la cookie.
4. **Flujo de entrada:**
   - Login → si la respuesta pide 2FA, verificar TOTP o código de respaldo.
   - Pedir `/me`. Si responde 403 `two_factor_required`, llevar a **activar 2FA** (enable → mostrar URI TOTP y **códigos de respaldo** → verificar primer código) y reintentar.
   - Si `membership` es `null` (403 `no_membership`), mostrar una pantalla de "sin acceso al panel"; este panel no registra agencias.
5. **Manejo global** en el cliente HTTP: 401 → ir a login guardando la ruta de retorno; 403 → según `code` (§6 del contexto); 429 → mensaje de espera; 503 `tenant_unavailable` → mantenimiento.
6. **CSRF:** la cookie es `SameSite=lax` y Better Auth valida el `Origin` contra `FRONTEND_ORIGINS`. El frontend no añade un token propio; se verifica en F1 que las mutaciones sean rechazadas desde un origen no autorizado (pregunta abierta Q4).
7. **Logout:** `sign-out`, limpiar la caché de TanStack Query y redirigir a login.
8. **Expiración:** si la sesión caduca (401 en cualquier llamada), se aplica el punto 5. No hay refresh manual: Better Auth renueva la sesión del lado del servidor.

### Diferencias con el prompt original

- El prompt asumía `SameSite=Strict`; el backend usa **`lax`**. La protección contra CSRF recae en el chequeo de `Origin` del backend.
- No hay JWT ni refresh token propio: **no se implementa cola de peticiones durante refresh**.

## Alternativas consideradas

- **JWT en memoria + refresh en cookie:** no aplica; el backend no lo ofrece.
- **Bearer en el navegador:** obligaría a guardar el token en JS; descartado por seguridad.

## Consecuencias

- (+) Sin secretos en el navegador; XSS no puede leer la sesión.
- (+) Menos código de sesión propio.
- (−) Dependemos de que la cookie con `Domain=<BASE_DOMAIN>` funcione tras el proxy (Q4) y para `admin.api` (Q3).
- (−) Los cuerpos de las rutas de Better Auth se tomaron de `better-auth@1.7.14` y de la sesión `backend` (Q2); **no se han verificado contra un backend en marcha** hasta que se ejecute `e2e/auth.spec.ts` y el `curl` de CA19. Si difieren, se ajustan los esquemas de `features/auth/api/schemas.ts`.
- (−) Las cuentas de admin no se crean con `ops-cli`: se registran con `sign-up/email` y se les da membresía con `ops member add` (Q10, ver README).

## Verificado en F1

- `enable`, `generate-backup-codes` y `disable` exigen `{password}` (el plugin no tiene `allowPasswordless`); por eso la activación pide la contraseña primero.
- `verify-totp` y `verify-backup-code` reciben `{code}`; no se envía `trustDevice`.
- Los errores de Better Auth llegan como `{code, message}`; el 429 de auth es `{message}` con `X-Retry-After`. El cliente HTTP lee `message` y la cabecera además de `Retry-After`.
- El `Origin` del navegador debe figurar en `FRONTEND_ORIGINS` del backend; en el e2e dentro de Docker, `http://app.localtest.me:8080`.
- La cookie de sesión lleva `Domain=<BASE_DOMAIN>`: el e2e entra por un host bajo ese dominio.
