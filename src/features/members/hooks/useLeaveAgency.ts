import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberKeys } from '../api/keys';
import { useMembersApi } from './useMembersApi';

export const LEAVE_MUTATION_KEY = ['members', 'leave'] as const;

/** Renunciar a la inmobiliaria (`POST /v1/members/me/leave`). Invalida el caché de miembros. */
export function useLeaveAgency() {
  const api = useMembersApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: LEAVE_MUTATION_KEY,
    mutationFn: () => api.leave(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}
