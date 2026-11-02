import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, createHttpClient, ValidationError } from '@/lib/http';
import { server } from '@/test/server';
import { createAuthApi } from './auth-api';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
// El espía envuelve el fetch real (interceptado por MSW) para inspeccionar las opciones.
const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
  globalThis.fetch(input, init),
);
const api = createAuthApi(createHttpClient({ config, origin, fetchImpl: fetchSpy }));

/** Registra un POST de auth y devuelve el cuerpo recibido por el servidor. */
function capture(path: string, response: () => Response) {
  const seen: { body: unknown } = { body: undefined };
  server.use(
    http.post(`${origin}/v1/auth/${path}`, async ({ request }) => {
      seen.body = await request.json();
      return response();
    }),
  );
  return seen;
}

describe('signInEmail', () => {
  it('envía correo y contraseña con credentials include', async () => {
    const seen = capture('sign-in/email', () =>
      HttpResponse.json({ redirect: false, token: 't', user: { id: 'u1' } }),
    );
    await api.signInEmail({ email: 'a@b.co', password: 'una-clave-larga-1' });
    expect(seen.body).toEqual({ email: 'a@b.co', password: 'una-clave-larga-1' });
    const init = fetchSpy.mock.calls.at(-1)?.[1];
    expect(init?.credentials).toBe('include');
  });

  it('twoFactorRedirect → { kind: "two-factor" }', async () => {
    capture('sign-in/email', () =>
      HttpResponse.json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] }),
    );
    await expect(api.signInEmail({ email: 'a@b.co', password: 'x' })).resolves.toEqual({
      kind: 'two-factor',
    });
  });

  it('sesión creada → { kind: "session" } y el token NO sale del módulo', async () => {
    capture('sign-in/email', () =>
      HttpResponse.json({ redirect: false, token: 'SECRETO', user: { id: 'u1' } }),
    );
    const result = await api.signInEmail({ email: 'a@b.co', password: 'x' });
    expect(result).toEqual({ kind: 'session' });
    expect(JSON.stringify(result)).not.toContain('SECRETO');
  });

  it('credenciales inválidas → ApiError con el code de Better Auth', async () => {
    capture('sign-in/email', () =>
      HttpResponse.json(
        { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
        { status: 401 },
      ),
    );
    const error = (await api
      .signInEmail({ email: 'a@b.co', password: 'x' })
      .catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INVALID_EMAIL_OR_PASSWORD');
  });
});

describe('segundo factor', () => {
  it('verifyTotp envía exactamente { code } (sin trustDevice)', async () => {
    const seen = capture('two-factor/verify-totp', () => HttpResponse.json({ status: true }));
    await api.verifyTotp('123456');
    expect(seen.body).toEqual({ code: '123456' });
  });

  it('verifyBackupCode envía exactamente { code }', async () => {
    const seen = capture('two-factor/verify-backup-code', () =>
      HttpResponse.json({ user: { id: 'u1' }, session: { id: 's1' } }),
    );
    await api.verifyBackupCode('abcde-12345');
    expect(seen.body).toEqual({ code: 'abcde-12345' });
  });

  it('un código inválido lanza ApiError con code INVALID_CODE', async () => {
    capture('two-factor/verify-totp', () =>
      HttpResponse.json({ code: 'INVALID_CODE', message: 'Invalid code' }, { status: 400 }),
    );
    const error = (await api.verifyTotp('000000').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('INVALID_CODE');
  });
});

describe('enableTwoFactor', () => {
  it('envía la contraseña y devuelve totpURI y backupCodes', async () => {
    const seen = capture('two-factor/enable', () =>
      HttpResponse.json({
        method: 'totp',
        totpURI: 'otpauth://totp/Innmo:a@b.co?secret=ABC',
        backupCodes: ['c1', 'c2'],
      }),
    );
    await expect(api.enableTwoFactor('mi-clave')).resolves.toEqual({
      totpURI: 'otpauth://totp/Innmo:a@b.co?secret=ABC',
      backupCodes: ['c1', 'c2'],
    });
    expect(seen.body).toEqual({ password: 'mi-clave' });
  });

  it('una respuesta sin totpURI lanza ValidationError', async () => {
    capture('two-factor/enable', () => HttpResponse.json({ method: 'totp' }));
    await expect(api.enableTwoFactor('x')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('sesión y contraseña', () => {
  it('signOut llama POST /v1/auth/sign-out con cuerpo vacío', async () => {
    const seen = capture('sign-out', () => HttpResponse.json({ success: true }));
    await api.signOut();
    expect(seen.body).toEqual({});
  });

  it('requestPasswordReset envía { email }', async () => {
    const seen = capture('request-password-reset', () => HttpResponse.json({ status: true }));
    await api.requestPasswordReset('a@b.co');
    expect(seen.body).toEqual({ email: 'a@b.co' });
  });

  it('resetPassword envía { newPassword, token }', async () => {
    const seen = capture('reset-password', () => HttpResponse.json({ status: true }));
    await api.resetPassword({ newPassword: 'otra-clave-larga-1', token: 'tok' });
    expect(seen.body).toEqual({ newPassword: 'otra-clave-larga-1', token: 'tok' });
  });
});
