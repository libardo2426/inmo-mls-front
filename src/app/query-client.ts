import { QueryClient } from '@tanstack/react-query';
import { ApiError, NetworkError } from '@/lib/http';

const MAX_RETRIES = 2;

/** Reintenta solo fallos transitorios: red caída o 5xx. Nunca 4xx ni errores de contrato. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const transient =
    error instanceof NetworkError || (error instanceof ApiError && error.status >= 500);
  return transient && failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
    },
  });
}
