import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { memberErrorMessage } from './messages';

const apiError = (
  status: number,
  code: string,
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) => new ApiError({ status, code, title: 'título del servidor', ...extra });

describe('memberErrorMessage', () => {
  it.each([
    [409, 'last_broker', es.members.errors.lastBroker],
    [409, 'member_not_active', es.members.errors.notActive],
    [404, 'member_not_found', es.members.errors.notFound],
    [422, 'termination_reason_required', es.members.errors.reasonRequired],
    [403, 'two_factor_required', es.members.errors.twoFactorRequired],
    [422, 'role_not_invitable', es.members.errors.roleNotInvitable],
    [404, 'agency_not_found', es.members.errors.notFound],
  ])('%s %s → texto propio', (status, code, expected) => {
    expect(memberErrorMessage(apiError(status, code))).toBe(expected);
  });

  it('otro 403 → sin permiso', () => {
    expect(memberErrorMessage(apiError(403, 'insufficient_role'))).toBe(
      es.members.errors.forbidden,
    );
  });

  it('429 usa retryAfterSeconds', () => {
    expect(memberErrorMessage(apiError(429, 'rate_limited', { retryAfterSeconds: 7 }))).toBe(
      es.members.errors.rateLimited(7),
    );
  });

  it('error de red → mensaje de red', () => {
    expect(memberErrorMessage(new NetworkError(new TypeError('x')))).toBe(
      es.members.errors.network,
    );
  });

  it('código desconocido → genérico con requestId si existe, nunca el título', () => {
    expect(memberErrorMessage(apiError(500, 'otra', { requestId: 'req-9' }))).toContain('req-9');
    expect(memberErrorMessage(apiError(500, 'otra'))).toBe(es.members.errors.generic);
    expect(memberErrorMessage(apiError(500, 'otra'))).not.toContain('título del servidor');
    expect(memberErrorMessage(new Error('x'))).toBe(es.members.errors.generic);
  });
});
