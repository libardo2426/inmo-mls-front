import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/http';
import { memberKeys } from '../api/keys';
import { useMembersApi } from './useMembersApi';

export const TERMINATE_MUTATION_KEY = ['members', 'terminate'] as const;

export type TerminateInput = { memberId: string; reason?: string };

/** Terminar un miembro. Al terminar (o si ya no estaba activo) invalida el caché de miembros. */
export function useTerminateMember() {
  const api = useMembersApi();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: memberKeys.all });

  return useMutation({
    mutationKey: TERMINATE_MUTATION_KEY,
    mutationFn: ({ memberId, reason }: TerminateInput) => api.terminate(memberId, reason),
    onSuccess: invalidate,
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'member_not_active') void invalidate();
    },
  });
}
