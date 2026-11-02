import { ApiError, NetworkError } from '@/lib/http';
import { es } from '@/lib/i18n/es';

const BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: es.auth.errors.credentials,
  INVALID_CODE: es.auth.errors.codeInvalid,
  INVALID_BACKUP_CODE: es.auth.errors.codeInvalid,
  INVALID_PASSWORD: es.auth.errors.passwordInvalid,
  INVALID_TOKEN: es.auth.errors.tokenInvalid,
  ACCOUNT_TEMPORARILY_LOCKED: es.auth.errors.locked,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: es.auth.errors.locked,
  INVALID_TWO_FACTOR_COOKIE: es.auth.errors.twoFactorExpired,
  INVALID_ORIGIN: es.auth.errors.origin,
  MISSING_OR_NULL_ORIGIN: es.auth.errors.origin,
  USER_ALREADY_EXISTS: es.auth.errors.userExists,
  PASSWORD_TOO_SHORT: es.auth.errors.passwordShort,
  EMAIL_NOT_VERIFIED: es.auth.errors.emailNotVerified,
};

/** Texto en español para un error de las pantallas de autenticación. Decide por `code`, nunca por el título. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return es.auth.errors.network;
  if (error instanceof ApiError) {
    if (error.status === 429) return es.auth.errors.rateLimited(error.retryAfterSeconds);
    const byCode = BY_CODE[error.code];
    if (byCode) return byCode;
    return error.requestId
      ? `${es.auth.errors.generic} (${es.auth.errors.reference}: ${error.requestId})`
      : es.auth.errors.generic;
  }
  return es.auth.errors.generic;
}
