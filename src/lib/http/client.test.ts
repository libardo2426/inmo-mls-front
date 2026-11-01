import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ApiError,
  createHttpClient,
  NetworkError,
  setHttpHandlers,
  ValidationError,
} from '@/lib/http';
import { server } from '@/test/server';

const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
const origin = 'http://localhost:3000';

function setup() {
  const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const client = createHttpClient({ config, fetchImpl: fetchSpy, origin });
  return { client, fetchSpy };
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    {
      type: `https://x.test/problems/${code}`,
      title: 'Título',
      status,
      instance: '/x',
      code,
      requestId: 'req-1',
      ...extra,
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

afterEach(() => setHttpHandlers({}));

describe('selección de host y opciones', () => {
  it('país: llama /v1/... con credentials include y Accept json', async () => {
    server.use(http.get(`${origin}/v1/me`, () => HttpResponse.json({ ok: true })));
    const { client, fetchSpy } = setup();
    await client.request({ host: 'country', path: '/me', schema: z.object({ ok: z.boolean() }) });
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBeDefined();
    expect(new URL(String(url)).pathname).toBe('/v1/me');
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('accept')).toBe('application/json');
  });

  it('plataforma: llama /plataforma/v1/...', async () => {
    server.use(
      http.get(`${origin}/plataforma/v1/admin/tenants/co/config`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    const { client } = setup();
    const data = await client.request({
      host: 'platform',
      path: '/admin/tenants/co/config',
      schema: z.object({ ok: z.boolean() }),
    });
    expect(data.ok).toBe(true);
  });

  it('omite del query los valores undefined', async () => {
    let seen = '';
    server.use(
      http.get(`${origin}/v1/agencies`, ({ request }) => {
        seen = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );
    const { client } = setup();
    await client.request({
      host: 'country',
      path: '/agencies',
      query: { limit: 20, cursor: undefined },
      schema: z.array(z.unknown()),
    });
    expect(seen).toBe('?limit=20');
  });
});

describe('respuestas correctas', () => {
  it('devuelve el dato parseado con el schema', async () => {
    server.use(http.get(`${origin}/v1/n`, () => HttpResponse.json({ n: 3 })));
    const { client } = setup();
    const data = await client.request({
      host: 'country',
      path: '/n',
      schema: z.object({ n: z.number() }),
    });
    expect(data).toEqual({ n: 3 });
  });

  it('204 sin cuerpo resuelve undefined con z.undefined()', async () => {
    server.use(
      http.post(`${origin}/v1/agencies/1/approve`, () => new HttpResponse(null, { status: 204 })),
    );
    const { client } = setup();
    const data = await client.request({
      host: 'country',
      method: 'POST',
      path: '/agencies/1/approve',
      schema: z.undefined(),
    });
    expect(data).toBeUndefined();
  });
});

describe('errores del backend', () => {
  it('problem+json 409 → ApiError con status, code, title, requestId y details', async () => {
    server.use(
      http.post(`${origin}/v1/properties`, () =>
        problem(409, 'property_already_registered', { details: { propertyId: 'p-1' } }),
      ),
    );
    const { client } = setup();
    const error = await client
      .request({
        host: 'country',
        method: 'POST',
        path: '/properties',
        body: {},
        schema: z.unknown(),
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.status).toBe(409);
    expect(api.code).toBe('property_already_registered');
    expect(api.title).toBe('Título');
    expect(api.requestId).toBe('req-1');
    expect(api.details).toEqual({ propertyId: 'p-1' });
  });

  it('tolera un code que el contrato aún no conoce', async () => {
    server.use(http.get(`${origin}/v1/x`, () => problem(409, 'codigo_nuevo_del_backend')));
    const { client } = setup();
    const error = (await client
      .request({ host: 'country', path: '/x', schema: z.unknown() })
      .catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('codigo_nuevo_del_backend');
  });

  it('400 validation_failed → ApiError.errors poblado', async () => {
    server.use(
      http.post(`${origin}/v1/x`, () =>
        problem(400, 'validation_failed', {
          errors: [{ path: 'mandate.endDate', code: 'too_small', message: 'Fecha inválida' }],
        }),
      ),
    );
    const { client } = setup();
    const error = (await client
      .request({ host: 'country', method: 'POST', path: '/x', schema: z.unknown() })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.errors).toEqual([
      { path: 'mandate.endDate', code: 'too_small', message: 'Fecha inválida' },
    ]);
  });

  it('502 con cuerpo HTML → ApiError genérico, no error de parseo', async () => {
    server.use(
      http.get(`${origin}/v1/x`, () =>
        HttpResponse.text('<html>Bad Gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );
    const { client } = setup();
    const error = (await client
      .request({ host: 'country', path: '/x', schema: z.unknown() })
      .catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe('unknown');
  });

  it('401 invoca onUnauthorized una vez y aun así lanza ApiError', async () => {
    server.use(http.get(`${origin}/v1/me`, () => problem(401, 'unauthorized')));
    const onUnauthorized = vi.fn();
    setHttpHandlers({ onUnauthorized });
    const { client } = setup();
    await expect(
      client.request({ host: 'country', path: '/me', schema: z.unknown() }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('403 invoca onForbidden con el code two_factor_required', async () => {
    server.use(http.get(`${origin}/v1/me`, () => problem(403, 'two_factor_required')));
    const onForbidden = vi.fn();
    setHttpHandlers({ onForbidden });
    const { client } = setup();
    await client
      .request({ host: 'country', path: '/me', schema: z.unknown() })
      .catch(() => undefined);
    expect(onForbidden).toHaveBeenCalledTimes(1);
    const received = onForbidden.mock.calls[0]?.[0] as ApiError | undefined;
    expect(received?.code).toBe('two_factor_required');
  });
});

describe('errores del cliente', () => {
  it('JSON que no cumple el schema → ValidationError', async () => {
    server.use(http.get(`${origin}/v1/n`, () => HttpResponse.json({ n: 'no-es-numero' })));
    const { client } = setup();
    const error = await client
      .request({ host: 'country', path: '/n', schema: z.object({ n: z.number() }) })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(NetworkError);
  });

  it('fetch que rechaza → NetworkError', async () => {
    const client = createHttpClient({
      config,
      origin,
      fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(
      client.request({ host: 'country', path: '/x', schema: z.unknown() }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('abort → se relanza el AbortError original', async () => {
    server.use(http.get(`${origin}/v1/x`, () => HttpResponse.json({})));
    const { client } = setup();
    const controller = new AbortController();
    controller.abort();
    const error = (await client
      .request({ host: 'country', path: '/x', schema: z.unknown(), signal: controller.signal })
      .catch((e: unknown) => e)) as Error;
    expect(error.name).toBe('AbortError');
    expect(error).not.toBeInstanceOf(NetworkError);
  });
});
