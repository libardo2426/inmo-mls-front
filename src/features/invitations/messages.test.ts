import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { invitationErrorMessage } from './messages';

const apiError = (
  status: number,
  code: string,
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) => new ApiError({ status, code, title: 'título del servidor', ...extra });

describe('invitationErrorMessage', () => {
  it.each([
    [409, 'invitation_already_pending', es.invitations.errors.alreadyPending],
    [403, 'agency_not_active', es.invitations.errors.agencyNotActive],
    [422, 'role_not_invitable', es.invitations.errors.roleNotInvitable],
    [409, 'office_not_available', es.invitations.errors.officeNotAvailable],
    [404, 'invitation_not_found', es.invitations.errors.notFound],
    [409, 'invitation_not_pending', es.invitations.errors.notPending],
    [409, 'invitation_expired', es.invitations.errors.expired],
    [404, 'agency_not_found', es.invitations.errors.agencyNotFound],
  ])('%s %s → texto propio', (status, code, expected) => {
    expect(invitationErrorMessage(apiError(status, code))).toBe(expected);
  });

  it('403 role_not_allowed → sin permiso', () => {
    expect(invitationErrorMessage(apiError(403, 'role_not_allowed'))).toBe(
      es.invitations.errors.forbidden,
    );
  });

  it('429 usa retryAfterSeconds', () => {
    expect(invitationErrorMessage(apiError(429, 'rate_limited', { retryAfterSeconds: 12 }))).toBe(
      es.invitations.errors.rateLimited(12),
    );
  });

  it('error de red → mensaje de red', () => {
    expect(invitationErrorMessage(new NetworkError(new TypeError('x')))).toBe(
      es.invitations.errors.network,
    );
  });

  it('código desconocido → genérico con requestId si existe, nunca el título', () => {
    expect(invitationErrorMessage(apiError(500, 'otra', { requestId: 'req-9' }))).toContain(
      'req-9',
    );
    expect(invitationErrorMessage(apiError(500, 'otra'))).toBe(es.invitations.errors.generic);
    expect(invitationErrorMessage(apiError(500, 'otra'))).not.toContain('título del servidor');
  });
});
