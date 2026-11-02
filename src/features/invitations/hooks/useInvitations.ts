import { useInfiniteQuery } from '@tanstack/react-query';
import type { InvitationStatus } from '@/lib/api/schemas';
import { invitationKeys } from '../api/keys';
import { useInvitationsApi } from './useInvitationsApi';

export const INVITATIONS_PAGE_SIZE = 50;

/** Invitaciones de una inmobiliaria por estado, paginadas por cursor. */
export function useInvitations(agencyId: string, status: InvitationStatus) {
  const api = useInvitationsApi();
  return useInfiniteQuery({
    queryKey: invitationKeys.list(agencyId, status),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.list(agencyId, {
        status,
        limit: INVITATIONS_PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
