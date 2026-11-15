import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AgencySummary } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { AgencyStatusBadge } from '../components/AgencyStatusBadge';
import { formatDate } from '../format';
import type { ReviewAction } from '../review-rules';
import { STATUS_FILTERS, useAgencies, type StatusFilter } from '../hooks/useAgencies';

const columns = (filter: StatusFilter): Column<AgencySummary>[] => [
  {
    id: 'tradeName',
    header: es.agencies.list.columns.tradeName,
    cell: (a) => (
      <Link
        to="/agencias/$agencyId"
        params={{ agencyId: a.id }}
        search={{ status: filter }}
        className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
      >
        {a.tradeName}
      </Link>
    ),
  },
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

const REVIEW_ACTIONS: readonly ReviewAction[] = ['approve', 'requestChanges', 'reject'];

/** Acción que se acaba de revisar, enviada en el `state` del historial (desaparece al cambiar de filtro). */
function useReviewNotice(): ReviewAction | null {
  const state = useRouterState({ select: (s) => s.location.state }) as { reviewNotice?: unknown };
  return REVIEW_ACTIONS.find((action) => action === state.reviewNotice) ?? null;
}

/** Listado de solicitudes de inmobiliarias; el filtro de estado vive en la URL. */
export function AgenciesListScreen({ filter }: { filter: StatusFilter }) {
  const navigate = useNavigate();
  const notice = useReviewNotice();
  const query = useAgencies(filter);
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title={es.agencies.list.title} />
      {notice ? (
        <Alert>
          <AlertDescription>{es.agencies.review.done[notice]}</AlertDescription>
        </Alert>
      ) : null}
      <Tabs
        value={filter}
        onValueChange={(status) =>
          void navigate({ to: '/agencias', search: { status: status as StatusFilter } })
        }
      >
        <TabsList
          variant="line"
          aria-label={es.agencies.list.filterLabel}
          className="h-auto w-full flex-wrap justify-start"
        >
          {STATUS_FILTERS.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              className="flex-none px-3 py-2 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:bg-primary"
            >
              {filterLabel(option)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={filter}>
          <DataTable
            columns={columns(filter)}
            rows={rows}
            getRowKey={(agency) => agency.id}
            caption={es.agencies.list.caption}
            isLoading={query.isPending}
            error={query.error}
            onRetry={() =>
              void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
            }
            empty={{ title: es.agencies.list.emptyTitle, description: es.agencies.list.emptyHelp }}
            onRowActivate={(agency) =>
              void navigate({
                to: '/agencias/$agencyId',
                params: { agencyId: agency.id },
                search: { status: filter },
              })
            }
            hasMore={query.hasNextPage}
            onLoadMore={() => void query.fetchNextPage()}
            isLoadingMore={query.isFetchingNextPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
