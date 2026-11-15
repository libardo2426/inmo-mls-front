import { Link } from '@tanstack/react-router';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { DescriptionItem, DescriptionList } from '@/components/shared/DescriptionList';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ForbiddenState } from '@/components/shared/ForbiddenState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Section } from '@/components/shared/Section';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { ApiError } from '@/lib/http';
import type { PropertyDetailResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { useTerritoryName } from '@/lib/territory/useTerritoryName';
import { PropertyStatusBadge } from '../components/PropertyStatusBadge';
import { formatMinorAmount } from '../format-money';
import { formatHistoryValue } from '../history';
import { useAgencyDirectory } from '../hooks/useAgencyDirectory';
import { useProperty } from '../hooks/useProperty';
import type { PropertyFilters } from '../model';

type Mandate = PropertyDetailResponse['mandates'][number];
type HistoryEntry = PropertyDetailResponse['history'][number];
type PropertyDocument = PropertyDetailResponse['documents'][number];
type ListPrice = PropertyDetailResponse['listPrices'][number];

const text = es.properties.detail;
const lookup = (map: Record<string, string>, key: string) => map[key] ?? key;
const dateRange = (m: Mandate) => `${formatDate(m.startDate)} – ${formatDate(m.endDate)}`;
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es-CO')} KB`;

function Territory({ code }: { code: string }) {
  return <>{useTerritoryName(code).label}</>;
}

/** Ficha de un inmueble en solo lectura; `filters` vuelve con el enlace al listado. */
export function PropertyDetailScreen({
  propertyId,
  filters,
}: {
  propertyId: string;
  filters: PropertyFilters;
}) {
  const query = useProperty(propertyId);
  const directory = useAgencyDirectory();
  const property = query.data;

  const back = (
    <Link to="/inmuebles" search={filters} className="type-data underline">
      {text.back}
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

  if (!property) {
    const error = query.error;
    return (
      <div className="flex flex-col gap-2 p-6">
        {back}
        {error instanceof ApiError && error.code === 'property_not_found' ? (
          <EmptyState title={text.notFound} />
        ) : error instanceof ApiError && error.status === 403 ? (
          <ForbiddenState />
        ) : (
          <ErrorState error={error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const agencyName = (id: string | null) =>
    (id ? directory.byId.get(id) : undefined) ?? es.properties.unknownAgency;
  const area = (value: number | null) =>
    value === null ? null : `${value.toLocaleString('es-CO')} ${property.areaUnit}`;
  const attributes = Object.entries(property.attributes);

  const priceColumns: Column<ListPrice>[] = [
    {
      id: 'op',
      header: text.mandates.columns.operation,
      cell: (p) => lookup(text.operations, p.operation),
    },
    {
      id: 'price',
      header: es.properties.detail.sections.prices,
      cell: (p) => formatMinorAmount(p.price.amountMinor, p.price.currency),
    },
  ];
  const mandateColumns: Column<Mandate>[] = [
    { id: 'agency', header: text.mandates.columns.agency, cell: (m) => m.agency.name },
    {
      id: 'op',
      header: text.mandates.columns.operation,
      cell: (m) => lookup(text.operations, m.operation),
    },
    {
      id: 'type',
      header: text.mandates.columns.type,
      cell: (m) => lookup(text.mandates.types, m.type),
    },
    { id: 'period', header: text.mandates.columns.period, cell: dateRange },
    {
      id: 'status',
      header: text.mandates.columns.status,
      cell: (m) => lookup(text.mandates.status, m.status),
    },
  ];
  const historyColumns: Column<HistoryEntry>[] = [
    { id: 'date', header: text.history.columns.date, cell: (h) => formatDate(h.changedAt) },
    {
      id: 'field',
      header: text.history.columns.field,
      cell: (h) => lookup(text.history.fields, h.field),
    },
    {
      id: 'change',
      header: text.history.columns.change,
      cell: (h) =>
        `${formatHistoryValue(h.field, h.oldValue)} → ${formatHistoryValue(h.field, h.newValue)}`,
    },
    { id: 'agency', header: text.history.columns.agency, cell: (h) => agencyName(h.agencyId) },
  ];
  const documentColumns: Column<PropertyDocument>[] = [
    { id: 'name', header: text.documents.columns.name, cell: (d) => d.fileName },
    {
      id: 'kind',
      header: text.documents.columns.kind,
      cell: (d) => lookup(text.documents.kinds, d.kind),
    },
    {
      id: 'visibility',
      header: text.documents.columns.visibility,
      cell: (d) => lookup(text.documents.visibility, d.visibility),
    },
    { id: 'size', header: text.documents.columns.size, cell: (d) => kb(d.size) },
    { id: 'date', header: text.documents.columns.date, cell: (d) => formatDate(d.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title={property.uniqueIdentifier} backLink={back} />
      <Section title={text.sections.data}>
        <DescriptionList>
          <DescriptionItem label={text.fields.identifier}>
            {property.identifierLabel} ({lookup(text.identifierStatus, property.identifierStatus)})
          </DescriptionItem>
          <DescriptionItem label={text.fields.type}>
            {lookup(es.properties.types, property.propertyType)}
          </DescriptionItem>
          <DescriptionItem label={text.fields.status}>
            <PropertyStatusBadge status={property.status} />
          </DescriptionItem>
          <DescriptionItem label={text.fields.location}>
            <Territory code={property.territorialUnitCode} />
          </DescriptionItem>
          <DescriptionItem label={text.fields.address}>{property.address}</DescriptionItem>
          {property.addressVisibility !== 'exact' ? (
            <DescriptionItem label={text.fields.addressVisibility}>
              {lookup(text.addressVisibility, property.addressVisibility)}
            </DescriptionItem>
          ) : null}
          <DescriptionItem label={text.fields.builtArea}>
            {area(property.builtArea)}
          </DescriptionItem>
          <DescriptionItem label={text.fields.landArea}>{area(property.landArea)}</DescriptionItem>
          <DescriptionItem label={text.fields.description}>{property.description}</DescriptionItem>
          <DescriptionItem label={text.fields.features}>
            {property.features.length > 0 ? property.features.join(', ') : null}
          </DescriptionItem>
          <DescriptionItem label={text.fields.attributes}>
            {attributes.length > 0
              ? attributes.map(([key, value]) => `${key}: ${String(value)}`).join(', ')
              : null}
          </DescriptionItem>
          <DescriptionItem label={text.fields.editor}>{property.editor?.name}</DescriptionItem>
        </DescriptionList>
      </Section>
      <Section title={text.sections.prices}>
        <DataTable
          columns={priceColumns}
          rows={property.listPrices}
          getRowKey={(p) => p.operation}
          caption={text.prices.caption}
          empty={{ title: text.prices.empty }}
        />
      </Section>
      <Section title={text.sections.mandates}>
        <DataTable
          columns={mandateColumns}
          rows={property.mandates}
          getRowKey={(m) => m.id}
          caption={text.mandates.caption}
          empty={{ title: text.mandates.empty }}
        />
      </Section>
      <Section title={text.sections.history}>
        <DataTable
          columns={historyColumns}
          rows={property.history}
          getRowKey={(h) => `${h.changedAt}-${h.field}`}
          caption={text.history.caption}
          empty={{ title: text.history.empty }}
        />
      </Section>
      <Section title={text.sections.documents}>
        <DataTable
          columns={documentColumns}
          rows={property.documents}
          getRowKey={(d) => d.id}
          caption={text.documents.caption}
          empty={{ title: text.documents.empty }}
        />
      </Section>
    </div>
  );
}
