import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/http';
import { invitationKeys } from '../api/keys';
import { useInvitationsApi } from './useInvitationsApi';

export const CANCEL_MUTATION_KEY = ['invitations', 'cancel'] as const;

/** Cancelar una invitación pendiente. */
export function useCancelInvitation(agencyId: string) {
  const api = useInvitationsApi();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: invitationKeys.all });
  return useMutation({
    mutationKey: CANCEL_MUTATION_KEY,
    mutationFn: (id: string) => api.cancel(agencyId, id),
    onSuccess: invalidate,
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'invitation_not_pending') void invalidate();
    },
  });
}
