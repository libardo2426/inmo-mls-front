import { useInfiniteQuery } from '@tanstack/react-query';
import type { AgencyStatus } from '@/lib/api/schemas';
import { agencyKeys } from '../api/keys';
import { useAgenciesApi } from './useAgenciesApi';

export type StatusFilter = AgencyStatus | 'all';

export const STATUS_FILTERS: readonly StatusFilter[] = [
  'pending',
  'changes_requested',
  'active',
  'rejected',
  'suspended',
  'terminated',
  'all',
];

export const PAGE_SIZE = 50;

/** Filtro de la URL: un valor desconocido o ausente se interpreta como `pending`. */
export function parseStatusFilter(value: unknown): StatusFilter {
  return STATUS_FILTERS.find((filter) => filter === value) ?? 'pending';
}

/** Listado paginado por cursor; «Todos» no envía `status`. */
export function useAgencies(filter: StatusFilter) {
  const api = useAgenciesApi();
  return useInfiniteQuery({
    queryKey: agencyKeys.list(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.list({
        limit: PAGE_SIZE,
        ...(filter === 'all' ? {} : { status: filter }),
        ...(pageParam ? { cursor: pageParam } : {}),
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
