import type { SessionState } from './me';

export type { SessionState };

export type GuardRule =
  'protected' | 'public-only' | 'two-factor-setup' | 'no-access' | 'invitation';
export type GuardTarget = { to: string; search?: { redirect: string } } | null;

/**
 * A dónde debe ir quien entra a una ruta con la regla `rule` según su sesión.
 * `null` significa «quedarse». `returnTo` es la ruta que se quería abrir.
 */
export function guardTarget(rule: GuardRule, state: SessionState, returnTo: string): GuardTarget {
  const toLogin = { to: '/iniciar-sesion', search: { redirect: returnTo } };

  switch (rule) {
    case 'protected':
      switch (state.status) {
        case 'authenticated':
          return null;
        case 'anonymous':
          return toLogin;
        case 'two-factor-required':
          return { to: '/activar-2fa' };
        case 'no-membership':
          return { to: '/sin-acceso' };
        case 'unavailable':
          return { to: '/mantenimiento' };
        case 'offline':
          return { to: '/sin-conexion' };
      }
      break;
    case 'public-only':
      if (state.status === 'authenticated') return { to: '/' };
      if (state.status === 'two-factor-required') return { to: '/activar-2fa' };
      if (state.status === 'no-membership') return { to: '/sin-acceso' };
      return null;
    case 'two-factor-setup':
      if (state.status === 'two-factor-required') return null;
      if (state.status === 'anonymous') return toLogin;
      if (state.status === 'authenticated') return { to: '/' };
      if (state.status === 'no-membership') return { to: '/sin-acceso' };
      return null;
    case 'no-access':
      if (state.status === 'no-membership') return null;
      if (state.status === 'anonymous') return toLogin;
      if (state.status === 'authenticated') return { to: '/' };
      if (state.status === 'two-factor-required') return { to: '/activar-2fa' };
      return null;
    case 'invitation':
      // Pública: el invitado puede estar sin sesión o sin membresía. Solo la 2FA obligatoria
      // pendiente y las caídas del servidor lo sacan de la página.
      if (state.status === 'two-factor-required') return { to: '/activar-2fa' };
      if (state.status === 'unavailable') return { to: '/mantenimiento' };
      if (state.status === 'offline') return { to: '/sin-conexion' };
      return null;
  }
}

// eslint-disable-next-line no-control-regex -- se rechazan a propósito los caracteres de control
const UNSAFE = /[\u0000-\u001f\u007f\\]/;

/** Solo acepta rutas internas (`/algo`); cualquier otra cosa vuelve a `/` (sin redirecciones abiertas). */
export function safeRedirect(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || UNSAFE.test(raw)) return '/';
  return raw;
}
