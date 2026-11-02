import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';

const BY_CODE: Record<string, string> = {
  last_broker: es.members.errors.lastBroker,
  member_not_active: es.members.errors.notActive,
  member_not_found: es.members.errors.notFound,
  agency_not_found: es.members.errors.notFound,
  role_not_invitable: es.members.errors.roleNotInvitable,
  termination_reason_required: es.members.errors.reasonRequired,
  two_factor_required: es.members.errors.twoFactorRequired,
};

/** Texto en español para un error de las pantallas de miembros. Decide por `code`, nunca por el título. */
export function memberErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return es.members.errors.network;
  if (error instanceof ApiError) {
    if (error.status === 429) return es.members.errors.rateLimited(error.retryAfterSeconds);
    const byCode = BY_CODE[error.code];
    if (byCode) return byCode;
    if (error.status === 403) return es.members.errors.forbidden;
    return error.requestId
      ? `${es.members.errors.generic} (${es.members.errors.reference}: ${error.requestId})`
      : es.members.errors.generic;
  }
  return es.members.errors.generic;
}
