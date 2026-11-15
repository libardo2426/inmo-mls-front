import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHttpClient } from '@/app/app-context';
import { agencyPageResponseSchema, type AgencySummary } from '@/lib/api/schemas';

const DIRECTORY_LIMIT = 100;

/**
 * Agencias para traducir ids a nombres (columna e historial) y poblar el selector. Sin filtro de
 * estado, para no perder las suspendidas o terminadas; el selector usa solo `active`.
 * Pide el endpoint directo: una feature no importa de otra (regla de lint). Un fallo aquí no debe bloquear a quien lo consume: `isError` avisa y `byId` queda vacío.
 */
export function useAgencyDirectory(): {
  agencies: AgencySummary[];
  activeAgencies: AgencySummary[];
  byId: Map<string, string>;
  isPending: boolean;
  isError: boolean;
} {
  const http = useHttpClient();
  const query = useQuery({
    queryKey: ['agencies', 'directory'] as const,
    queryFn: ({ signal }) =>
      http.request({
        host: 'country',
        path: '/agencies',
        query: { limit: DIRECTORY_LIMIT },
        schema: agencyPageResponseSchema,
        signal,
      }),
    staleTime: 60_000,
  });
  return useMemo(() => {
    const agencies = query.data?.items ?? [];
    return {
      agencies,
      activeAgencies: agencies.filter((agency) => agency.status === 'active'),
      byId: new Map(agencies.map((agency) => [agency.id, agency.tradeName])),
      isPending: query.isPending,
      isError: query.isError,
    };
  }, [query.data, query.isPending, query.isError]);
}
