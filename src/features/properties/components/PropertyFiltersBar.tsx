import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { AgencySummary } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { PROPERTY_STATUSES, PROPERTY_TYPES, type PropertyFilters } from '../model';

const selectClass = 'border-input bg-background h-8 rounded-md border px-2 text-sm';

type Props = {
  filters: PropertyFilters;
  /** Agencias activas para el selector; `null` si no se pudieron cargar (selector deshabilitado). */
  agencies: AgencySummary[] | null;
  /** Nombre de la agencia filtrada cuando no está entre las activas (p. ej. suspendida). */
  agencyLabel?: string | undefined;
};

/** Filtros del listado; cada cambio escribe la URL y un valor vacío quita el filtro. */
export function PropertyFiltersBar({ filters, agencies, agencyLabel }: Props) {
  const navigate = useNavigate();
  const update = (key: keyof PropertyFilters, value: string, replace = false) => {
    const next: PropertyFilters = { ...filters, [key]: value === '' ? undefined : value };
    void navigate({ to: '/inmuebles', search: next, replace });
  };
  // El municipio se aplica al confirmar (Enter o salir del campo), no en cada tecla.
  const [territory, setTerritory] = useState(filters.territory ?? '');
  const [lastTerritory, setLastTerritory] = useState(filters.territory);
  if (filters.territory !== lastTerritory) {
    setLastTerritory(filters.territory);
    setTerritory(filters.territory ?? '');
  }
  const commitTerritory = () => {
    const value = territory.trim();
    if (value !== (filters.territory ?? '')) update('territory', value, true);
  };
  const activeAgency = filters.agency
    ? (agencies ?? []).find((agency) => agency.id === filters.agency)
    : undefined;
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
          value={territory}
          onChange={(event) => setTerritory(event.target.value)}
          onBlur={commitTerritory}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitTerritory();
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{text.agency}</span>
        <select
          className={selectClass}
          disabled={agencies === null && !filters.agency}
          value={filters.agency ?? ''}
          onChange={(event) => update('agency', event.target.value)}
        >
          <option value="">{text.allAgencies}</option>
          {filters.agency && !activeAgency ? (
            <option value={filters.agency}>{agencyLabel ?? es.properties.unknownAgency}</option>
          ) : null}
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
