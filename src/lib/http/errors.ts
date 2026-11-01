import type { z } from 'zod';

export type FieldError = { path: string; code: string; message: string };

type ApiErrorInit = {
  status: number;
  code: string;
  title: string;
  requestId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  errors?: FieldError[] | undefined;
};

/** Error devuelto por el backend. La UI decide con `code`, nunca con `title`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly requestId?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
  readonly errors?: FieldError[] | undefined;

  constructor(init: ApiErrorInit) {
    super(init.title);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.requestId = init.requestId;
    this.details = init.details;
    this.errors = init.errors;
  }
}

/** No hubo respuesta (red caída, DNS, CORS). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('No se pudo conectar con el servidor', { cause });
    this.name = 'NetworkError';
  }
}

/** El backend respondió bien pero el cuerpo no cumple el schema esperado. */
export class ValidationError extends Error {
  readonly issues: z.core.$ZodIssue[];
  readonly url: string;

  constructor(url: string, issues: z.core.$ZodIssue[]) {
    super(`La respuesta de ${url} no cumple el contrato`);
    this.name = 'ValidationError';
    this.url = url;
    this.issues = issues;
  }
}
