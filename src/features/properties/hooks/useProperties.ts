import { useInfiniteQuery } from '@tanstack/react-query';
import { propertyKeys } from '../api/keys';
import type { PropertyFilters } from '../model';
import { usePropertiesApi } from './usePropertiesApi';

export const PROPERTIES_PAGE_SIZE = 50;

/** Listado paginado por cursor con los filtros de la URL. */
export function useProperties(filters: PropertyFilters) {
  const api = usePropertiesApi();
  return useInfiniteQuery({
    queryKey: propertyKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.list({
        ...filters,
        limit: PROPERTIES_PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
