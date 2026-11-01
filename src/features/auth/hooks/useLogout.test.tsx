import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { meFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { useLogout } from './useLogout';

const go = vi.fn<(to: string) => void>();
vi.mock('./useAuthNavigation', () => ({ useAuthNavigation: () => ({ go }) }));

let queryClient: QueryClient;

function setup() {
  const config = loadConfig({ __APP_CONFIG__: validConfig });
  const client = createHttpClient({ config });
  queryClient = createQueryClient();
  queryClient.setQueryData(['me'], meFixture());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers config={config} queryClient={queryClient} http={client}>
      {children}
    </Providers>
  );
  return renderHook(() => useLogout(), { wrapper }).result.current;
}

beforeEach(() => go.mockClear());

describe('useLogout', () => {
  it('éxito → llama a sign-out, vacía la caché y navega a /iniciar-sesion', async () => {
    let calls = 0;
    server.use(
      http.post('*/v1/auth/sign-out', () => {
        calls += 1;
        return HttpResponse.json({ success: true });
      }),
    );
    const logout = setup();
    await logout();
    expect(calls).toBe(1);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(go).toHaveBeenCalledWith('/iniciar-sesion');
  });

  it('sign-out con 500 → igual limpia la caché y navega, sin rechazar', async () => {
    server.use(
      http.post('*/v1/auth/sign-out', () =>
        HttpResponse.json({ title: 'x', status: 500 }, { status: 500 }),
      ),
    );
    const logout = setup();
    await expect(logout()).resolves.toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(go).toHaveBeenCalledWith('/iniciar-sesion');
  });

  it('sign-out con error de red → igual limpia la caché y navega', async () => {
    server.use(http.post('*/v1/auth/sign-out', () => HttpResponse.error()));
    const logout = setup();
    await expect(logout()).resolves.toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(go).toHaveBeenCalledWith('/iniciar-sesion');
  });
});
