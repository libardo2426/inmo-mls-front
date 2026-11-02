import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InvitableRole } from '@/lib/api/schemas';
import { ApiError } from '@/lib/http';
import { memberKeys } from '../api/keys';
import { useMembersApi } from './useMembersApi';

export const CHANGE_ROLE_MUTATION_KEY = ['members', 'change-role'] as const;

export type ChangeRoleInput = { memberId: string; role: InvitableRole };

/** Cambiar el rol de un miembro. Invalida el caché de miembros al terminar. */
export function useChangeMemberRole() {
  const api = useMembersApi();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: memberKeys.all });

  return useMutation({
    mutationKey: CHANGE_ROLE_MUTATION_KEY,
    mutationFn: ({ memberId, role }: ChangeRoleInput) => api.changeRole(memberId, role),
    onSuccess: invalidate,
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'member_not_active') void invalidate();
    },
  });
}
