import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ApiError, setHttpHandlers } from '@/lib/http';
import { getHttpHandlers } from '@/lib/http/handlers';
import { installAuthHandlers } from './handlers';

const apiError = (status: number, code: string) => new ApiError({ status, code, title: 'x' });

let navigate: Mock<(target: { to: string; search?: { redirect: string } }) => void>;
let queryClient: QueryClient;

function install(currentPath: string) {
  installAuthHandlers({ queryClient, navigate, currentPath: () => currentPath });
  return getHttpHandlers();
}

beforeEach(() => {
  navigate = vi.fn<(target: { to: string; search?: { redirect: string } }) => void>();
  queryClient = new QueryClient();
  queryClient.setQueryData(['me'], { algo: 1 });
});

afterEach(() => setHttpHandlers({}));

describe('401', () => {
  it('en una ruta de datos: vacía la caché y va a login con la ruta actual', () => {
    install('/propiedades?x=1').onUnauthorized?.(apiError(401, 'unauthorized'), {
      host: 'country',
      path: '/properties',
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(navigate).toHaveBeenCalledWith({
      to: '/iniciar-sesion',
      search: { redirect: '/propiedades?x=1' },
    });
  });

  it.each(['/auth/sign-in/email', '/auth/two-factor/verify-totp', '/me'])(
    'en %s no navega (lo resuelve la pantalla o la guarda)',
    (path) => {
      install('/').onUnauthorized?.(apiError(401, 'unauthorized'), { host: 'country', path });
      expect(navigate).not.toHaveBeenCalled();
      expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    },
  );

  it.each(['/iniciar-sesion', '/iniciar-sesion?redirect=%2F', '/verificar', '/recuperar'])(
    'estando ya en %s no navega (sin bucles)',
    (here) => {
      install(here).onUnauthorized?.(apiError(401, 'unauthorized'), {
        host: 'country',
        path: '/properties',
      });
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});

describe('403', () => {
  it('two_factor_required → /activar-2fa', () => {
    install('/').onForbidden?.(apiError(403, 'two_factor_required'), {
      host: 'country',
      path: '/properties',
    });
    expect(navigate).toHaveBeenCalledWith({ to: '/activar-2fa' });
  });

  it('no_membership → /sin-acceso', () => {
    install('/').onForbidden?.(apiError(403, 'no_membership'), {
      host: 'country',
      path: '/properties',
    });
    expect(navigate).toHaveBeenCalledWith({ to: '/sin-acceso' });
  });

  it('otro code, o la ruta /me, no navegan', () => {
    const handlers = install('/');
    handlers.onForbidden?.(apiError(403, 'insufficient_role'), {
      host: 'country',
      path: '/properties',
    });
    handlers.onForbidden?.(apiError(403, 'two_factor_required'), { host: 'country', path: '/me' });
    expect(navigate).not.toHaveBeenCalled();
  });
});
