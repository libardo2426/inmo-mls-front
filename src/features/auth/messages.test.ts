import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { authErrorMessage } from './messages';

function apiError(
  status: number,
  code: string,
  extra: { retryAfterSeconds?: number; requestId?: string } = {},
) {
  return new ApiError({ status, code, title: 'x', ...extra });
}

describe('authErrorMessage', () => {
  it('429 con espera → incluye los segundos', () => {
    expect(authErrorMessage(apiError(429, 'unknown', { retryAfterSeconds: 30 }))).toContain('30');
  });

  it('429 sin espera o con espera no válida → texto genérico sin NaN ni undefined', () => {
    for (const error of [
      apiError(429, 'unknown'),
      apiError(429, 'unknown', { retryAfterSeconds: Number.NaN }),
    ]) {
      const text = authErrorMessage(error);
      expect(text).toBe(es.auth.errors.rateLimited());
      expect(text).not.toMatch(/NaN|undefined/);
    }
  });

  it.each([
    ['INVALID_EMAIL_OR_PASSWORD', es.auth.errors.credentials],
    ['INVALID_CODE', es.auth.errors.codeInvalid],
    ['INVALID_BACKUP_CODE', es.auth.errors.codeInvalid],
    ['INVALID_PASSWORD', es.auth.errors.passwordInvalid],
    ['INVALID_TOKEN', es.auth.errors.tokenInvalid],
    ['ACCOUNT_TEMPORARILY_LOCKED', es.auth.errors.locked],
    ['TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', es.auth.errors.locked],
    ['INVALID_TWO_FACTOR_COOKIE', es.auth.errors.twoFactorExpired],
    ['INVALID_ORIGIN', es.auth.errors.origin],
    ['MISSING_OR_NULL_ORIGIN', es.auth.errors.origin],
  ])('%s → mensaje propio', (code, expected) => {
    expect(authErrorMessage(apiError(400, code))).toBe(expected);
  });

  it('error de red → mensaje de red', () => {
    expect(authErrorMessage(new NetworkError(new TypeError('x')))).toBe(es.auth.errors.network);
  });

  it('código desconocido → genérico con el requestId si existe', () => {
    expect(authErrorMessage(apiError(500, 'otra', { requestId: 'req-9' }))).toContain('req-9');
    expect(authErrorMessage(apiError(500, 'otra'))).toBe(es.auth.errors.generic);
    expect(authErrorMessage('cualquier cosa')).toBe(es.auth.errors.generic);
  });
});
