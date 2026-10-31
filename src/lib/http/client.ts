import { createRequest, type HttpClientOptions } from './request';

/** Cliente HTTP único de la aplicación (ADR-0005): elige el host por llamada. */
export function createHttpClient(options: HttpClientOptions) {
  return { request: createRequest(options) };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
