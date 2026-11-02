import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';

const BY_CODE: Record<string, string> = {
  agency_not_reviewable: es.agencies.errors.notReviewable,
  review_reason_required: es.agencies.errors.reasonRequired,
  agency_not_found: es.agencies.errors.notFound,
};

/** Texto en español para un error de las pantallas de agencias. Decide por `code`, nunca por el título. */
export function agencyErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return es.agencies.errors.network;
  if (error instanceof ApiError) {
    if (error.status === 429) return es.agencies.errors.rateLimited(error.retryAfterSeconds);
    const byCode = BY_CODE[error.code];
    if (byCode) return byCode;
    return error.requestId
      ? `${es.agencies.errors.generic} (${es.agencies.errors.reference}: ${error.requestId})`
      : es.agencies.errors.generic;
  }
  return es.agencies.errors.generic;
}
