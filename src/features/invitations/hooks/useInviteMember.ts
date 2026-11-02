import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationKeys } from '../api/keys';
import type { InviteMemberInput } from '../api/invitations-api';
import { useInvitationsApi } from './useInvitationsApi';

export const INVITE_MUTATION_KEY = ['invitations', 'invite'] as const;

/** Invitar a una persona. Al terminar invalida los listados de invitaciones. */
export function useInviteMember(agencyId: string) {
  const api = useInvitationsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: INVITE_MUTATION_KEY,
    mutationFn: (body: InviteMemberInput) => api.invite(agencyId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.all }),
  });
}
