import { useQuery } from '@tanstack/react-query';
import { agencyKeys } from '../api/keys';
import { useAgenciesApi } from './useAgenciesApi';

/** Detalle de una solicitud (`GET /v1/agencies/{id}`). */
export function useAgency(id: string) {
  const api = useAgenciesApi();
  return useQuery({
    queryKey: agencyKeys.detail(id),
    queryFn: ({ signal }) => api.get(id, signal),
  });
}
