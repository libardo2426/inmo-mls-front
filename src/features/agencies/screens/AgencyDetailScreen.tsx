import { useIsMutating } from '@tanstack/react-query';
import { Link, useNavigate, type HistoryState } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useMe } from '@/lib/permissions';
import { AgencyDetailCard } from '../components/AgencyDetailCard';
import { ReviewDialog } from '../components/ReviewDialog';
import { useAgency } from '../hooks/useAgency';
import type { StatusFilter } from '../hooks/useAgencies';
import { REVIEW_MUTATION_KEY } from '../hooks/useReviewAgency';
import { reviewActionsFor, type ReviewAction } from '../review-rules';

type Props = { agencyId: string; filter: StatusFilter };

/** Detalle de una solicitud de inmobiliaria. */
export function AgencyDetailScreen({ agencyId, filter }: Props) {
  const query = useAgency(agencyId);
  const agency = query.data;
  const me = useMe();
  const navigate = useNavigate();
  const [openAction, setOpenAction] = useState<ReviewAction | null>(null);
  const [conflict, setConflict] = useState(false);
  const busy = useIsMutating({ mutationKey: REVIEW_MUTATION_KEY }) > 0;

  const back = (
    <Link to="/agencias" search={{ status: filter }} className="text-sm underline">
      {es.agencies.detail.back}
    </Link>
  );

  if (query.isPending) {
    return (
      <div role="status" aria-label={es.states.loading} className="flex flex-col gap-3 p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  if (!agency) {
    const notFound = query.error instanceof ApiError && query.error.code === 'agency_not_found';
    return (
      <div className="flex flex-col gap-2 p-6">
        {back}
        {notFound ? (
          <EmptyState title={es.agencies.errors.notFound} />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const allowed = reviewActionsFor(me, agency);
  const actions = (['approve', 'requestChanges', 'reject'] as const).filter(
    (action) => allowed[action],
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {back}
      <h1 className="text-lg font-semibold">{agency.tradeName}</h1>
      {conflict ? (
        <Alert>
          <AlertDescription>{es.agencies.review.conflict}</AlertDescription>
        </Alert>
      ) : null}
      <AgencyDetailCard agency={agency} />
      {actions.length > 0 ? (
        <div className="flex gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              variant={action === 'reject' ? 'destructive' : 'outline'}
              disabled={busy}
              onClick={() => {
                setConflict(false);
                setOpenAction(action);
              }}
            >
              {es.agencies.review.actions[action]}
            </Button>
          ))}
        </div>
      ) : null}
      {openAction ? (
        <ReviewDialog
          key={openAction}
          action={openAction}
          agency={agency}
          open
          onOpenChange={(open) => (open ? undefined : setOpenAction(null))}
          onConflict={() => setConflict(true)}
          onDone={(done) =>
            void navigate({
              to: '/agencias',
              search: { status: filter },
              state: { reviewNotice: done } as unknown as HistoryState,
            })
          }
        />
      ) : null}
    </div>
  );
}
