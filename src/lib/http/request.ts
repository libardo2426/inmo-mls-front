import { z } from 'zod';
import { ApiError, NetworkError, ValidationError } from './errors';
import { getHttpHandlers } from './handlers';

export type HostKind = 'country' | 'platform';

export type RequestOptions<S extends z.ZodType> = {
  host: HostKind;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  schema: S;
  signal?: AbortSignal;
};

export type HttpClientOptions = {
  config: { API_BASE_PATH: string; PLATFORM_API_BASE_PATH: string };
  fetchImpl?: typeof fetch;
  /** Origen contra el que se resuelven las rutas relativas (por defecto `location.origin`). */
  origin?: string;
};

// Tolerante a propósito: un `code` nuevo del backend no debe romper el manejo de errores.
const looseProblemSchema = z.object({
  title: z.string().optional(),
  // Better Auth responde `{ code, message }` en lugar de problem+json.
  message: z.string().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.object({ path: z.string(), code: z.string(), message: z.string() })).optional(),
});

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Segundos de espera de `Retry-After` / `X-Retry-After`; solo enteros ≥ 0. */
export function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('retry-after') ?? headers.get('x-retry-after');
  if (raw === null || !/^\d+$/.test(raw.trim())) return undefined;
  return Number(raw.trim());
}

async function toApiError(response: Response): Promise<ApiError> {
  const isProblem = (response.headers.get('content-type') ?? '').includes('json');
  const parsed = isProblem ? looseProblemSchema.safeParse(await readJson(response)) : undefined;
  const problem = parsed?.success ? parsed.data : {};
  return new ApiError({
    status: response.status,
    code: problem.code ?? 'unknown',
    title: problem.title ?? problem.message ?? `Error ${response.status}`,
    requestId: problem.requestId,
    details: problem.details,
    errors: problem.errors,
    retryAfterSeconds: parseRetryAfter(response.headers),
  });
}

export function createRequest(options: HttpClientOptions) {
  const doFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const prefixes: Record<HostKind, string> = {
    country: options.config.API_BASE_PATH,
    platform: options.config.PLATFORM_API_BASE_PATH,
  };

  return async function request<S extends z.ZodType>(o: RequestOptions<S>): Promise<z.infer<S>> {
    const url = new URL(prefixes[o.host] + o.path, options.origin ?? globalThis.location.origin);
    for (const [key, value] of Object.entries(o.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers = new Headers({ Accept: 'application/json' });
    const init: RequestInit = {
      method: o.method ?? 'GET',
      credentials: 'include',
      headers,
    };
    if (o.signal) init.signal = o.signal;
    if (o.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(o.body);
    }

    let response: Response;
    try {
      response = await doFetch(url.toString(), init);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new NetworkError(error);
    }

    if (!response.ok) {
      const apiError = await toApiError(response);
      const handlers = getHttpHandlers();
      const info = { host: o.host, path: o.path };
      if (response.status === 401) handlers.onUnauthorized?.(apiError, info);
      if (response.status === 403) handlers.onForbidden?.(apiError, info);
      throw apiError;
    }

    const result = o.schema.safeParse(await readJson(response));
    if (!result.success) throw new ValidationError(url.pathname, result.error.issues);
    return result.data;
  };
}
