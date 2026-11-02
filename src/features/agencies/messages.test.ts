import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { agencyErrorMessage } from './messages';

const apiError = (
  status: number,
  code: string,
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) => new ApiError({ status, code, title: 'título del servidor', ...extra });

describe('agencyErrorMessage', () => {
  it.each([
    [409, 'agency_not_reviewable', es.agencies.errors.notReviewable],
    [422, 'review_reason_required', es.agencies.errors.reasonRequired],
    [404, 'agency_not_found', es.agencies.errors.notFound],
  ])('%s %s → texto propio', (status, code, expected) => {
    expect(agencyErrorMessage(apiError(status, code))).toBe(expected);
  });

  it('429 usa retryAfterSeconds', () => {
    expect(agencyErrorMessage(apiError(429, 'x', { retryAfterSeconds: 30 }))).toBe(
      es.agencies.errors.rateLimited(30),
    );
  });

  it('error de red → mensaje de red', () => {
    expect(agencyErrorMessage(new NetworkError(new TypeError('x')))).toBe(
      es.agencies.errors.network,
    );
  });

  it('código desconocido → genérico con el requestId si existe, nunca el título', () => {
    expect(agencyErrorMessage(apiError(500, 'otra', { requestId: 'req-9' }))).toContain('req-9');
    expect(agencyErrorMessage(apiError(500, 'otra'))).toBe(es.agencies.errors.generic);
    expect(agencyErrorMessage(apiError(500, 'otra'))).not.toContain('título del servidor');
    expect(agencyErrorMessage('algo')).toBe(es.agencies.errors.generic);
  });
});
