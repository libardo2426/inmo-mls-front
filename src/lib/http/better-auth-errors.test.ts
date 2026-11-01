import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, createHttpClient, setHttpHandlers } from '@/lib/http';
import { server } from '@/test/server';

const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
const origin = 'http://localhost:3000';
const client = createHttpClient({ config, origin });

async function fail(path: string, method: 'GET' | 'POST' = 'POST'): Promise<ApiError> {
  return (await client
    .request({ host: 'country', path, method, schema: z.unknown() })
    .catch((e: unknown) => e)) as ApiError;
}

afterEach(() => setHttpHandlers({}));

describe('errores de Better Auth y Retry-After', () => {
  it('{code, message} en JSON → ApiError con code y título tomado de message', async () => {
    server.use(
      http.post(`${origin}/v1/auth/two-factor/verify-totp`, () =>
        HttpResponse.json({ code: 'INVALID_CODE', message: 'Invalid code' }, { status: 400 }),
      ),
    );
    const error = await fail('/auth/two-factor/verify-totp');
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INVALID_CODE');
    expect(error.title).toBe('Invalid code');
  });

  it('429 con X-Retry-After → retryAfterSeconds', async () => {
    server.use(
      http.post(`${origin}/v1/auth/sign-in/email`, () =>
        HttpResponse.json(
          { message: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'X-Retry-After': '42' } },
        ),
      ),
    );
    const error = await fail('/auth/sign-in/email');
    expect(error.status).toBe(429);
    expect(error.code).toBe('unknown');
    expect(error.retryAfterSeconds).toBe(42);
  });

  it('429 con la cabecera estándar Retry-After', async () => {
    server.use(
      http.get(`${origin}/v1/x`, () =>
        HttpResponse.json({ message: 'x' }, { status: 429, headers: { 'Retry-After': '7' } }),
      ),
    );
    const error = await fail('/x', 'GET');
    expect(error.retryAfterSeconds).toBe(7);
  });

  it.each([['abc'], [undefined], ['-3'], ['1.5']])(
    '429 con Retry-After inválido (%s) → retryAfterSeconds indefinido',
    async (value) => {
      server.use(
        http.get(`${origin}/v1/x`, () =>
          HttpResponse.json(
            { message: 'x' },
            { status: 429, headers: value === undefined ? {} : { 'X-Retry-After': value } },
          ),
        ),
      );
      const error = await fail('/x', 'GET');
      expect(error.retryAfterSeconds).toBeUndefined();
    },
  );

  it('los manejadores reciben el host y la ruta de la petición', async () => {
    server.use(
      http.post(`${origin}/v1/auth/sign-in/email`, () =>
        HttpResponse.json({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'x' }, { status: 401 }),
      ),
    );
    const onUnauthorized = vi.fn();
    setHttpHandlers({ onUnauthorized });
    await fail('/auth/sign-in/email');
    expect(onUnauthorized).toHaveBeenCalledWith(expect.any(ApiError), {
      host: 'country',
      path: '/auth/sign-in/email',
    });
  });
});
