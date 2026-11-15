import { useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import type { AgencySummary } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { PROPERTY_STATUSES, PROPERTY_TYPES, type PropertyFilters } from '../model';

const selectClass = 'border-input bg-background h-8 rounded-md border px-2 text-sm';

type Props = {
  filters: PropertyFilters;
  /** Agencias activas para el selector; `null` si no se pudieron cargar (selector deshabilitado). */
  agencies: AgencySummary[] | null;
};

/** Filtros del listado; cada cambio escribe la URL y un valor vacío quita el filtro. */
export function PropertyFiltersBar({ filters, agencies }: Props) {
  const navigate = useNavigate();
  const update = (key: keyof PropertyFilters, value: string) => {
    const next: PropertyFilters = { ...filters, [key]: value === '' ? undefined : value };
    void navigate({ to: '/inmuebles', search: next });
  };
  const text = es.properties.filters;

  return (
    <div role="group" aria-label={text.label} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{text.type}</span>
        <select
          className={selectClass}
          value={filters.type ?? ''}
          onChange={(event) => update('type', event.target.value)}
        >
          <option value="">{text.all}</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {es.properties.types[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{text.status}</span>
        <select
          className={selectClass}
          value={filters.status ?? ''}
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">{text.all}</option>
          {PROPERTY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {es.properties.status[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{text.territory}</span>
        <Input
          className="h-8 w-40"
          inputMode="numeric"
          value={filters.territory ?? ''}
          onChange={(event) => update('territory', event.target.value.trim())}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{text.agency}</span>
        <select
          className={selectClass}
          disabled={agencies === null}
          value={filters.agency ?? ''}
          onChange={(event) => update('agency', event.target.value)}
        >
          <option value="">{text.allAgencies}</option>
          {(agencies ?? []).map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.tradeName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
