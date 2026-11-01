import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { meResponseSchema, type MeResponse } from '@/lib/api/schemas';
import { ApiError, NetworkError, type HttpClient } from '@/lib/http';

export const ME_QUERY_KEY = ['me'] as const;

/** `GET /v1/me`: la única fuente del estado de sesión (nunca se lee la cookie). */
export function meQueryOptions(http: HttpClient) {
  return queryOptions({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) =>
      http.request({ host: 'country', path: '/me', schema: meResponseSchema, signal }),
    retry: false,
    staleTime: 60_000,
  });
}

export type SessionState =
  | { status: 'authenticated'; me: MeResponse }
  | { status: 'anonymous' }
  | { status: 'two-factor-required' }
  | { status: 'no-membership' }
  | { status: 'unavailable' }
  | { status: 'offline' };

/**
 * Traduce la respuesta de `/me` a un estado de sesión. Los errores inesperados
 * (p. ej. 500) se relanzan para que los muestre el error del router.
 */
export async function resolveSession(
  queryClient: QueryClient,
  http: HttpClient,
): Promise<SessionState> {
  try {
    const me = await queryClient.fetchQuery(meQueryOptions(http));
    return me.membership === null ? { status: 'no-membership' } : { status: 'authenticated', me };
  } catch (error) {
    if (error instanceof NetworkError) return { status: 'offline' };
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'anonymous' };
      if (error.status === 403 && error.code === 'two_factor_required') {
        return { status: 'two-factor-required' };
      }
      if (error.status === 403 && error.code === 'no_membership') {
        return { status: 'no-membership' };
      }
      if (error.status === 503 && error.code === 'tenant_unavailable') {
        return { status: 'unavailable' };
      }
    }
    throw error;
  }
}
