import { describe, expect, it } from 'vitest';
import { shouldRetry } from '@/app/query-client';
import { ApiError, NetworkError, ValidationError } from '@/lib/http';

function apiError(status: number) {
  return new ApiError({ status, code: 'x', title: 't' });
}

describe('shouldRetry', () => {
  it('no reintenta errores 4xx del backend', () => {
    expect(shouldRetry(0, apiError(400))).toBe(false);
    expect(shouldRetry(0, apiError(404))).toBe(false);
    expect(shouldRetry(0, apiError(499))).toBe(false);
  });

  it('reintenta 5xx hasta 2 veces', () => {
    expect(shouldRetry(0, apiError(503))).toBe(true);
    expect(shouldRetry(1, apiError(503))).toBe(true);
    expect(shouldRetry(2, apiError(503))).toBe(false);
  });

  it('reintenta errores de red hasta 2 veces', () => {
    expect(shouldRetry(0, new NetworkError(new TypeError('x')))).toBe(true);
    expect(shouldRetry(1, new NetworkError(new TypeError('x')))).toBe(true);
    expect(shouldRetry(2, new NetworkError(new TypeError('x')))).toBe(false);
  });

  it('no reintenta errores de validación de contrato', () => {
    expect(shouldRetry(0, new ValidationError('/v1/x', []))).toBe(false);
  });
});
