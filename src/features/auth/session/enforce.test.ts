import { QueryClient } from '@tanstack/react-query';
import { isRedirect } from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/lib/http';
import { meFixture } from '@/test/fixtures';
import { server } from '@/test/server';
import { enforce } from './enforce';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };

function context() {
  return {
    queryClient: new QueryClient(),
    http: createHttpClient({ config, origin }),
  };
}

describe('enforce', () => {
  it('protected + 401 → redirect a /iniciar-sesion con la ruta pedida', async () => {
    server.use(
      http.get(`${origin}/v1/me`, () =>
        HttpResponse.json(
          { title: 'x', status: 401, code: 'unauthorized' },
          { status: 401, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const error = await enforce('protected', {
      context: context(),
      location: { href: '/propiedades?x=1' },
    }).catch((e: unknown) => e);
    expect(isRedirect(error)).toBe(true);
    const options = (error as { options: { to: string; search: { redirect: string } } }).options;
    expect(options.to).toBe('/iniciar-sesion');
    expect(options.search).toEqual({ redirect: '/propiedades?x=1' });
  });

  it('protected + sesión válida → no redirige', async () => {
    server.use(http.get(`${origin}/v1/me`, () => HttpResponse.json(meFixture())));
    await expect(
      enforce('protected', { context: context(), location: { href: '/' } }),
    ).resolves.toBeUndefined();
  });

  it('public-only + sesión válida → redirect a /', async () => {
    server.use(http.get(`${origin}/v1/me`, () => HttpResponse.json(meFixture())));
    const error = await enforce('public-only', {
      context: context(),
      location: { href: '/iniciar-sesion' },
    }).catch((e: unknown) => e);
    expect(isRedirect(error)).toBe(true);
    expect((error as { options: { to: string } }).options.to).toBe('/');
  });
});
