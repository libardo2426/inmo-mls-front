import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, createHttpClient } from '@/lib/http';
import { meFixture } from '@/test/fixtures';
import { server } from '@/test/server';
import { resolveSession } from './me';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };

function setup() {
  return {
    queryClient: new QueryClient(),
    http: createHttpClient({ config, origin }),
  };
}

function problem(status: number, code: string) {
  return HttpResponse.json(
    { title: 'x', status, code, requestId: 'r1' },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

describe('resolveSession', () => {
  it('200 con membership → authenticated con los datos de /me', async () => {
    server.use(http.get(`${origin}/v1/me`, () => HttpResponse.json(meFixture())));
    const { queryClient, http: client } = setup();
    const state = await resolveSession(queryClient, client);
    expect(state.status).toBe('authenticated');
    if (state.status === 'authenticated') expect(state.me.user.email).toBe('admin@innmo.test');
  });

  it('200 con membership null → no-membership', async () => {
    server.use(
      http.get(`${origin}/v1/me`, () => HttpResponse.json(meFixture({ membership: null }))),
    );
    const { queryClient, http: client } = setup();
    await expect(resolveSession(queryClient, client)).resolves.toEqual({ status: 'no-membership' });
  });

  it.each([
    [401, 'unauthorized', 'anonymous'],
    [403, 'two_factor_required', 'two-factor-required'],
    [403, 'no_membership', 'no-membership'],
    [503, 'tenant_unavailable', 'unavailable'],
  ] as const)('%i %s → %s', async (status, code, expected) => {
    server.use(http.get(`${origin}/v1/me`, () => problem(status, code)));
    const { queryClient, http: client } = setup();
    await expect(resolveSession(queryClient, client)).resolves.toEqual({ status: expected });
  });

  it('error de red → offline', async () => {
    server.use(http.get(`${origin}/v1/me`, () => HttpResponse.error()));
    const { queryClient, http: client } = setup();
    await expect(resolveSession(queryClient, client)).resolves.toEqual({ status: 'offline' });
  });

  it('un 500 se relanza como ApiError', async () => {
    server.use(http.get(`${origin}/v1/me`, () => problem(500, 'internal_error')));
    const { queryClient, http: client } = setup();
    await expect(resolveSession(queryClient, client)).rejects.toBeInstanceOf(ApiError);
  });

  it('reutiliza la caché: dos resoluciones seguidas hacen una sola petición', async () => {
    let calls = 0;
    server.use(
      http.get(`${origin}/v1/me`, () => {
        calls += 1;
        return HttpResponse.json(meFixture());
      }),
    );
    const { queryClient, http: client } = setup();
    await resolveSession(queryClient, client);
    await resolveSession(queryClient, client);
    expect(calls).toBe(1);
  });
});
