import { Link } from '@tanstack/react-router';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { AgencyDetailCard } from '../components/AgencyDetailCard';
import { useAgency } from '../hooks/useAgency';
import type { StatusFilter } from '../hooks/useAgencies';

type Props = { agencyId: string; filter: StatusFilter };

/** Detalle de una solicitud de inmobiliaria. */
export function AgencyDetailScreen({ agencyId, filter }: Props) {
  const query = useAgency(agencyId);
  const agency = query.data;

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

  return (
    <div className="flex flex-col gap-4 p-6">
      {back}
      <h1 className="text-lg font-semibold">{agency.tradeName}</h1>
      <AgencyDetailCard agency={agency} />
    </div>
  );
}
