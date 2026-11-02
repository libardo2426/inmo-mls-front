import { useNavigate } from '@tanstack/react-router';
import { DataTable, type Column } from '@/components/shared/DataTable';
import type { AgencySummary } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { AgencyStatusBadge } from '../components/AgencyStatusBadge';
import { formatDate } from '../format';
import { STATUS_FILTERS, useAgencies, type StatusFilter } from '../hooks/useAgencies';

const columns: Column<AgencySummary>[] = [
  { id: 'tradeName', header: es.agencies.list.columns.tradeName, cell: (a) => a.tradeName },
  { id: 'legalName', header: es.agencies.list.columns.legalName, cell: (a) => a.legalName },
  {
    id: 'taxId',
    header: es.agencies.list.columns.taxId,
    cell: (a) => `${a.taxIdType} ${a.taxId}`,
  },
  {
    id: 'status',
    header: es.agencies.list.columns.status,
    cell: (a) => <AgencyStatusBadge status={a.status} />,
  },
  {
    id: 'submittedAt',
    header: es.agencies.list.columns.submittedAt,
    cell: (a) => formatDate(a.submittedAt),
  },
];

const filterLabel = (filter: StatusFilter) =>
  filter === 'all' ? es.agencies.list.filterAll : es.agencies.status[filter];

/** Listado de solicitudes de inmobiliarias; el filtro de estado vive en la URL. */
export function AgenciesListScreen({ filter }: { filter: StatusFilter }) {
  const navigate = useNavigate();
  const query = useAgencies(filter);
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{es.agencies.list.title}</h1>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{es.agencies.list.filterLabel}</span>
          <select
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            value={filter}
            onChange={(event) =>
              void navigate({
                to: '/agencias',
                search: { status: event.target.value as StatusFilter },
              })
            }
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option} value={option}>
                {filterLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(agency) => agency.id}
        caption={es.agencies.list.caption}
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={{ title: es.agencies.list.emptyTitle, description: es.agencies.list.emptyHelp }}
        onRowActivate={(agency) =>
          void navigate({ to: '/agencias/$agencyId', params: { agencyId: agency.id } })
        }
        hasMore={query.hasNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        isLoadingMore={query.isFetchingNextPage}
      />
    </div>
  );
}
