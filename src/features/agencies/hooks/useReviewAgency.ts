import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/http';
import { agencyKeys } from '../api/keys';
import type { ReviewAction } from '../review-rules';
import { useAgenciesApi } from './useAgenciesApi';

export const REVIEW_MUTATION_KEY = ['agencies', 'review'] as const;

export type ReviewInput = { id: string; action: ReviewAction; reason?: string };

/** Aprobar, devolver o rechazar. Al terminar (o al chocar con otra revisión) invalida el caché de agencias. */
export function useReviewAgency() {
  const api = useAgenciesApi();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: agencyKeys.all });

  return useMutation({
    mutationKey: REVIEW_MUTATION_KEY,
    mutationFn: ({ id, action, reason = '' }: ReviewInput) =>
      action === 'approve'
        ? api.approve(id)
        : action === 'requestChanges'
          ? api.requestChanges(id, reason)
          : api.reject(id, reason),
    onSuccess: invalidate,
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'agency_not_reviewable') void invalidate();
    },
  });
}
