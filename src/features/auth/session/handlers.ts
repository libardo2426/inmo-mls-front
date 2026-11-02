import type { QueryClient } from '@tanstack/react-query';
import { setHttpHandlers } from '@/lib/http';

type NavigateTarget = { to: string; search?: { redirect: string } };

type Deps = {
  queryClient: QueryClient;
  navigate: (target: NavigateTarget) => void;
  /** Ruta actual con búsqueda (`/propiedades?x=1`). */
  currentPath: () => string;
};

const PUBLIC_PATHS = new Set([
  '/iniciar-sesion',
  '/verificar',
  '/activar-2fa',
  '/recuperar',
  '/restablecer',
  '/sin-acceso',
  '/mantenimiento',
  '/sin-conexion',
]);

function pathnameOf(path: string): string {
  return path.split(/[?#]/)[0] ?? path;
}

/** `/auth/*` y `/me` los resuelven la pantalla o la guarda de ruta; el manejador global no interviene. */
function isHandledLocally(path: string): boolean {
  return path.startsWith('/auth/') || path === '/me';
}

/**
 * Manejo global de 401/403 (ADR-0003): 401 → login con ruta de retorno; 403
 * `two_factor_required` → activar 2FA; 403 `no_membership` → sin acceso.
 */
export function installAuthHandlers({ queryClient, navigate, currentPath }: Deps): void {
  setHttpHandlers({
    onUnauthorized: (_error, request) => {
      if (isHandledLocally(request.path)) return;
      const here = currentPath();
      if (PUBLIC_PATHS.has(pathnameOf(here))) return;
      queryClient.clear();
      navigate({ to: '/iniciar-sesion', search: { redirect: here } });
    },
    onForbidden: (error, request) => {
      if (isHandledLocally(request.path)) return;
      if (error.code === 'two_factor_required') navigate({ to: '/activar-2fa' });
      else if (error.code === 'no_membership') navigate({ to: '/sin-acceso' });
    },
  });
}
