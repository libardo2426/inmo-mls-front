import type { ApiError } from './errors';
import type { HostKind } from './request';

/** Qué petición produjo el error: permite ignorar rutas (p. ej. `/auth/*`). */
export type HttpRequestInfo = { host: HostKind; path: string };

export type HttpHandlers = {
  onUnauthorized?: (error: ApiError, request: HttpRequestInfo) => void;
  onForbidden?: (error: ApiError, request: HttpRequestInfo) => void;
};

let current: HttpHandlers = {};

/** Puntos de enganche para el manejo global de 401/403 (los implementa F1). */
export function setHttpHandlers(handlers: HttpHandlers): void {
  current = handlers;
}

export function getHttpHandlers(): HttpHandlers {
  return current;
}
