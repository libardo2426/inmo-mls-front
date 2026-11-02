import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';

const BY_CODE: Record<string, string> = {
  invitation_already_pending: es.invitations.errors.alreadyPending,
  agency_not_active: es.invitations.errors.agencyNotActive,
  role_not_invitable: es.invitations.errors.roleNotInvitable,
  office_not_available: es.invitations.errors.officeNotAvailable,
  invitation_not_found: es.invitations.errors.notFound,
  invitation_not_pending: es.invitations.errors.notPending,
  invitation_expired: es.invitations.errors.expired,
  agency_not_found: es.invitations.errors.agencyNotFound,
};

/** Texto en español para un error de las invitaciones. Decide por `code`, nunca por el título. */
export function invitationErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return es.invitations.errors.network;
  if (error instanceof ApiError) {
    if (error.status === 429) return es.invitations.errors.rateLimited(error.retryAfterSeconds);
    const byCode = BY_CODE[error.code];
    if (byCode) return byCode;
    if (error.status === 403) return es.invitations.errors.forbidden;
    return error.requestId
      ? `${es.invitations.errors.generic} (${es.invitations.errors.reference}: ${error.requestId})`
      : es.invitations.errors.generic;
  }
  return es.invitations.errors.generic;
}
