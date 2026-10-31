import type { ApiError } from './errors';

export type HttpHandlers = {
  onUnauthorized?: (error: ApiError) => void;
  onForbidden?: (error: ApiError) => void;
};

let current: HttpHandlers = {};

/** Puntos de enganche para el manejo global de 401/403 (los implementa F1). */
export function setHttpHandlers(handlers: HttpHandlers): void {
  current = handlers;
}

export function getHttpHandlers(): HttpHandlers {
  return current;
}
