import { useQuery } from '@tanstack/react-query';
import { memberKeys } from '../api/keys';
import { useMembersApi } from './useMembersApi';

/** Miembros de una inmobiliaria (`GET /v1/agencies/{id}/members`, sin paginar). */
export function useMembers(agencyId: string) {
  const api = useMembersApi();
  return useQuery({
    queryKey: memberKeys.list(agencyId),
    queryFn: ({ signal }) => api.list(agencyId, signal),
  });
}
