import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/http';
import { invitationKeys } from '../api/keys';
import { useInvitationsApi } from './useInvitationsApi';

export const RESEND_MUTATION_KEY = ['invitations', 'resend'] as const;

/** Reenviar una invitación pendiente o vencida (renueva el plazo). */
export function useResendInvitation(agencyId: string) {
  const api = useInvitationsApi();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: invitationKeys.all });
  return useMutation({
    mutationKey: RESEND_MUTATION_KEY,
    mutationFn: (id: string) => api.resend(agencyId, id),
    onSuccess: invalidate,
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'invitation_not_pending') void invalidate();
    },
  });
}
