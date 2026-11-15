import { Link } from '@tanstack/react-router';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTerritoryName } from '@/lib/territory/useTerritoryName';
import type { PropertyListItem } from '../api/property-list-schema';
import { PropertyFiltersBar } from '../components/PropertyFiltersBar';
import { PropertyStatusBadge } from '../components/PropertyStatusBadge';
import { useAgencyDirectory } from '../hooks/useAgencyDirectory';
import { useProperties } from '../hooks/useProperties';
import type { PropertyFilters } from '../model';

function TerritoryCell({ code }: { code: string }) {
  return <>{useTerritoryName(code).label}</>;
}

/** Listado de inmuebles de la red (solo lectura); los filtros viven en la URL. */
export function PropertiesListScreen({ filters }: { filters: PropertyFilters }) {
  const query = useProperties(filters);
  const directory = useAgencyDirectory();
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  const columns: Column<PropertyListItem>[] = [
    {
      id: 'identifier',
      header: es.properties.list.columns.identifier,
      cell: (p) => (
        <Link
          to="/inmuebles/$propertyId"
          params={{ propertyId: p.id }}
          search={filters}
          className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
        >
          {p.uniqueIdentifier}
        </Link>
      ),
    },
    {
      id: 'type',
      header: es.properties.list.columns.type,
      cell: (p) =>
        (es.properties.types as Record<string, string>)[p.propertyType] ?? p.propertyType,
    },
    {
      id: 'status',
      header: es.properties.list.columns.status,
      cell: (p) => <PropertyStatusBadge status={p.status} />,
    },
    {
      id: 'territory',
      header: es.properties.list.columns.territory,
      cell: (p) => <TerritoryCell code={p.territorialUnitCode} />,
    },
    { id: 'address', header: es.properties.list.columns.address, cell: (p) => p.address },
    {
      id: 'agency',
      header: es.properties.list.columns.agency,
      cell: (p) =>
        (p.editorAgencyId ? directory.byId.get(p.editorAgencyId) : undefined) ??
        es.properties.unknownAgency,
    },
    {
      id: 'createdAt',
      header: es.properties.list.columns.createdAt,
      cell: (p) => formatDate(p.createdAt),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title={es.properties.list.title} />
      <PropertyFiltersBar
        filters={filters}
        agencies={directory.isError ? null : directory.activeAgencies}
        agencyLabel={filters.agency ? directory.byId.get(filters.agency) : undefined}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => p.id}
        caption={es.properties.list.caption}
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}
        empty={{ title: es.properties.list.emptyTitle, description: es.properties.list.emptyHelp }}
        hasMore={query.hasNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        isLoadingMore={query.isFetchingNextPage}
      />
    </div>
  );
}
