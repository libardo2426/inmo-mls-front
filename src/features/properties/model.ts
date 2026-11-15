import type { Tone } from '@/components/shared/StatusBadge';

export const PROPERTY_TYPES = [
  'apartment',
  'house',
  'lot',
  'retail',
  'office',
  'warehouse',
  'farm',
] as const;

export const PROPERTY_STATUSES = [
  'draft',
  'active',
  'reserved',
  'closed',
  'suspended',
  'withdrawn',
  'expired',
] as const;

export type PropertyFilters = {
  type?: string;
  status?: string;
  territory?: string;
  agency?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const oneOf = (value: unknown, allowed: readonly string[]): string | undefined =>
  typeof value === 'string' && allowed.includes(value) ? value : undefined;

/** Filtros de la URL: un valor inválido se descarta (sin filtro) en vez de llegar al backend. */
export function parsePropertyFilters(search: Record<string, unknown>): PropertyFilters {
  const type = oneOf(search.type, PROPERTY_TYPES);
  const status = oneOf(search.status, PROPERTY_STATUSES);
  const territory =
    typeof search.territory === 'string' && search.territory.trim() !== ''
      ? search.territory.trim()
      : undefined;
  const agency =
    typeof search.agency === 'string' && UUID.test(search.agency) ? search.agency : undefined;
  return {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(territory ? { territory } : {}),
    ...(agency ? { agency } : {}),
  };
}

const STATUS_TONE: Record<(typeof PROPERTY_STATUSES)[number], Tone> = {
  draft: 'neutral',
  active: 'success',
  reserved: 'info',
  closed: 'neutral',
  suspended: 'danger',
  withdrawn: 'warning',
  expired: 'warning',
};

/** Tono del estado; uno nuevo del backend cae a `neutral`. */
export function propertyStatusTone(status: string): Tone {
  return (STATUS_TONE as Record<string, Tone>)[status] ?? 'neutral';
}
